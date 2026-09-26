-- v0.1.50 authoritative combat state foundation.
-- Server owns the canonical HP/monster HP/turn state for online expeditions.
create table if not exists private.online_combat_states(
 user_id uuid primary key references auth.users(id) on delete cascade,
 run_id uuid not null,
 encounter_index bigint not null default 1,
 monster_id text not null,
 player_hp bigint not null check(player_hp>=0),
 player_max_hp bigint not null check(player_max_hp>0),
 monster_hp bigint not null check(monster_hp>=0),
 monster_max_hp bigint not null check(monster_max_hp>0),
 monster_attack numeric not null check(monster_attack>=0),
 monster_defense numeric not null check(monster_defense>=0),
 turn_no bigint not null default 1,
 phase text not null default 'PLAYER_TURN' check(phase in('PLAYER_TURN','MONSTER_TURN','DEFEATED','PLAYER_DEAD')),
 action_nonce bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table private.online_combat_states enable row level security;
revoke all on private.online_combat_states from public,anon,authenticated;

create or replace function private.server_monster_hp(p_floor integer)
returns bigint language sql immutable set search_path='' as $$
 select round(42+(greatest(1,least(10,p_floor))-1)*10)::bigint
$$;
create or replace function private.server_monster_attack(p_floor integer)
returns numeric language sql immutable set search_path='' as $$
 select 11+(greatest(1,least(10,p_floor))-1)*2.3
$$;
create or replace function private.server_monster_defense(p_floor integer)
returns numeric language sql immutable set search_path='' as $$
 select 1+(greatest(1,least(10,p_floor))-1)*1.1
$$;

create or replace function public.begin_online_combat_state(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_monster_id text,p_player_hp bigint,p_player_max_hp bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_hp bigint;v_existing private.online_combat_states%rowtype;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 if p_monster_id is null or length(p_monster_id)<1 or length(p_monster_id)>100 then raise exception 'EXPEDITION_MONSTER_INVALID';end if;
 if p_player_max_hp<1 or p_player_max_hp>1000000 or p_player_hp<1 or p_player_hp>p_player_max_hp then raise exception 'COMBAT_PLAYER_HP_INVALID';end if;
 select * into v_existing from private.online_combat_states where user_id=v_user for update;
 if found and v_existing.run_id=v_run.run_id and v_existing.phase not in('DEFEATED','PLAYER_DEAD') then
  return jsonb_build_object('encounterIndex',v_existing.encounter_index,'monsterId',v_existing.monster_id,'playerHp',v_existing.player_hp,'playerMaxHp',v_existing.player_max_hp,'monsterHp',v_existing.monster_hp,'monsterMaxHp',v_existing.monster_max_hp,'turn',v_existing.turn_no,'phase',v_existing.phase,'actionNonce',v_existing.action_nonce);
 end if;
 v_hp:=private.server_monster_hp(v_run.floor);
 insert into private.online_combat_states(user_id,run_id,encounter_index,monster_id,player_hp,player_max_hp,monster_hp,monster_max_hp,monster_attack,monster_defense,turn_no,phase,action_nonce,updated_at)
 values(v_user,v_run.run_id,coalesce(v_existing.encounter_index,0)+1,p_monster_id,p_player_hp,p_player_max_hp,v_hp,v_hp,private.server_monster_attack(v_run.floor),private.server_monster_defense(v_run.floor),1,'PLAYER_TURN',0,now())
 on conflict(user_id) do update set run_id=excluded.run_id,encounter_index=excluded.encounter_index,monster_id=excluded.monster_id,player_hp=excluded.player_hp,player_max_hp=excluded.player_max_hp,monster_hp=excluded.monster_hp,monster_max_hp=excluded.monster_max_hp,monster_attack=excluded.monster_attack,monster_defense=excluded.monster_defense,turn_no=1,phase='PLAYER_TURN',action_nonce=0,updated_at=now();
 return jsonb_build_object('encounterIndex',coalesce(v_existing.encounter_index,0)+1,'monsterId',p_monster_id,'playerHp',p_player_hp,'playerMaxHp',p_player_max_hp,'monsterHp',v_hp,'monsterMaxHp',v_hp,'turn',1,'phase','PLAYER_TURN','actionNonce',0);
end $$;

create or replace function public.apply_online_basic_attack(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_action_nonce bigint,p_attack numeric
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_combat private.online_combat_states%rowtype;v_damage bigint;v_retaliation bigint;v_next_kill bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 select * into v_combat from private.online_combat_states where user_id=v_user for update;
 if not found or v_combat.run_id<>v_run.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;
 if v_combat.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;
 if p_action_nonce<>v_combat.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 if p_attack<1 or p_attack>100000 then raise exception 'COMBAT_ATTACK_INVALID';end if;
 v_damage:=greatest(1,round(p_attack-v_combat.monster_defense)::bigint);
 v_combat.monster_hp:=greatest(0,v_combat.monster_hp-v_damage);
 if v_combat.monster_hp=0 then
  v_next_kill:=v_run.confirmed_kills+1;
  insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
   values(v_user,v_run.run_id,v_next_kill,v_combat.monster_id);
  update private.online_expeditions set confirmed_kills=v_next_kill,last_confirmed_kill_at=now() where user_id=v_user;
  update private.online_combat_states set monster_hp=0,phase='DEFEATED',action_nonce=p_action_nonce,updated_at=now() where user_id=v_user;
  return jsonb_build_object('damage',v_damage,'monsterHp',0,'playerHp',v_combat.player_hp,'phase','DEFEATED','confirmedKills',v_next_kill,'actionNonce',p_action_nonce);
 end if;
 v_retaliation:=greatest(1,round(v_combat.monster_attack)::bigint);
 v_combat.player_hp:=greatest(0,v_combat.player_hp-v_retaliation);
 update private.online_combat_states set monster_hp=v_combat.monster_hp,player_hp=v_combat.player_hp,turn_no=turn_no+1,phase=case when v_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end,action_nonce=p_action_nonce,updated_at=now() where user_id=v_user;
 return jsonb_build_object('damage',v_damage,'monsterHp',v_combat.monster_hp,'retaliation',v_retaliation,'playerHp',v_combat.player_hp,'phase',case when v_combat.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end,'confirmedKills',v_run.confirmed_kills,'actionNonce',p_action_nonce);
end $$;

revoke all on function private.server_monster_hp(integer) from public,anon,authenticated;
revoke all on function private.server_monster_attack(integer) from public,anon,authenticated;
revoke all on function private.server_monster_defense(integer) from public,anon,authenticated;
revoke all on function public.begin_online_combat_state(uuid,bigint,text,text,text,bigint,bigint) from public,anon;
revoke all on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) from public,anon;
grant execute on function public.begin_online_combat_state(uuid,bigint,text,text,text,bigint,bigint) to authenticated;
grant execute on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) to authenticated;
