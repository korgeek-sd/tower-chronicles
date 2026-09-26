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


-- Extend authored AI coverage for the currently selected production normal pools and all Iron/Red bosses.
create or replace function private.server_monster_decision(p_combat private.online_combat_states)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare id text:=p_combat.monster_id;hp numeric:=p_combat.monster_hp::numeric/nullif(p_combat.monster_max_hp,0);target_hp numeric:=p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0);pc jsonb:=p_combat.monster_cooldowns;stacks int;
begin
 if p_combat.monster_prepared_action is not null then return jsonb_build_object('kind','DAMAGE','id',p_combat.monster_prepared_action,'multiplier',case p_combat.monster_prepared_action
  when 'boar_charge' then 1.75 when 'vanguard_charge' then 1.9 when 'whiteglow_charge' then 1.9 when 'graft_charge' then 2.0
  when 'burrow_charge' then 2.05 when 'resonant_charge' then 2.15 when 'hoist_charge' then 2.25 when 'terminal_charge' then 2.5
  when 'blood_charge' then 2.05 when 'pack_charge' then 2.2 when 'terminal_hunt' then 2.5
  when 'falling_glow' then 1.8 when 'horn_charge' then 1.95 when 'focused_beam' then 1.9 when 'underground_charge' then 2.0 when 'celestial_crush' then 2.1 else 1.8 end,'prepared',true);end if;
 select coalesce(max((x->>'stacks')::int),0) into stacks from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId' in('fang_wound','resonance','crystal_fracture');

 if id='wasteland_boar' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='defense_up') and coalesce((pc->>'boar_hide_brace')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"boar_hide_brace","effect":"defense_up","cooldown":4}'::jsonb;elsif coalesce((pc->>'boar_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"boar_charge","cooldown":3}'::jsonb;end if;end if;
 if id='thorn_jackal' then if exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='fang_wound') and coalesce((pc->>'blood_scent_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"blood_scent_bite","multiplier":1.45,"cooldown":2}'::jsonb;elsif coalesce((pc->>'thorn_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"thorn_bite","multiplier":1,"cooldown":1,"effect":"fang_wound"}'::jsonb;end if;end if;
 if id='carrion_vulture' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='weaken') and coalesce((pc->>'wing_feint')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"wing_feint","effect":"weaken","cooldown":3}'::jsonb;elsif coalesce((pc->>'carrion_dive')::int,0)=0 then return '{"kind":"DAMAGE","id":"carrion_dive","hits":2,"multiplier":0.72,"cooldown":2}'::jsonb;end if;end if;
 if id='hide_gnawer' then if stacks>=2 and coalesce((pc->>'rending_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"rending_bite","multiplier":1.6,"cooldown":2}'::jsonb;elsif hp<.55 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'gnaw_frenzy')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"gnaw_frenzy","effect":"attack_up","cooldown":4}'::jsonb;elsif coalesce((pc->>'gnaw_wound')::int,0)=0 then return '{"kind":"DAMAGE","id":"gnaw_wound","multiplier":1.05,"cooldown":1,"effect":"fang_wound"}'::jsonb;end if;end if;
 if id='pack_vanguard' then if coalesce((pc->>'vanguard_counter_prepare')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"vanguard_counter_prepare","reaction":"vanguard_counter","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'vanguard_howl')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"vanguard_howl","effect":"attack_up","cooldown":4}'::jsonb;elsif coalesce((pc->>'vanguard_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"vanguard_charge","cooldown":3}'::jsonb;end if;end if;

 if id='iron_maw_burrower' and coalesce((pc->>'burrow_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"burrow_charge","cooldown":2}'::jsonb;end if;
 if id='black_vein_armor_breaker' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='iron_armor') and coalesce((pc->>'armor_up')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"armor_up","effect":"iron_armor","cooldown":6}'::jsonb;elsif coalesce((pc->>'breaker_slam')::int,0)=0 then return '{"kind":"DAMAGE","id":"breaker_slam","multiplier":1.55,"cooldown":2}'::jsonb;end if;end if;
 if id='echo_devourer' then if stacks>=3 and coalesce((pc->>'resonant_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"resonant_charge","cooldown":3}'::jsonb;elsif coalesce((pc->>'echo_mark')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"echo_mark","effect":"resonance","cooldown":1}'::jsonb;end if;end if;
 if id='deep_hoist_overseer' then if coalesce((pc->>'counter_prepare')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"counter_prepare","reaction":"counter_strike","cooldown":3}'::jsonb;elsif coalesce((pc->>'hoist_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"hoist_charge","cooldown":3}'::jsonb;end if;end if;
 if id='iron_core_pulsator' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='iron_core_shield') and coalesce((pc->>'core_shield')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"core_shield","effect":"iron_core_shield","cooldown":4}'::jsonb;elsif hp<.5 and coalesce((pc->>'terminal_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"terminal_charge","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crushing_pressure') and coalesce((pc->>'pulse_debuff')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"pulse_debuff","effect":"crushing_pressure","cooldown":3}'::jsonb;end if;end if;

 if id='bloodmane_tracker' and coalesce((pc->>'blood_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"blood_charge","cooldown":2}'::jsonb;end if;
 if id='redjaw_hide_eater' then if stacks>=2 and coalesce((pc->>'deeper_rend')::int,0)=0 then return '{"kind":"DAMAGE","id":"deeper_rend","multiplier":1.7,"cooldown":2}'::jsonb;elsif coalesce((pc->>'rip')::int,0)=0 then return '{"kind":"DAMAGE","id":"rip","multiplier":1.1,"cooldown":1,"effect":"fang_wound"}'::jsonb;end if;end if;
 if id='fang_pack_matriarch' then if coalesce((pc->>'matriarch_counter_prepare')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"matriarch_counter_prepare","reaction":"matriarch_bite","cooldown":3}'::jsonb;elsif coalesce((pc->>'pack_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"pack_charge","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'pack_howl')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"pack_howl","effect":"attack_up","cooldown":4}'::jsonb;end if;end if;
 if id='sanctuary_talon_bishop' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='blood_rite_ward') and coalesce((pc->>'rite_ward')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"rite_ward","effect":"blood_rite_ward","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crushing_pressure') and coalesce((pc->>'talon_hex')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"talon_hex","effect":"crushing_pressure","cooldown":3}'::jsonb;elsif coalesce((pc->>'bishop_strike')::int,0)=0 then return '{"kind":"DAMAGE","id":"bishop_strike","multiplier":1.5,"cooldown":1}'::jsonb;end if;end if;
 if id='lord_of_red_fang' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='red_mantle_shield') and coalesce((pc->>'red_mantle')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"red_mantle","effect":"red_mantle_shield","cooldown":4}'::jsonb;elsif hp<.5 and coalesce((pc->>'terminal_hunt')::int,0)=0 then return '{"kind":"CHARGE","id":"terminal_hunt","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crushing_pressure') and coalesce((pc->>'crushing_roar')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"crushing_roar","effect":"crushing_pressure","cooldown":3}'::jsonb;elsif coalesce((pc->>'fang_rupture')::int,0)=0 then return '{"kind":"DAMAGE","id":"fang_rupture","multiplier":1.3,"cooldown":1,"effect":"fang_wound"}'::jsonb;end if;end if;

 -- Existing Kaleon foundation.
 if id='moss_spirit' and hp<.7 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_regen') then return '{"kind":"EFFECT_SELF","id":"moss_regen","effect":"kaleon_regen","cooldown":4}'::jsonb;end if;
 if id='spore_hound' then if exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') and coalesce((pc->>'sick_hunt')::int,0)=0 then return '{"kind":"DAMAGE","id":"sick_hunt","multiplier":1.45,"cooldown":2}'::jsonb;else return '{"kind":"DAMAGE","id":"spore_bite","multiplier":1.05,"cooldown":2,"effect":"kaleon_blight"}'::jsonb;end if;end if;
 if id='graft_stag' and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_overgrowth') then return '{"kind":"EFFECT_SELF","id":"bark_growth","effect":"kaleon_overgrowth","cooldown":4}'::jsonb;end if;
 if id='graft_stag' then return '{"kind":"CHARGE","id":"graft_charge","cooldown":3}'::jsonb;end if;
 if id='blight_leech' and not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') then return '{"kind":"EFFECT_TARGET","id":"blight_infect","effect":"kaleon_blight","cooldown":2}'::jsonb;end if;
 if id='receptor_aberrant' then return '{"kind":"EFFECT_TARGET","id":"transfer_mark","effect":"kaleon_transfer_mark","cooldown":1}'::jsonb;end if;
 return '{"kind":"BASIC","id":"basic","multiplier":1}'::jsonb;
end $$;
