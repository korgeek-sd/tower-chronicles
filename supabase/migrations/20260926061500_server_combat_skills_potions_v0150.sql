-- v0.1.50 authoritative combat stats, skills and potions.
alter table private.online_combat_states
 add column if not exists player_attack numeric not null default 1,
 add column if not exists player_defense numeric not null default 0,
 add column if not exists potion_lesser integer not null default 0,
 add column if not exists potion_standard integer not null default 0,
 add column if not exists potion_greater integer not null default 0,
 add column if not exists potion_supreme integer not null default 0,
 add column if not exists cooldowns jsonb not null default '{}'::jsonb;

create or replace function private.combat_equipment_stats(p_user uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_eq jsonb:=p_payload->'expedition'->'equipment';v_items jsonb:=coalesce(p_payload->'items','[]'::jsonb);v_weapon jsonb;v_armor jsonb;v_boots jsonb;v_kind text:='sword';v_mult numeric;v_attack numeric:=8;v_def numeric:=3;v_hp numeric:=180;
begin
 select i into v_weapon from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'weapon' limit 1;
 select i into v_armor from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'armor' limit 1;
 select i into v_boots from jsonb_array_elements(v_items)i where i->>'id'=v_eq->>'boots' limit 1;
 if v_weapon is not null and v_weapon->>'kind' in('sword','dagger','bow','staff') then v_kind:=v_weapon->>'kind';end if;
 -- Enhancement multiplier mirrors current +0..+3 equipment tuning: 1 + 0.1 per level.
 v_mult:=1+greatest(0,least(3,coalesce((v_weapon->>'enhancement')::int,0)))*0.1;
 v_attack:=v_attack+(case v_kind when 'sword' then 10 when 'dagger' then 7 when 'bow' then 12 else 6 end)
  *case when v_weapon->>'id'='starter' then .55 else greatest(1,least(5,coalesce((v_weapon->>'tier')::int,1))) end*v_mult;
 v_def:=v_def+(case v_kind when 'sword' then 4 when 'bow' then 1 else 0 end)
  *case when v_weapon->>'id'='starter' then .55 else greatest(1,least(5,coalesce((v_weapon->>'tier')::int,1))) end*v_mult;
 if v_armor is not null and v_armor->>'kind'='armor' then
  v_mult:=1+greatest(0,least(3,coalesce((v_armor->>'enhancement')::int,0)))*0.1;
  v_hp:=v_hp+55*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
  v_def:=v_def+7*greatest(1,least(5,coalesce((v_armor->>'tier')::int,1)))*v_mult;
 end if;
 if v_boots is not null and v_boots->>'kind'='boots' then
  v_mult:=1+greatest(0,least(3,coalesce((v_boots->>'enhancement')::int,0)))*0.1;
  v_hp:=v_hp+15*greatest(1,least(5,coalesce((v_boots->>'tier')::int,1)))*v_mult;
 end if;
 return jsonb_build_object('attack',v_attack,'defense',v_def,'hp',round(v_hp),'weapon',v_kind);
end $$;
revoke all on function private.combat_equipment_stats(uuid,jsonb) from public,anon,authenticated;

create or replace function public.begin_online_combat_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_monster_id text,p_player_hp bigint,p_player_max_hp bigint
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_save public.game_saves%rowtype;v_stats jsonb;v_hp bigint;v_existing private.online_combat_states%rowtype;v_bag jsonb;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 select * into v_save from public.game_saves where user_id=v_user for update;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if p_monster_id is null or length(p_monster_id)<1 or length(p_monster_id)>100 then raise exception 'EXPEDITION_MONSTER_INVALID';end if;
 v_stats:=private.combat_equipment_stats(v_user,v_save.payload);v_hp:=private.server_monster_hp(v_run.floor);v_bag:=coalesce(v_save.payload->'expedition'->'bag','{}'::jsonb);
 select * into v_existing from private.online_combat_states where user_id=v_user for update;
 if found and v_existing.run_id=v_run.run_id and v_existing.phase not in('DEFEATED','PLAYER_DEAD') then return jsonb_build_object('encounterIndex',v_existing.encounter_index,'monsterId',v_existing.monster_id,'playerHp',v_existing.player_hp,'playerMaxHp',v_existing.player_max_hp,'monsterHp',v_existing.monster_hp,'monsterMaxHp',v_existing.monster_max_hp,'turn',v_existing.turn_no,'phase',v_existing.phase,'actionNonce',v_existing.action_nonce);end if;
 insert into private.online_combat_states(user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,player_attack,player_defense,monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,potion_lesser,potion_standard,potion_greater,potion_supreme,cooldowns,updated_at)
 values(v_user,v_run.run_id,coalesce(v_existing.encounter_index,0)+1,p_monster_id,(v_stats->>'hp')::bigint,(v_stats->>'hp')::bigint,(v_stats->>'attack')::numeric,(v_stats->>'defense')::numeric,v_hp,v_hp,private.server_monster_attack(v_run.floor),private.server_monster_defense(v_run.floor),1,'PLAYER_TURN',0,coalesce((v_bag->>'healing_lesser')::int,0),coalesce((v_bag->>'healing_standard')::int,0),coalesce((v_bag->>'healing_greater')::int,0),coalesce((v_bag->>'healing_supreme')::int,0),'{}',now())
 on conflict(user_id) do update set run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,player_attack=excluded.player_attack,player_defense=excluded.player_defense,monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,turn_no=1,phase='PLAYER_TURN',action_nonce=0,potion_lesser=excluded.potion_lesser,potion_standard=excluded.potion_standard,potion_greater=excluded.potion_greater,potion_supreme=excluded.potion_supreme,cooldowns='{}',updated_at=now();
 return jsonb_build_object('encounterIndex',coalesce(v_existing.encounter_index,0)+1,'monsterId',p_monster_id,'playerHp',(v_stats->>'hp')::bigint,'playerMaxHp',(v_stats->>'hp')::bigint,'monsterHp',v_hp,'monsterMaxHp',v_hp,'turn',1,'phase','PLAYER_TURN','actionNonce',0);
end $$;

create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_ret bigint;v_kill bigint;
begin
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-p_damage);
 if p_combat.monster_hp=0 then
  v_kill:=p_run.confirmed_kills+1;
  insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,v_kill,p_combat.monster_id);
  update private.online_expeditions set confirmed_kills=v_kill,last_confirmed_kill_at=now() where user_id=p_user;
  update private.online_combat_states set monster_hp=0,phase='DEFEATED',action_nonce=p_nonce,updated_at=now() where user_id=p_user;
  return jsonb_build_object('damage',p_damage,'monsterHp',0,'playerHp',p_combat.player_hp,'phase','DEFEATED','confirmedKills',v_kill,'actionNonce',p_nonce);
 end if;
 v_ret:=greatest(1,round(p_combat.monster_attack-p_combat.player_defense)::bigint);p_combat.player_hp:=greatest(0,p_combat.player_hp-v_ret);
 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,turn_no=turn_no+1,phase=case when p_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',p_damage,'monsterHp',p_combat.monster_hp,'retaliation',v_ret,'playerHp',p_combat.player_hp,'phase',case when p_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end,'confirmedKills',p_run.confirmed_kills,'actionNonce',p_nonce);
