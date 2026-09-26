-- v0.1.50 server-owned accessory combat passives.
alter table private.online_combat_states
 add column if not exists accessory_passive text,
 add column if not exists accessory_value numeric not null default 0;

create or replace function private.combat_accessory_passive(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_eq jsonb:=p_payload->'expedition'->'equipment';v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);v_item jsonb;v_kind text;v_level int;v_value numeric:=0;
begin
 select i into v_item from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'accessory' limit 1;
 if v_item is null then return jsonb_build_object('kind',null,'value',0);end if;
 v_kind:=v_item->>'kind';v_level:=greatest(0,least(3,coalesce((v_item->>'enhancement')::int,0)));
 if v_kind='vampire' then v_value:=(array[.08,.09,.10,.11])[v_level+1];
 elsif v_kind='unyielding' then v_value:=(array[.30,.32,.34,.36])[v_level+1];
 elsif v_kind='berserker' then v_value:=(array[.40,.43,.46,.50])[v_level+1];
 else v_kind:=null;end if;
 return jsonb_build_object('kind',v_kind,'value',v_value);
end $$;
revoke all on function private.combat_accessory_passive(jsonb) from public,anon,authenticated;

create or replace function private.combat_effective_attack(p_combat private.online_combat_states)
returns numeric language sql immutable set search_path='' as $$
 select p_combat.player_attack * case when p_combat.accessory_passive='berserker' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.40 then 1+p_combat.accessory_value else 1 end
$$;
revoke all on function private.combat_effective_attack(private.online_combat_states) from public,anon,authenticated;

create or replace function public.begin_online_combat_state_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_save public.game_saves%rowtype;v_result jsonb;v_bag jsonb;v_power numeric;v_passive jsonb;
begin
 v_result:=public.begin_online_combat_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,null,null,null);
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_save from public.game_saves where user_id=v_user;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 v_bag:=coalesce(v_save.payload->'expedition'->'bag','{}'::jsonb);v_power:=private.combat_skill_power(v_save.payload);v_passive:=private.combat_accessory_passive(v_save.payload);
 update private.online_combat_states set skill_power=v_power,revival_count=greatest(0,least(1,coalesce((v_bag->>'revival')::int,0))),accessory_passive=v_passive->>'kind',accessory_value=coalesce((v_passive->>'value')::numeric,0) where user_id=v_user;
 return v_result;
end $$;

create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ret bigint;v_kill bigint;v_phase text;v_heal bigint:=0;v_received_mult numeric:=1;
begin
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-p_damage);
 if p_combat.accessory_passive='vampire' and p_damage>0 then v_heal:=floor(p_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+v_heal);end if;
 if p_combat.monster_hp=0 then
  v_kill:=p_run.confirmed_kills+1;insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,v_kill,p_combat.monster_id);
  update private.online_expeditions set confirmed_kills=v_kill,last_confirmed_kill_at=now() where user_id=p_user;
  update private.online_combat_states set monster_hp=0,player_hp=p_combat.player_hp,phase='DEFEATED',action_nonce=p_nonce,updated_at=now() where user_id=p_user;
  return jsonb_build_object('damage',p_damage,'healing',v_heal,'monsterHp',0,'playerHp',p_combat.player_hp,'phase','DEFEATED','confirmedKills',v_kill,'actionNonce',p_nonce);
 end if;
 if p_combat.guard_turns>0 then v_received_mult:=v_received_mult*.6;end if;
 if p_combat.accessory_passive='unyielding' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35 then v_received_mult:=v_received_mult*(1-p_combat.accessory_value);end if;
 v_ret:=greatest(1,round((p_combat.monster_attack-p_combat.player_defense)*v_received_mult)::bigint);p_combat.player_hp:=greatest(0,p_combat.player_hp-v_ret);
 if p_combat.player_hp=0 and p_combat.revival_count>0 then v_phase:='PLAYER_DEAD';p_combat.pending_revival:=true;else v_phase:=case when p_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end;end if;
 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,turn_no=turn_no+1,guard_turns=greatest(0,guard_turns-1),phase=v_phase,pending_revival=p_combat.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',p_damage,'healing',v_heal,'monsterHp',p_combat.monster_hp,'retaliation',v_ret,'playerHp',p_combat.player_hp,'phase',v_phase,'pendingRevival',p_combat.pending_revival,'confirmedKills',p_run.confirmed_kills,'actionNonce',p_nonce);
end $$;

-- Patch action functions to use effective attack, preserving deterministic crit and skill rules.
create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_damage bigint:=0;v_hit int;v_mult numeric;v_crit boolean;v_attack numeric;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;if v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 v_attack:=private.combat_effective_attack(v_combat);
 for v_hit in 1..v_combat.basic_hits loop v_mult:=case when v_combat.basic_hits=2 then .55 else 1 end;v_crit:=private.server_roll(v_combat.rng_seed,v_combat.encounter_index,p_action_nonce,v_hit)<v_combat.crit_chance;v_damage:=v_damage+greatest(1,round(v_attack*v_mult*(case when v_crit then v_combat.crit_damage else 1 end)-v_combat.monster_defense)::bigint);end loop;
 return private.finish_server_player_action(v_user,v_run,v_combat,p_action_nonce,v_damage);
end $$;

create or replace function public.apply_online_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_skill_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_mult numeric;v_cd int;v_left int;v_damage bigint;v_attack numeric;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id or v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 select x.mult,x.cd into v_mult,v_cd from (values('heavy'::text,2::numeric,6),('execute',3,8),('guard',0,10),('quick',0,12))x(id,mult,cd) where x.id=p_skill_id;if not found then raise exception 'COMBAT_SKILL_INVALID';end if;
 v_left:=coalesce((v_combat.cooldowns->>p_skill_id)::int,0);if v_left>0 then raise exception 'COMBAT_SKILL_COOLDOWN';end if;
 if p_skill_id='execute' and v_combat.monster_hp::numeric/v_combat.monster_max_hp>.35 then raise exception 'COMBAT_SKILL_CONDITION';end if;if p_skill_id='guard' and v_combat.player_hp::numeric/v_combat.player_max_hp>.7 then raise exception 'COMBAT_SKILL_CONDITION';end if;
 update private.online_combat_states set cooldowns=(select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') from jsonb_each(v_combat.cooldowns))||jsonb_build_object(p_skill_id,v_cd),guard_turns=case when p_skill_id='guard' then 4 else guard_turns end where user_id=v_user returning * into v_combat;
 if p_skill_id in('guard','quick') then update private.online_combat_states set action_nonce=p_action_nonce,turn_no=turn_no+1,updated_at=now() where user_id=v_user;return jsonb_build_object('damage',0,'monsterHp',v_combat.monster_hp,'playerHp',v_combat.player_hp,'phase','PLAYER_TURN','confirmedKills',v_run.confirmed_kills,'actionNonce',p_action_nonce);end if;
 v_attack:=private.combat_effective_attack(v_combat);v_damage:=greatest(1,round(v_attack*v_mult*v_combat.skill_power-v_combat.monster_defense)::bigint);return private.finish_server_player_action(v_user,v_run,v_combat,p_action_nonce,v_damage);
end $$;
revoke all on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) from public,anon;
grant execute on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) to authenticated;
revoke all on function public.apply_online_skill(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_skill(uuid,bigint,text,text,bigint,text) to authenticated;
