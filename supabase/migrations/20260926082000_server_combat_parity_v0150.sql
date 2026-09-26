-- v0.1.50 parity corrections for direct-hit math and effect turn timing.
alter table private.online_combat_states
 add column if not exists player_turn bigint not null default 1,
 add column if not exists monster_turn bigint not null default 0,
 add column if not exists player_shield_hits integer not null default 0,
 add column if not exists monster_shield_hits integer not null default 0,
 add column if not exists monster_cooldowns jsonb not null default '{}'::jsonb,
 add column if not exists monster_prepared_action text,
 add column if not exists monster_reactive_action text;

create or replace function private.effect_periodic_delta(p_effects jsonb,p_max_hp bigint,p_turn bigint)
returns bigint language sql immutable set search_path='' as $$
 select coalesce(round(sum(case x->>'behavior'
  when 'PERIODIC_DAMAGE' then -coalesce((x->>'amount')::numeric,0)*greatest(1,coalesce((x->>'stacks')::int,1))
  when 'PERIODIC_HEAL' then p_max_hp*coalesce((x->>'amount')::numeric,0)*greatest(1,coalesce((x->>'stacks')::int,1))
  else 0 end)),0)::bigint
 from jsonb_array_elements(coalesce(p_effects,'[]'::jsonb))x
 where coalesce((x->>'duration')::int,0)>0 and coalesce((x->>'createdTurn')::bigint,-1)<>p_turn
$$;
create or replace function private.effect_tick(p_effects jsonb,p_turn bigint)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(case when coalesce((x->>'createdTurn')::bigint,-1)=p_turn then x else x||jsonb_build_object('duration',(x->>'duration')::int-1) end)
 filter(where coalesce((x->>'createdTurn')::bigint,-1)=p_turn or (x->>'duration')::int-1>0),'[]'::jsonb)
 from jsonb_array_elements(coalesce(p_effects,'[]'::jsonb))x
$$;
revoke all on function private.effect_periodic_delta(jsonb,bigint,bigint) from public,anon,authenticated;
revoke all on function private.effect_tick(jsonb,bigint) from public,anon,authenticated;

create or replace function private.combat_damage(p_attack numeric,p_defense numeric,p_multiplier numeric default 1,p_critical numeric default 1,p_received numeric default 1)
returns bigint language sql immutable set search_path='' as $$
 select floor(greatest(1,p_attack*p_multiplier-p_defense)*p_critical*greatest(0,p_received))::bigint
$$;
revoke all on function private.combat_damage(numeric,numeric,numeric,numeric,numeric) from public,anon,authenticated;

create or replace function public.apply_online_basic_attack(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_attack numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;total bigint:=0;i int;mult numeric;crit numeric;hit bigint;def numeric;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id then raise exception 'COMBAT_SERVER_STATE_MISSING';end if;
 if c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;
 if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 def:=c.monster_defense*greatest(.05,1+private.effect_modifier(c.monster_effects,'defense'));
 for i in 1..c.basic_hits loop
  exit when total>=c.monster_hp+c.monster_shield;
  mult:=case when c.basic_hits=2 then .55 else 1 end;
  crit:=case when private.server_roll(c.rng_seed,c.encounter_index,p_action_nonce,i)<c.crit_chance then c.crit_damage else 1 end;
  hit:=private.combat_damage(private.combat_effective_attack(c),def,mult,crit,greatest(0,1+private.effect_modifier(c.monster_effects,'receivedDamage')));
  total:=total+hit;
 end loop;
 return private.finish_server_player_action(u,r,c,p_action_nonce,total);
end $$;
revoke all on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) from public,anon;
grant execute on function public.apply_online_basic_attack(uuid,bigint,text,text,bigint,numeric) to authenticated;