end $$;
revoke all on function private.finish_server_player_action(uuid,private.online_expeditions,private.online_combat_states,bigint,bigint) from public,anon,authenticated;

create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_damage bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;if v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 v_damage:=greatest(1,round(v_combat.player_attack-v_combat.monster_defense)::bigint);return private.finish_server_player_action(v_user,v_run,v_combat,p_action_nonce,v_damage);
end $$;

create or replace function public.apply_online_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_skill_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_mult numeric;v_cd int;v_left int;v_damage bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id or v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 select x.mult,x.cd into v_mult,v_cd from (values('heavy'::text,2::numeric,6),('execute',3,8))x(id,mult,cd) where x.id=p_skill_id;if not found then raise exception 'COMBAT_SKILL_INVALID';end if;
 v_left:=coalesce((v_combat.cooldowns->>p_skill_id)::int,0);if v_left>0 then raise exception 'COMBAT_SKILL_COOLDOWN';end if;if p_skill_id='execute' and v_combat.monster_hp::numeric/v_combat.monster_max_hp>.35 then raise exception 'COMBAT_SKILL_CONDITION';end if;
 update private.online_combat_states set cooldowns=(select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') from jsonb_each(v_combat.cooldowns))||jsonb_build_object(p_skill_id,v_cd) where user_id=v_user returning * into v_combat;
 v_damage:=greatest(1,round(v_combat.player_attack*v_mult-v_combat.monster_defense)::bigint);return private.finish_server_player_action(v_user,v_run,v_combat,p_action_nonce,v_damage);
end $$;

create or replace function public.apply_online_potion(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_potion text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_ratio numeric;v_count int;v_heal bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into v_run from private.online_expeditions where user_id=v_user for update;select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' or v_combat.run_id<>v_run.run_id or v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 select x.ratio,case p_potion when 'healing_lesser' then v_combat.potion_lesser when 'healing_standard' then v_combat.potion_standard when 'healing_greater' then v_combat.potion_greater else v_combat.potion_supreme end into v_ratio,v_count from (values('healing_lesser'::text,.2::numeric),('healing_standard',.35),('healing_greater',.5),('healing_supreme',.75))x(id,ratio) where x.id=p_potion;
 if not found or v_count<1 or v_combat.player_hp>=v_combat.player_max_hp then raise exception 'COMBAT_POTION_INVALID';end if;
 v_heal:=round(v_combat.player_max_hp*v_ratio);v_combat.player_hp:=least(v_combat.player_max_hp,v_combat.player_hp+v_heal);
 update private.online_combat_states set player_hp=v_combat.player_hp,potion_lesser=potion_lesser-case when p_potion='healing_lesser' then 1 else 0 end,potion_standard=potion_standard-case when p_potion='healing_standard' then 1 else 0 end,potion_greater=potion_greater-case when p_potion='healing_greater' then 1 else 0 end,potion_supreme=potion_supreme-case when p_potion='healing_supreme' then 1 else 0 end,action_nonce=p_action_nonce,updated_at=now() where user_id=v_user;
 return jsonb_build_object('heal',v_heal,'playerHp',v_combat.player_hp,'monsterHp',v_combat.monster_hp,'phase','PLAYER_TURN','confirmedKills',v_run.confirmed_kills,'actionNonce',p_action_nonce);
end $$;

revoke all on function public.apply_online_skill(uuid,bigint,text,text,bigint,text) from public,anon;
revoke all on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_skill(uuid,bigint,text,text,bigint,text) to authenticated;
grant execute on function public.apply_online_potion(uuid,bigint,text,text,bigint,text) to authenticated;
