-- v0.1.50 online combat action ledger.
-- This closes the direct "claim a kill" API: a kill can only be confirmed after
-- an ordered server-accepted player action for the active run.
create table if not exists private.online_combat_actions(
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null,
 action_index bigint not null,
 action_kind text not null check(action_kind in('BASIC','SKILL','POTION','FLEE','REVIVAL')),
 action_ref text,
 accepted_at timestamptz not null default now(),
 consumed_by_kill bigint,
 primary key(user_id,run_id,action_index)
);
alter table private.online_combat_actions enable row level security;
revoke all on private.online_combat_actions from public,anon,authenticated;

alter table private.online_expeditions
 add column if not exists confirmed_actions bigint not null default 0,
 add column if not exists last_confirmed_action_at timestamptz;

create or replace function public.record_online_combat_action(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_action_index bigint,p_action_kind text,p_action_ref text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_next bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 v_next:=v_run.confirmed_actions+1;
 if p_action_index<>v_next then
  if exists(select 1 from private.online_combat_actions where user_id=v_user and run_id=v_run.run_id and action_index=p_action_index)
   then return jsonb_build_object('confirmedActions',v_run.confirmed_actions);end if;
  raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';
 end if;
 if p_action_kind not in('BASIC','SKILL','POTION','FLEE','REVIVAL') then raise exception 'COMBAT_ACTION_INVALID';end if;
 if p_action_ref is not null and length(p_action_ref)>100 then raise exception 'COMBAT_ACTION_INVALID';end if;
 -- Human input cannot legitimately create a burst of distinct player turns in a few milliseconds.
 if v_run.last_confirmed_action_at is not null and now()-v_run.last_confirmed_action_at<interval '80 milliseconds'
  then raise exception 'COMBAT_ACTION_RATE_INVALID';end if;
 insert into private.online_combat_actions(user_id,run_id,action_index,action_kind,action_ref)
 values(v_user,v_run.run_id,v_next,p_action_kind,nullif(p_action_ref,''));
 update private.online_expeditions set confirmed_actions=v_next,last_confirmed_action_at=now() where user_id=v_user;
 return jsonb_build_object('confirmedActions',v_next);
end $$;
revoke all on function public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text) from public,anon;
grant execute on function public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text) to authenticated;

create or replace function public.confirm_online_expedition_kill(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_monster_id text,p_client_kill_index bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_user uuid;v_run private.online_expeditions%rowtype;v_next bigint;v_action bigint;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into v_run from private.online_expeditions where user_id=v_user for update;
 if not found or v_run.status<>'ACTIVE' then raise exception 'EXPEDITION_SERVER_RUN_MISSING';end if;
 v_next:=v_run.confirmed_kills+1;
 if p_client_kill_index<>v_next then
  if exists(select 1 from private.online_expedition_kills where user_id=v_user and run_id=v_run.run_id and kill_index=p_client_kill_index)
   then return jsonb_build_object('confirmedKills',v_run.confirmed_kills);end if;
  raise exception 'EXPEDITION_KILL_SEQUENCE_INVALID';
 end if;
 if p_monster_id is null or length(p_monster_id)<1 or length(p_monster_id)>100 then raise exception 'EXPEDITION_MONSTER_INVALID';end if;
 select max(action_index) into v_action from private.online_combat_actions
 where user_id=v_user and run_id=v_run.run_id and consumed_by_kill is null
 and action_kind in('BASIC','SKILL');
 if v_action is null then raise exception 'EXPEDITION_KILL_WITHOUT_SERVER_ACTION';end if;
 insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
 values(v_user,v_run.run_id,v_next,p_monster_id);
 update private.online_combat_actions set consumed_by_kill=v_next
 where user_id=v_user and run_id=v_run.run_id and consumed_by_kill is null and action_index<=v_action;
 update private.online_expeditions set confirmed_kills=v_next,last_confirmed_kill_at=now() where user_id=v_user;
 return jsonb_build_object('confirmedKills',v_next);
end $$;

create index if not exists online_combat_actions_unconsumed_idx
 on private.online_combat_actions(user_id,run_id,action_index) where consumed_by_kill is null;
