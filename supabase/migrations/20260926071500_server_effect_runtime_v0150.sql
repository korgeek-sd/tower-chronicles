-- v0.1.50 authoritative combat effect runtime foundation.
alter table private.online_combat_states
 add column if not exists player_effects jsonb not null default '[]'::jsonb,
 add column if not exists monster_effects jsonb not null default '[]'::jsonb,
 add column if not exists player_shield numeric not null default 0,
 add column if not exists monster_shield numeric not null default 0;

create or replace function private.effect_modifier(p_effects jsonb,p_stat text)
returns numeric language sql immutable set search_path='' as $$
 select coalesce(sum(coalesce((x->>'multiplier')::numeric,0)*greatest(1,coalesce((x->>'stacks')::int,1))),0)
 from jsonb_array_elements(coalesce(p_effects,'[]'::jsonb))x
 where coalesce((x->>'duration')::int,0)>0 and x->>'stat'=p_stat
$$;
create or replace function private.effect_periodic_delta(p_effects jsonb,p_max_hp bigint)
returns bigint language sql immutable set search_path='' as $$
 select coalesce(round(sum(case x->>'behavior' when 'PERIODIC_DAMAGE' then -coalesce((x->>'amount')::numeric,0)*greatest(1,coalesce((x->>'stacks')::int,1)) when 'PERIODIC_HEAL' then p_max_hp*coalesce((x->>'amount')::numeric,0)*greatest(1,coalesce((x->>'stacks')::int,1)) else 0 end)),0)::bigint
 from jsonb_array_elements(coalesce(p_effects,'[]'::jsonb))x where coalesce((x->>'duration')::int,0)>0 and coalesce((x->>'createdTurn')::bigint,-1)<>coalesce((x->>'currentTurn')::bigint,-2)
$$;
create or replace function private.effect_tick(p_effects jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg((x-'currentTurn')||jsonb_build_object('duration',(x->>'duration')::int-1)) filter(where (x->>'duration')::int-1>0),'[]'::jsonb) from jsonb_array_elements(coalesce(p_effects,'[]'::jsonb))x
$$;
revoke all on function private.effect_modifier(jsonb,text) from public,anon,authenticated;
revoke all on function private.effect_periodic_delta(jsonb,bigint) from public,anon,authenticated;
revoke all on function private.effect_tick(jsonb) from public,anon,authenticated;

create or replace function private.combat_effective_attack(p_combat private.online_combat_states)
returns numeric language sql immutable set search_path='' as $$
 select p_combat.player_attack
 * greatest(.05,1+private.effect_modifier(p_combat.player_effects,'attack'))
 * case when p_combat.accessory_passive='berserker' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.40 then 1+p_combat.accessory_value else 1 end
$$;

create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ret bigint;v_kill bigint;v_phase text;v_heal bigint:=0;v_received_mult numeric:=1;v_absorb numeric;v_monster_delta bigint;v_player_delta bigint;v_effective_def numeric;
begin
 -- monster shield absorbs direct damage before HP.
 v_absorb:=least(p_combat.monster_shield,p_damage);p_combat.monster_shield:=p_combat.monster_shield-v_absorb;p_damage:=p_damage-v_absorb;
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-p_damage);
 if p_combat.accessory_passive='vampire' and p_damage>0 then v_heal:=floor(p_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+v_heal);end if;
 if p_combat.monster_hp=0 then
  v_kill:=p_run.confirmed_kills+1;insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,v_kill,p_combat.monster_id);
  update private.online_expeditions set confirmed_kills=v_kill,last_confirmed_kill_at=now() where user_id=p_user;
  update private.online_combat_states set monster_hp=0,monster_shield=p_combat.monster_shield,player_hp=p_combat.player_hp,phase='DEFEATED',action_nonce=p_nonce,updated_at=now() where user_id=p_user;
  return jsonb_build_object('damage',p_damage,'absorbed',v_absorb,'healing',v_heal,'monsterHp',0,'playerHp',p_combat.player_hp,'phase','DEFEATED','confirmedKills',v_kill,'actionNonce',p_nonce);
 end if;
 if p_combat.guard_turns>0 then v_received_mult:=v_received_mult*.6;end if;
 v_received_mult:=v_received_mult*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'));
 if p_combat.accessory_passive='unyielding' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35 then v_received_mult:=v_received_mult*(1-p_combat.accessory_value);end if;
 v_effective_def:=p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense'));
 v_ret:=greatest(1,round((p_combat.monster_attack-v_effective_def)*v_received_mult)::bigint);
 v_absorb:=least(p_combat.player_shield,v_ret);p_combat.player_shield:=p_combat.player_shield-v_absorb;v_ret:=v_ret-v_absorb;p_combat.player_hp:=greatest(0,p_combat.player_hp-v_ret);
 -- end-of-turn DOT/HOT, then durations tick.
 v_player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp);v_monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp);
 p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+v_player_delta));p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+v_monster_delta));
 p_combat.player_effects:=private.effect_tick(p_combat.player_effects);p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects);
 if p_combat.player_hp=0 and p_combat.revival_count>0 then v_phase:='PLAYER_DEAD';p_combat.pending_revival:=true;else v_phase:=case when p_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end;end if;
 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,turn_no=turn_no+1,guard_turns=greatest(0,guard_turns-1),phase=v_phase,pending_revival=p_combat.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',p_damage,'retaliation',v_ret,'periodicPlayer',v_player_delta,'periodicMonster',v_monster_delta,'monsterHp',p_combat.monster_hp,'playerHp',p_combat.player_hp,'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,'phase',v_phase,'pendingRevival',p_combat.pending_revival,'confirmedKills',p_run.confirmed_kills,'actionNonce',p_nonce);
end $$;
