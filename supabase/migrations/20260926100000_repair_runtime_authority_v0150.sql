-- v0.1.50 final authority repair: install the canonical kill ledger dependency
-- even on production databases that skipped the historical 05:20 migration,
-- and make monster direct hits resolve one hit at a time.

alter table private.online_expeditions
 add column if not exists confirmed_kills bigint not null default 0,
 add column if not exists reward_seed bigint not null default floor(random()*2147483647)::bigint,
 add column if not exists last_confirmed_kill_at timestamptz;

create table if not exists private.online_expedition_kills(
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null,
 kill_index bigint not null,
 monster_id text not null,
 confirmed_at timestamptz not null default now(),
 primary key(user_id,run_id,kill_index)
);
alter table private.online_expedition_kills enable row level security;
revoke all on private.online_expedition_kills from public,anon,authenticated;
create index if not exists online_expedition_kills_run_idx
 on private.online_expedition_kills(user_id,run_id,confirmed_at);

create or replace function private.expedition_ticket_drop(p_seed bigint,p_kill bigint)
returns boolean language sql immutable set search_path='' as $$
 select ((abs(hashtextextended(p_seed::text||':'||p_kill::text,0)) % 1000000)::numeric / 1000000) < 0.4
$$;
revoke all on function private.expedition_ticket_drop(bigint,bigint) from public,anon,authenticated;

alter table private.online_combat_states
 add column if not exists return_authorized boolean not null default false;

create or replace function private.server_apply_monster_hit(
 p_combat private.online_combat_states,
 p_multiplier numeric,
 p_nonce bigint,
 p_hit_index integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 incoming bigint:=0;actual bigint:=0;absorbed numeric:=0;step_absorb numeric:=0;
 received numeric:=1;prepared boolean:=false;counter bigint:=0;
begin
 received:=greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'));
 if p_combat.accessory_passive='unyielding'
    and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35
 then received:=received*(1-p_combat.accessory_value);end if;
 received:=received*private.server_job_received_multiplier(p_combat);
 prepared:=exists(
   select 1 from jsonb_array_elements(coalesce(p_combat.player_effects,'[]'::jsonb)) e
   where e->>'effectId'='duelist_counter_stance'
 );
 incoming:=private.combat_damage(
   p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),
   p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense')),
   p_multiplier,1,received
 );
 actual:=incoming;
 if p_combat.player_shield_hits>0 then
   p_combat.player_shield_hits:=p_combat.player_shield_hits-1;absorbed:=actual;actual:=0;
 elsif p_combat.player_shield>0 then
   step_absorb:=least(p_combat.player_shield,actual);
   absorbed:=step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;actual:=actual-step_absorb;
 end if;
 p_combat.player_hp:=greatest(0,p_combat.player_hp-actual);
 p_combat:=private.server_after_player_damage(p_combat,actual,p_nonce*1000+p_hit_index);

 if prepared then
   p_combat.player_effects:=(
     select coalesce(jsonb_agg(e),'[]'::jsonb)
     from jsonb_array_elements(coalesce(p_combat.player_effects,'[]'::jsonb)) e
     where e->>'effectId'<>'duelist_counter_stance'
   );
   if p_combat.monster_hp>0 then
     counter:=private.combat_damage(
       private.combat_effective_attack(p_combat),
       p_combat.monster_defense*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'defense')),
       1.8*p_combat.skill_power,1,
       greatest(0,1+private.effect_modifier(p_combat.monster_effects,'receivedDamage'))
     );
     if p_combat.monster_shield_hits>0 then
       p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;counter:=0;
     elsif p_combat.monster_shield>0 then
       step_absorb:=least(p_combat.monster_shield,counter);
       p_combat.monster_shield:=p_combat.monster_shield-step_absorb;counter:=counter-step_absorb;
     end if;
     p_combat.monster_hp:=greatest(0,p_combat.monster_hp-counter);
   end if;
 end if;
 return jsonb_build_object('state',to_jsonb(p_combat),'incoming',incoming,'damage',actual,'absorbed',absorbed,'counterDamage',counter);
end $$;
revoke all on function private.server_apply_monster_hit(private.online_combat_states,numeric,bigint,integer)
 from public,anon,authenticated;

