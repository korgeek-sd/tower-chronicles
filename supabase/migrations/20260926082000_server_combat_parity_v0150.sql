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


create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare direct_damage bigint:=p_damage;monster_absorb numeric:=0;player_absorb numeric:=0;heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;received numeric:=1;player_def numeric;kill_no bigint;phase text:='PLAYER_TURN';
begin
 -- Resolve the complete player action first. Hit-count shields consume one hit at the packet boundary.
 if p_combat.monster_shield_hits>0 and direct_damage>0 then
  p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
 else
  monster_absorb:=least(p_combat.monster_shield,direct_damage);p_combat.monster_shield:=p_combat.monster_shield-monster_absorb;direct_damage:=direct_damage-monster_absorb;
 end if;
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
 if p_combat.accessory_passive='vampire' and direct_damage>0 then heal:=floor(direct_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);end if;

 if p_combat.monster_hp>0 then
  -- Local engine ends the PLAYER turn before the monster acts.
  player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
  if player_delta<0 and p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_delta:=0;
  elsif player_delta<0 and p_combat.player_shield>0 then player_absorb:=least(p_combat.player_shield,-player_delta);p_combat.player_shield:=p_combat.player_shield-player_absorb;player_delta:=player_delta+player_absorb;end if;
  p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));
  p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
  p_combat.monster_turn:=p_combat.monster_turn+1;
  received:=greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'));
  if p_combat.accessory_passive='unyielding' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35 then received:=received*(1-p_combat.accessory_value);end if;
  player_def:=p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense'));
  ret:=private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),player_def,1,1,received);
  if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb+ret;ret:=0;
  else player_absorb:=player_absorb+least(p_combat.player_shield,ret);p_combat.player_shield:=greatest(0,p_combat.player_shield-ret);ret:=greatest(0,ret-player_absorb);end if;
  p_combat.player_hp:=greatest(0,p_combat.player_hp-ret);

  monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
  if monster_delta<0 and p_combat.monster_shield_hits>0 then p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_delta:=0;
  elsif monster_delta<0 and p_combat.monster_shield>0 then monster_absorb:=monster_absorb+least(p_combat.monster_shield,-monster_delta);p_combat.monster_shield:=greatest(0,p_combat.monster_shield+monster_delta);monster_delta:=least(0,monster_delta+monster_absorb);end if;
  p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));
  p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);
 end if;

 if p_combat.monster_hp=0 then
  kill_no:=p_run.confirmed_kills+1;
  insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,kill_no,p_combat.monster_id) on conflict do nothing;
  update private.online_expeditions set confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),boss_progress=case when private.server_boss_id(tower,floor)=p_combat.monster_id then boss_progress else boss_progress+1 end,boss_defeated=case when private.server_boss_id(tower,floor)=p_combat.monster_id then true else boss_defeated end,run_version=run_version+1 where user_id=p_user;
  phase:='DEFEATED';
 elsif p_combat.player_hp=0 then phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else p_combat.player_turn:=p_combat.player_turn+1;phase:='PLAYER_TURN';end if;

 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,turn_no=turn_no+1,phase=phase,pending_revival=p_combat.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',direct_damage,'absorbed',monster_absorb,'healing',heal,'retaliation',ret,'periodicPlayer',player_delta,'periodicMonster',monster_delta,'monsterHp',p_combat.monster_hp,'playerHp',p_combat.player_hp,'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,'phase',phase,'pendingRevival',p_combat.pending_revival,'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'actionNonce',p_nonce);
end $$;
