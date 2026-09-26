-- v0.1.50 finalize authoritative online combat actions.
alter table private.online_combat_states
 add column if not exists job_id text,
 add column if not exists job_resource numeric not null default 0,
 add column if not exists job_flags jsonb not null default '{}'::jsonb,
 add column if not exists state_version bigint not null default 1;

create or replace function private.server_job_id(p_payload jsonb)
returns text language sql immutable set search_path='' as $$
 select case p_payload->'expedition'->>'jobSnapshotId'
 when 'contract_mercenary' then 'contract_mercenary' when 'hunter' then 'hunter' when 'field_medic' then 'field_medic'
 when 'duelist' then 'duelist' when 'berserker' then 'berserker' else null end
$$;
revoke all on function private.server_job_id(jsonb) from public,anon,authenticated;

create or replace function private.server_job_damage_multiplier(p_combat private.online_combat_states,p_action text)
returns numeric language plpgsql immutable set search_path=''
as $$
declare r numeric:=p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0);m numeric:=p_combat.monster_hp::numeric/nullif(p_combat.monster_max_hp,0);x numeric:=1;
begin
 if p_combat.job_id='contract_mercenary' and p_action='BASIC' then x:=x*1.1;end if;
 if p_combat.job_id='hunter' then
  if exists(select 1 from jsonb_array_elements(p_combat.monster_effects)e where e->>'effectId'='hunter_mark') then x:=x*1.15;end if;
  if p_action='BASIC' and m<=.35 then x:=x*1.2;end if;
 elsif p_combat.job_id='duelist' then x:=x*1.1;
 elsif p_combat.job_id='berserker' then x:=x*(case when r<=.2 then 1.35 when r<=.4 then 1.2 when r<=.7 then 1.1 else 1 end);
 end if;
 return x;
end $$;
revoke all on function private.server_job_damage_multiplier(private.online_combat_states,text) from public,anon,authenticated;

-- Definitions required by the five production-ready jobs.
create or replace function private.effect_definition(p_id text)
returns jsonb language sql immutable set search_path='' as $$
 select case p_id
 when 'attack_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.3}'
 when 'defense_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.4}'
 when 'weaken' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"defense","multiplier":-0.2}'
 when 'fang_wound' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"STACK","maxStacks":3,"amount":6}'
 when 'hunter_mark' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION"}'
 when 'mercenary_guard' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.25}'
 when 'field_medic_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.05}'
 when 'field_medic_analgesic' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.3}'
 when 'duelist_counter_stance' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.4}'
 when 'berserker_blood_boost' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.25}'
 when 'crystal_glare' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"attack","multiplier":-0.2}'
 when 'crystal_venom' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":5}'
 when 'crystal_hardening' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.35}'
 when 'crystal_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.06}'
 when 'crystal_shell' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":32}'
 when 'kaleon_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.07}'
 when 'kaleon_blight' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":7}'
 when 'kaleon_overgrowth' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.3}'
 when 'kaleon_transfer_mark' then '{"behavior":"STAT_MODIFIER","duration":5,"policy":"STACK","maxStacks":3,"stat":"defense","multiplier":-0.05}'
 else null end::jsonb
$$;