create or replace function private.resolve_server_monster_turn_v2(
 p_combat private.online_combat_states,p_nonce bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 d jsonb:=private.server_monster_decision_v2(p_combat);kind text:=d->>'kind';id text:=d->>'id';
 mult numeric:=coalesce((d->>'multiplier')::numeric,1);hits int:=greatest(1,coalesce((d->>'hits')::int,1));
 cd int:=coalesce((d->>'cooldown')::int,0);raw bigint:=0;absorbed numeric:=0;counter bigint:=0;
 nextcd jsonb;effectid text:=d->>'effect';self_effect text:=d->>'selfEffect';step jsonb;i int;
begin
 p_combat.monster_turn:=p_combat.monster_turn+1;
 select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}'::jsonb)
 into nextcd from jsonb_each(coalesce(p_combat.monster_cooldowns,'{}'::jsonb));
 if cd>0 then nextcd:=nextcd||jsonb_build_object(id,cd);end if;

 if kind='CHARGE' then
   p_combat.monster_prepared_action:=id;
 elsif kind='REACTIVE_PREPARE' then
   p_combat.monster_reactive_action:=d->>'reaction';
 elsif kind='EFFECT_SELF' then
   p_combat.monster_effects:=private.apply_server_effect(p_combat.monster_effects,effectid,p_combat.monster_turn);
   p_combat:=private.sync_server_shield(p_combat,'monster',effectid);
 elsif kind='EFFECT_TARGET' then
   p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.player_turn);
   p_combat:=private.sync_server_shield(p_combat,'player',effectid);
 else
   for i in 1..hits loop
     exit when p_combat.player_hp<=0 or p_combat.monster_hp<=0;
     step:=private.server_apply_monster_hit(p_combat,mult,p_nonce,i);
     select * into p_combat from jsonb_populate_record(null::private.online_combat_states,step->'state');
     raw:=raw+coalesce((step->>'damage')::bigint,0);
     absorbed:=absorbed+coalesce((step->>'absorbed')::numeric,0);
     counter:=counter+coalesce((step->>'counterDamage')::bigint,0);
   end loop;
   if effectid is not null and p_combat.player_hp>0 then
     p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.player_turn);
     p_combat:=private.sync_server_shield(p_combat,'player',effectid);
   end if;
   if self_effect is not null and p_combat.monster_hp>0 then
     p_combat.monster_effects:=private.apply_server_effect(p_combat.monster_effects,self_effect,p_combat.monster_turn);
     p_combat:=private.sync_server_shield(p_combat,'monster',self_effect);
   end if;
   if coalesce((d->>'prepared')::boolean,false) then p_combat.monster_prepared_action:=null;end if;
 end if;
 p_combat.monster_cooldowns:=nextcd;
 return jsonb_build_object('state',to_jsonb(p_combat),'action',d,'damage',raw,'absorbed',absorbed,'counterDamage',counter);
end $$;
revoke all on function private.resolve_server_monster_turn_v2(private.online_combat_states,bigint)
 from public,anon,authenticated;

