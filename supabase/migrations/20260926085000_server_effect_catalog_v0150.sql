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