create or replace function public.begin_online_combat_state_v2(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;s public.game_saves%rowtype;r jsonb;b jsonb;power numeric;passive jsonb;j text;
begin
 r:=public.begin_online_combat_state(p_lease_id,p_generation,p_client_instance_id,p_device_id,null,null,null);
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 select * into s from public.game_saves where user_id=u;if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 b:=coalesce(s.payload->'expedition'->'bag','{}');power:=private.combat_skill_power(s.payload);passive:=private.combat_accessory_passive(s.payload);j:=private.server_job_id(s.payload);
 update private.online_combat_states set skill_power=power,revival_count=greatest(0,least(1,coalesce((b->>'revival')::int,0))),
 accessory_passive=passive->>'kind',accessory_value=coalesce((passive->>'value')::numeric,0),job_id=j,
 job_resource=case when j='berserker' then 0 else 0 end,job_flags='{}',state_version=state_version+1 where user_id=u;
 return r||(select jsonb_build_object('jobId',job_id,'jobResource',job_resource,'stateVersion',state_version,'playerEffects',player_effects,'monsterEffects',monster_effects,'playerShield',player_shield,'monsterShield',monster_shield) from private.online_combat_states where user_id=u);
end $$;

create or replace function public.apply_online_job_skill(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint,p_skill_id text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;mult numeric:=0;hits int:=0;cd int:=0;i int;dmg bigint:=0;attack numeric;ratio numeric;heal bigint:=0;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' then raise exception 'COMBAT_PHASE_INVALID';end if;if p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 if coalesce((c.cooldowns->>('turn:'||p_skill_id))::int,0)>0 then raise exception 'COMBAT_SKILL_COOLDOWN';end if;
 ratio:=c.monster_hp::numeric/nullif(c.monster_max_hp,0);
 -- Validate skill ownership from the immutable expedition job snapshot.
 if c.job_id='contract_mercenary' then
  if p_skill_id='mercenary_skill_1' then mult:=1.8;hits:=1;cd:=3;
  elsif p_skill_id='mercenary_skill_2' then c.player_effects:=private.apply_server_effect(c.player_effects,'mercenary_guard',c.turn_no);cd:=5;
  elsif p_skill_id='mercenary_skill_3' then mult:=case when ratio<=.4 then 2 else 1.3 end;hits:=1;cd:=4;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='hunter' then
  if p_skill_id='hunter_skill_1' then c.monster_effects:=private.apply_server_effect(c.monster_effects,'hunter_mark',c.turn_no);cd:=5;
  elsif p_skill_id='hunter_skill_2' then mult:=.7;hits:=case when exists(select 1 from jsonb_array_elements(c.monster_effects)e where e->>'effectId'='hunter_mark') then 3 else 2 end;
  elsif p_skill_id='hunter_skill_3' then mult:=case when ratio<=.35 and exists(select 1 from jsonb_array_elements(c.monster_effects)e where e->>'effectId'='hunter_mark') then 2.8 else 1.7 end;hits:=1;cd:=5;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='field_medic' then
  if p_skill_id='field_medic_skill_1' then heal:=round(c.player_max_hp*.2);c.player_hp:=least(c.player_max_hp,c.player_hp+heal);cd:=5;
  elsif p_skill_id='field_medic_skill_2' then c.player_effects:=(select coalesce(jsonb_agg(e),'[]') from jsonb_array_elements(c.player_effects)e where e->>'effectId' not in('bleed','fang_wound'));c.player_effects:=private.apply_server_effect(c.player_effects,'field_medic_regen',c.turn_no);
  elsif p_skill_id='field_medic_skill_3' then c.player_effects:=private.apply_server_effect(c.player_effects,'field_medic_analgesic',c.turn_no);cd:=6;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='duelist' then
  if p_skill_id='duelist_skill_1' then mult:=1.6;hits:=1;cd:=2;
  elsif p_skill_id='duelist_skill_2' then c.player_effects:=private.apply_server_effect(c.player_effects,'duelist_counter_stance',c.turn_no);cd:=5;
  elsif p_skill_id='duelist_skill_3' then mult:=case when ratio<=.3 then 3.2 else 2.2 end;hits:=1;cd:=6;else raise exception 'COMBAT_SKILL_INVALID';end if;
 elsif c.job_id='berserker' then
  if p_skill_id='berserker_skill_1' then c.job_resource:=least(100,c.job_resource+10);mult:=.75;hits:=2;
  elsif p_skill_id='berserker_skill_2' then c.player_hp:=greatest(1,c.player_hp-round(c.player_max_hp*.1));c.job_resource:=least(100,c.job_resource+25);c.player_effects:=private.apply_server_effect(c.player_effects,'berserker_blood_boost',c.turn_no);
  elsif p_skill_id='berserker_skill_3' then if c.job_resource<60 then raise exception 'COMBAT_SKILL_CONDITION';end if;c.job_resource:=c.job_resource-60;mult:=1;hits:=3;else raise exception 'COMBAT_SKILL_INVALID';end if;
 else raise exception 'COMBAT_SKILL_INVALID';end if;
 c.cooldowns:=(select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') from jsonb_each(c.cooldowns));if cd>0 then c.cooldowns:=c.cooldowns||jsonb_build_object('turn:'||p_skill_id,cd);end if;
 if hits>0 then
  attack:=private.combat_effective_attack(c)*private.server_job_damage_multiplier(c,'SKILL');
  for i in 1..hits loop
   dmg:=dmg+greatest(1,round(attack*(case when c.job_id='berserker' and p_skill_id='berserker_skill_3' and i=hits and ratio<=.3 then 1.5 else mult end)*c.skill_power-c.monster_defense)::bigint);
  end loop;
 end if;
 update private.online_combat_states set player_hp=c.player_hp,player_effects=c.player_effects,monster_effects=c.monster_effects,cooldowns=c.cooldowns,job_resource=c.job_resource,state_version=state_version+1 where user_id=u returning * into c;
 if hits>0 then return private.finish_server_player_action(u,r,c,p_action_nonce,dmg)||jsonb_build_object('jobResource',c.job_resource,'stateVersion',c.state_version,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects);end if;
 -- Non-damage skills still consume a monster turn through the same resolver using zero direct damage.
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('healing',heal,'jobResource',c.job_resource,'stateVersion',c.state_version,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects);
end $$;
revoke all on function public.apply_online_job_skill(uuid,bigint,text,text,bigint,text) from public,anon;
grant execute on function public.apply_online_job_skill(uuid,bigint,text,text,bigint,text) to authenticated;

create or replace function public.apply_online_flee(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_action_nonce bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;r private.online_expeditions%rowtype;c private.online_combat_states%rowtype;roll numeric;
begin
 u:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);select * into r from private.online_expeditions where user_id=u for update;select * into c from private.online_combat_states where user_id=u for update;
 if not found or r.status<>'ACTIVE' or c.phase<>'PLAYER_TURN' or p_action_nonce<>c.action_nonce+1 then raise exception 'COMBAT_PHASE_INVALID';end if;
 roll:=private.server_roll(c.rng_seed,c.encounter_index,p_action_nonce,99);
 if roll<.5 then update private.online_combat_states set phase='DEFEATED',action_nonce=p_action_nonce,state_version=state_version+1,updated_at=now() where user_id=u;return jsonb_build_object('fled',true,'phase','DEFEATED','playerHp',c.player_hp,'monsterHp',c.monster_hp,'actionNonce',p_action_nonce,'stateVersion',c.state_version+1);end if;
 return private.finish_server_player_action(u,r,c,p_action_nonce,0)||jsonb_build_object('fled',false);
end $$;
revoke all on function public.apply_online_flee(uuid,bigint,text,text,bigint) from public,anon;
grant execute on function public.apply_online_flee(uuid,bigint,text,text,bigint) to authenticated;
