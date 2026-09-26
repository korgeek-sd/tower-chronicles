-- v0.1.50 complete production effect catalog and server shield/stack application.
create or replace function private.effect_definition(p_id text)
returns jsonb language sql immutable set search_path='' as $$
 select case p_id
 when 'attack_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.3}'
 when 'defense_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.4}'
 when 'regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.1}'
 when 'guard' then '{"behavior":"STAT_MODIFIER","duration":4,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.4}'
 when 'poison' then '{"behavior":"PERIODIC_DAMAGE","duration":2,"policy":"REFRESH_DURATION","amount":5}'
 when 'bleed' then '{"behavior":"PERIODIC_DAMAGE","duration":2,"policy":"REFRESH_DURATION","amount":5}'
 when 'weaken' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"defense","multiplier":-0.2}'
 when 'iron_armor' then '{"behavior":"STAT_MODIFIER","duration":99,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.65}'
 when 'fracture' then '{"behavior":"STAT_MODIFIER","duration":99,"policy":"STACK","maxStacks":3}'
 when 'exposed_core' then '{"behavior":"STAT_MODIFIER","duration":4,"policy":"REFRESH_DURATION","stat":"defense","multiplier":-0.35}'
 when 'resonance' then '{"behavior":"STAT_MODIFIER","duration":5,"policy":"STACK","maxStacks":5}'
 when 'crushing_pressure' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":-0.3}'
 when 'iron_core_shield' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":70}'
 when 'fang_wound' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"STACK","maxStacks":3,"amount":6}'
 when 'blood_rite_ward' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":60}'
 when 'red_mantle_shield' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":75}'
 when 'crystal_shell' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":32}'
 when 'crystal_bastion' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":65}'
 when 'crystal_core_shield' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":85}'
 when 'crystal_hardening' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.35}'
 when 'crystal_growth' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.25}'
 when 'crystal_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.06}'
 when 'crystal_glare' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"attack","multiplier":-0.2}'
 when 'crystal_venom' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":5}'
 when 'crystal_fracture' then '{"behavior":"STAT_MODIFIER","duration":5,"policy":"STACK","maxStacks":3,"stat":"defense","multiplier":-0.08}'
 when 'hunter_mark' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION"}'
 when 'mercenary_guard' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.25}'
 when 'field_medic_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.05}'
 when 'field_medic_analgesic' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.3}'
 when 'duelist_counter_stance' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"receivedDamage","multiplier":-0.4}'
 when 'kaleon_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.07}'
 when 'kaleon_blight' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":7}'
 when 'kaleon_overgrowth' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.3}'
 when 'kaleon_transfer_mark' then '{"behavior":"STAT_MODIFIER","duration":5,"policy":"STACK","maxStacks":3,"stat":"defense","multiplier":-0.05}'
 when 'kaleon_saint_ward' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":90}'
 when 'berserker_blood_boost' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.25}'
 else null end::jsonb
$$;
revoke all on function private.effect_definition(text) from public,anon,authenticated;

create or replace function private.apply_server_effect(p_effects jsonb,p_id text,p_turn bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d jsonb:=private.effect_definition(p_id);a jsonb;old jsonb;stacks int:=1;result jsonb;seq bigint;
begin
 if d is null then return p_effects;end if;
 if d->>'behavior'='SHIELD' then p_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(p_effects,'[]'))x where coalesce(private.effect_definition(x->>'effectId')->>'behavior','')<>'SHIELD');end if;
 select x into old from jsonb_array_elements(coalesce(p_effects,'[]'))x where x->>'effectId'=p_id limit 1;
 if old is not null and d->>'policy'='STACK' then stacks:=least(coalesce((d->>'maxStacks')::int,99),coalesce((old->>'stacks')::int,1)+1);end if;
 select coalesce(max(coalesce((x->>'applicationSequence')::bigint,0)),0)+1 into seq from jsonb_array_elements(coalesce(p_effects,'[]'))x;
 a:=jsonb_build_object('effectId',p_id,'duration',(d->>'duration')::int,'stacks',stacks,'createdTurn',p_turn,'applicationSequence',seq,'behavior',d->>'behavior')||
  case when d ? 'stat' then jsonb_build_object('stat',d->>'stat','multiplier',(d->>'multiplier')::numeric) else '{}'::jsonb end||
  case when d ? 'amount' then jsonb_build_object('amount',(d->>'amount')::numeric) else '{}'::jsonb end||
  case when d ? 'shieldAmount' then jsonb_build_object('currentShield',(d->>'shieldAmount')::numeric) else '{}'::jsonb end;
 result:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(p_effects,'[]'))x where x->>'effectId'<>p_id)||jsonb_build_array(a);
 -- Iron armor fracture threshold exactly mirrors the local transition.
 if p_id='fracture' and stacks>=3 then
  result:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(result)x where x->>'effectId' not in('fracture','iron_armor'));
  result:=private.apply_server_effect(result,'exposed_core',p_turn);
 end if;
 return result;