create or replace function private.finish_server_player_action(
 p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 direct_damage bigint:=greatest(0,p_damage);monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;
 heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;reactive_damage bigint:=0;
 kill_no bigint;inserted_kill bigint;phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;
 reaction_id text;drop jsonb;tl jsonb;boss boolean:=false;step jsonb;
begin
 -- Legacy single-hit skill path. Basic/job multihits already use server_apply_player_hit.
 if direct_damage>0 then
   if p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
   else
     step_absorb:=least(p_combat.monster_shield,direct_damage);monster_absorb:=step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;direct_damage:=direct_damage-step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
   if p_combat.accessory_passive='vampire' and direct_damage>0 then
     heal:=floor(direct_damage*p_combat.accessory_value);
     p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);
   end if;
 end if;

 if direct_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then
   reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;
   step:=private.server_apply_monster_hit(p_combat,private.server_reactive_multiplier(reaction_id),p_nonce,900);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,step->'state');
   reactive_damage:=coalesce((step->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((step->>'absorbed')::numeric,0);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
   if player_delta<0 and p_combat.player_shield_hits>0 then
     p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;
   elsif player_delta<0 and p_combat.player_shield>0 then
     step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;
     p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;
   end if;
   p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));
   p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
   turn_result:=private.resolve_server_monster_turn_v2(p_combat,p_nonce);
   select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');
   monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);
   player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);
   monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
   if monster_delta<0 and p_combat.monster_shield_hits>0 then
     p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=monster_absorb-monster_delta;monster_delta:=0;
   elsif monster_delta<0 and p_combat.monster_shield>0 then
     step_absorb:=least(p_combat.monster_shield,-monster_delta);monster_absorb:=monster_absorb+step_absorb;
     p_combat.monster_shield:=p_combat.monster_shield-step_absorb;monster_delta:=monster_delta+step_absorb;
   end if;
   p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));
   p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);
 end if;

 if p_combat.monster_hp=0 then
   kill_no:=p_run.confirmed_kills+1;boss:=private.server_boss_id(p_run.tower,p_run.floor)=p_combat.monster_id;
   insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id)
   values(p_user,p_run.run_id,kill_no,p_combat.monster_id)
   on conflict do nothing returning kill_index into inserted_kill;
   if inserted_kill is not null then
     drop:=private.server_kill_loot(p_run,kill_no);
     tl:=jsonb_set(
       jsonb_set(
         jsonb_set(coalesce(p_run.temporary_loot,'{}'::jsonb),'{silver}',
           to_jsonb(coalesce((p_run.temporary_loot->>'silver')::bigint,0)+coalesce((drop->>'silver')::bigint,0)),true),
         '{material}',to_jsonb(coalesce((p_run.temporary_loot->>'material')::bigint,0)+coalesce((drop->>'material')::bigint,0)),true),
       '{tickets}',to_jsonb(coalesce((p_run.temporary_loot->>'tickets')::bigint,0)+coalesce((drop->>'tickets')::bigint,0)),true);
     update private.online_expeditions set
       confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),temporary_loot=tl,
       boss_progress=case when boss then 0 else boss_progress+1 end,
       boss_defeated=case when boss then true else boss_defeated end,
       run_version=run_version+1
     where user_id=p_user returning * into p_run;
   else
     select * into p_run from private.online_expeditions where user_id=p_user;
   end if;
   phase:='DEFEATED';
 elsif p_combat.player_hp=0 then
   phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else
   p_combat.player_turn:=p_combat.player_turn+1;phase:='PLAYER_TURN';
 end if;

 update private.online_combat_states set
   monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,
   player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,
   player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,
   player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,
   monster_cooldowns=p_combat.monster_cooldowns,monster_prepared_action=p_combat.monster_prepared_action,
   monster_reactive_action=p_combat.monster_reactive_action,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,
   job_resource=p_combat.job_resource,job_flags=p_combat.job_flags,
   turn_no=turn_no+1,phase=phase,pending_revival=p_combat.pending_revival,
   action_nonce=p_nonce,return_authorized=false,state_version=state_version+1,updated_at=now()
 where user_id=p_user returning * into p_combat;

 return jsonb_build_object(
   'damage',direct_damage,'absorbed',monster_absorb,'healing',heal,
   'monsterReaction',case when reaction_id is null then null else jsonb_build_object('id',reaction_id,'damage',reactive_damage) end,
   'monsterAction',monster_action,'retaliation',ret,'playerAbsorbed',player_absorb,
   'periodicPlayer',player_delta,'periodicMonster',monster_delta,
   'monsterId',p_combat.monster_id,'monsterHp',p_combat.monster_hp,'monsterMaxHp',p_combat.monster_max_hp,
   'playerHp',p_combat.player_hp,'playerMaxHp',p_combat.player_max_hp,
   'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,
   'playerShieldHits',p_combat.player_shield_hits,'monsterShieldHits',p_combat.monster_shield_hits,
   'playerEffects',p_combat.player_effects,'monsterEffects',p_combat.monster_effects,
   'playerCooldowns',p_combat.cooldowns,'monsterCooldowns',p_combat.monster_cooldowns,
   'monsterPreparedAction',p_combat.monster_prepared_action,'monsterReactiveAction',p_combat.monster_reactive_action,
   'jobId',p_combat.job_id,'jobResource',p_combat.job_resource,'jobFlags',p_combat.job_flags,
   'playerTurn',p_combat.player_turn,'monsterTurn',p_combat.monster_turn,'turnNo',p_combat.turn_no,
   'phase',phase,'pendingRevival',p_combat.pending_revival,
   'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'drop',drop,
   'actionNonce',p_nonce,'stateVersion',p_combat.state_version,'runVersion',p_run.run_version
 );
end $$;
revoke all on function private.finish_server_player_action(uuid,private.online_expeditions,private.online_combat_states,bigint,bigint)
 from public,anon,authenticated;

create or replace function public.apply_online_flee(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;result jsonb;authorized boolean:=false;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into r from private.online_expeditions where user_id=u for update;
 select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;
 if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 result:=private.finish_server_player_action(u,r,c,p_action_nonce,0);
 authorized:=coalesce((result->>'playerHp')::bigint,0)>0 and result->>'phase' in('PLAYER_TURN','DEFEATED');
 update private.online_combat_states set return_authorized=authorized where user_id=u;
 return result||jsonb_build_object('fled',authorized,'returnAuthorized',authorized);
end $$;
revoke all on function public.apply_online_flee(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.apply_online_flee(uuid,bigint,text,text,bigint) to authenticated;

-- Old client-authoritative kill reporting stays permanently unavailable.
drop function if exists public.confirm_online_expedition_kill(uuid,bigint,text,text,text,bigint);
drop function if exists public.record_online_combat_action(uuid,bigint,text,text,bigint,text,text);