end $$;
revoke all on function private.apply_server_effect(jsonb,text,bigint) from public,anon,authenticated;


create or replace function private.sync_server_shield(p_combat private.online_combat_states,p_actor text,p_effect_id text)
returns private.online_combat_states language plpgsql immutable set search_path=''
as $$
declare d jsonb:=private.effect_definition(p_effect_id);
begin
 if d->>'behavior'<>'SHIELD' then return p_combat;end if;
 if p_actor='player' then p_combat.player_shield:=coalesce((d->>'shieldAmount')::numeric,0);p_combat.player_shield_hits:=coalesce((d->>'shieldHits')::int,0);
 else p_combat.monster_shield:=coalesce((d->>'shieldAmount')::numeric,0);p_combat.monster_shield_hits:=coalesce((d->>'shieldHits')::int,0);end if;
 return p_combat;
end $$;
revoke all on function private.sync_server_shield(private.online_combat_states,text,text) from public,anon,authenticated;

create or replace function private.resolve_server_monster_turn(p_combat private.online_combat_states)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d jsonb:=private.server_monster_decision(p_combat);kind text:=d->>'kind';id text:=d->>'id';mult numeric:=coalesce((d->>'multiplier')::numeric,1);hits int:=greatest(1,coalesce((d->>'hits')::int,1));cd int:=coalesce((d->>'cooldown')::int,0);raw bigint:=0;one bigint;absorbed numeric:=0;step_absorb numeric;def numeric;received numeric:=1;nextcd jsonb;effectid text:=d->>'effect';i int;
begin
 p_combat.monster_turn:=p_combat.monster_turn+1;
 select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') into nextcd from jsonb_each(p_combat.monster_cooldowns);
 if cd>0 then nextcd:=nextcd||jsonb_build_object(id,cd);end if;
 if kind='CHARGE' then p_combat.monster_prepared_action:=id;
 elsif kind='REACTIVE_PREPARE' then p_combat.monster_reactive_action:=d->>'reaction';
 elsif kind='EFFECT_SELF' then p_combat.monster_effects:=private.apply_server_effect(p_combat.monster_effects,effectid,p_combat.monster_turn);p_combat:=private.sync_server_shield(p_combat,'monster',effectid);
 elsif kind='EFFECT_TARGET' then p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.player_turn);p_combat:=private.sync_server_shield(p_combat,'player',effectid);
 else
  def:=p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense'));received:=greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'));
  if p_combat.accessory_passive='unyielding' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35 then received:=received*(1-p_combat.accessory_value);end if;
  for i in 1..hits loop
   exit when p_combat.player_hp<=0;
   one:=private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),def,mult,1,received);
   if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;absorbed:=absorbed+one;one:=0;
   else step_absorb:=least(p_combat.player_shield,one);absorbed:=absorbed+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;one:=one-step_absorb;end if;
   p_combat.player_hp:=greatest(0,p_combat.player_hp-one);raw:=raw+one;
  end loop;
  if effectid is not null and p_combat.player_hp>0 then p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.player_turn);p_combat:=private.sync_server_shield(p_combat,'player',effectid);end if;
  if coalesce((d->>'prepared')::boolean,false) then p_combat.monster_prepared_action:=null;end if;
 end if;
 p_combat.monster_cooldowns:=nextcd;
 return jsonb_build_object('state',to_jsonb(p_combat),'action',d,'damage',raw,'absorbed',absorbed);
end $$;
