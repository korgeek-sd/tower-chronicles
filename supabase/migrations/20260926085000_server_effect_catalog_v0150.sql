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
declare d jsonb:=private.server_monster_decision_v2(p_combat);kind text:=d->>'kind';id text:=d->>'id';mult numeric:=coalesce((d->>'multiplier')::numeric,1);hits int:=greatest(1,coalesce((d->>'hits')::int,1));cd int:=coalesce((d->>'cooldown')::int,0);raw bigint:=0;one bigint;absorbed numeric:=0;step_absorb numeric;def numeric;received numeric:=1;nextcd jsonb;effectid text:=d->>'effect';i int;
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



-- Crystal and Kaleon authored monster AI parity layer.
create or replace function private.server_monster_decision_v2(p_combat private.online_combat_states)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare id text:=p_combat.monster_id;hp numeric:=p_combat.monster_hp::numeric/nullif(p_combat.monster_max_hp,0);thp numeric:=p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0);pc jsonb:=p_combat.monster_cooldowns;s int:=0;
begin
 if p_combat.monster_prepared_action is not null then return private.server_monster_decision(p_combat);end if;
 select coalesce(max((x->>'stacks')::int),0) into s from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId' in('crystal_fracture','kaleon_transfer_mark');
 -- Crystal normals.
 if id='quartz_carapace_beetle' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_shell') and coalesce((pc->>'quartz_shell')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"quartz_shell","effect":"crystal_shell","cooldown":4}'::jsonb;elsif coalesce((pc->>'carapace_slam')::int,0)=0 then return '{"kind":"DAMAGE","id":"carapace_slam","multiplier":1.35,"cooldown":2}'::jsonb;end if;end if;
 if id='glassjaw_stalker' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'predatory_focus')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"predatory_focus","effect":"attack_up","cooldown":4}'::jsonb;elsif coalesce((pc->>'glass_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"glass_bite","multiplier":1.5,"cooldown":2}'::jsonb;end if;end if;
 if id='refractive_scale_lizard' then if coalesce((pc->>'refraction_stance')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"refraction_stance","reaction":"refraction_tail","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'dulling_glare')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"dulling_glare","effect":"crystal_glare","cooldown":3}'::jsonb;end if;end if;
 if id='echo_crystal' then if coalesce((pc->>'echo_stance')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"echo_stance","reaction":"echo_burst","cooldown":4}'::jsonb;elsif coalesce((pc->>'crystal_pressure')::int,0)=0 then return '{"kind":"DAMAGE","id":"crystal_pressure","multiplier":1.3,"cooldown":2}'::jsonb;end if;end if;
 if id='vein_clinger' then if hp<.65 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_regen') and coalesce((pc->>'vein_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"vein_regen","effect":"crystal_regen","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'vein_harden')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"vein_harden","effect":"crystal_hardening","cooldown":4}'::jsonb;end if;end if;
 if id='crystal_needle_centipede' then if exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_venom') and coalesce((pc->>'needle_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"needle_bite","multiplier":1.35,"cooldown":2}'::jsonb;elsif coalesce((pc->>'crystal_venom')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"crystal_venom","effect":"crystal_venom","cooldown":2}'::jsonb;end if;end if;
 if id='whiteglow_burrower' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'ground_harden')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"ground_harden","effect":"crystal_hardening","cooldown":4}'::jsonb;elsif coalesce((pc->>'whiteglow_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"whiteglow_charge","cooldown":3}'::jsonb;end if;end if;
 if id='clouded_crystal_beast' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'clouded_dust')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"clouded_dust","effect":"crystal_glare","cooldown":3}'::jsonb;elsif coalesce((pc->>'heavy_headbutt')::int,0)=0 then return '{"kind":"DAMAGE","id":"heavy_headbutt","multiplier":1.4,"cooldown":2}'::jsonb;end if;end if;
 if id='translucent_bat' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'scattered_light')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"scattered_light","effect":"crystal_glare","cooldown":3}'::jsonb;elsif coalesce((pc->>'falling_glow')::int,0)=0 then return '{"kind":"CHARGE","id":"falling_glow","cooldown":3}'::jsonb;end if;end if;
 if id='shardback_spider' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_venom') and coalesce((pc->>'crystal_spit')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"crystal_spit","effect":"crystal_venom","cooldown":3}'::jsonb;elsif coalesce((pc->>'shard_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"shard_bite","multiplier":1.35,"cooldown":2}'::jsonb;end if;end if;
 if id='crystalhorn_goat' then if hp<.45 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'cornered_beast')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"cornered_beast","effect":"attack_up","cooldown":5}'::jsonb;elsif coalesce((pc->>'horn_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"horn_charge","cooldown":3}'::jsonb;end if;end if;
 if id='lens_eye_watcher' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'focused_gaze')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"focused_gaze","effect":"crystal_glare","cooldown":3}'::jsonb;elsif coalesce((pc->>'focused_beam')::int,0)=0 then return '{"kind":"CHARGE","id":"focused_beam","cooldown":3}'::jsonb;end if;end if;
 if id='hardening_slime' then if hp<.55 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_regen') and coalesce((pc->>'mineral_recovery')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"mineral_recovery","effect":"crystal_regen","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_shell') and coalesce((pc->>'condensed_membrane')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"condensed_membrane","effect":"crystal_shell","cooldown":4}'::jsonb;end if;end if;
 if id in('crystal_scale_serpent','fracture_claw_hunter') then if s>=2 and coalesce((pc->>case when id='crystal_scale_serpent' then 'shatter_bite' else 'armor_break_claw' end)::int,0)=0 then return jsonb_build_object('kind','DAMAGE','id',case when id='crystal_scale_serpent' then 'shatter_bite' else 'armor_break_claw' end,'multiplier',case when id='crystal_scale_serpent' then 1.7 else 1.75 end,'cooldown',2);else return jsonb_build_object('kind','DAMAGE','id',case when id='crystal_scale_serpent' then 'fracture_fang' else 'fracture_claw' end,'multiplier',case when id='crystal_scale_serpent' then 1.05 else 1.08 end,'cooldown',1,'effect','crystal_fracture');end if;end if;
 if id='vein_hound' then if thp<.4 and coalesce((pc->>'throat_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"throat_bite","multiplier":1.6,"cooldown":2}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'vein_frenzy')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"vein_frenzy","effect":"attack_up","cooldown":4}'::jsonb;end if;end if;
 if id='shatter_mole' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'stone_skin')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"stone_skin","effect":"crystal_hardening","cooldown":4}'::jsonb;elsif coalesce((pc->>'underground_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"underground_charge","cooldown":3}'::jsonb;end if;end if;
 if id='quartz_spine_predator' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_venom') and coalesce((pc->>'crystal_blood')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"crystal_blood","effect":"crystal_venom","cooldown":3}'::jsonb;elsif coalesce((pc->>'quartz_claw')::int,0)=0 then return '{"kind":"DAMAGE","id":"quartz_claw","multiplier":1.45,"cooldown":2}'::jsonb;end if;end if;
 if id='whitevein_leech' then if hp<.55 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_regen') and coalesce((pc->>'stored_recovery')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"stored_recovery","effect":"crystal_regen","cooldown":4}'::jsonb;elsif coalesce((pc->>'vein_siphon')::int,0)=0 then return '{"kind":"DAMAGE","id":"vein_siphon","multiplier":1.25,"cooldown":2}'::jsonb;end if;end if;
 if id='celestial_crystal_brute' then if hp<.4 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'crystal_frenzy')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"crystal_frenzy","effect":"attack_up","cooldown":5}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_shell') and coalesce((pc->>'keratin_barrier')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"keratin_barrier","effect":"crystal_shell","cooldown":4}'::jsonb;elsif coalesce((pc->>'celestial_crush')::int,0)=0 then return '{"kind":"CHARGE","id":"celestial_crush","cooldown":3}'::jsonb;end if;end if;
 -- Crystal bosses.
 if id='white_crystal_armor_behemoth' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_bastion') and coalesce((pc->>'white_bastion')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"white_bastion","effect":"crystal_bastion","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'boss_hardening')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"boss_hardening","effect":"crystal_hardening","cooldown":4}'::jsonb;elsif coalesce((pc->>'crust_crush')::int,0)=0 then return '{"kind":"CHARGE","id":"crust_crush","cooldown":3}'::jsonb;elsif coalesce((pc->>'armor_collision')::int,0)=0 then return '{"kind":"DAMAGE","id":"armor_collision","multiplier":1.55,"cooldown":2}'::jsonb;end if;end if;
 if id='myriad_refraction_predator' then if thp<.35 and coalesce((pc->>'predation_strike')::int,0)=0 then return '{"kind":"DAMAGE","id":"predation_strike","multiplier":1.75,"cooldown":2}'::jsonb;elsif coalesce((pc->>'myriad_stance')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"myriad_stance","reaction":"reflected_claw","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'boss_scattered_light')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"boss_scattered_light","effect":"crystal_glare","cooldown":3}'::jsonb;elsif coalesce((pc->>'myriad_leap')::int,0)=0 then return '{"kind":"CHARGE","id":"myriad_leap","cooldown":3}'::jsonb;end if;end if;
 if id='pulsing_crystal_core_growth' then if hp<.6 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_regen') and coalesce((pc->>'core_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"core_regen","effect":"crystal_regen","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_growth') and coalesce((pc->>'crystal_amplify')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"crystal_amplify","effect":"crystal_growth","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'vein_fortify')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"vein_fortify","effect":"crystal_hardening","cooldown":4}'::jsonb;elsif coalesce((pc->>'core_compression')::int,0)=0 then return '{"kind":"CHARGE","id":"core_compression","cooldown":3}'::jsonb;elsif coalesce((pc->>'pulse_impact')::int,0)=0 then return '{"kind":"DAMAGE","id":"pulse_impact","multiplier":1.55,"cooldown":2}'::jsonb;end if;end if;
 if id='thousand_face_crystal_beast' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_hardening') and coalesce((pc->>'white_face')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"white_face","effect":"crystal_hardening","cooldown":4}'::jsonb;elsif coalesce((pc->>'mirror_face')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"mirror_face","reaction":"mirror_shatter","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_growth') and coalesce((pc->>'clouded_face')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"clouded_face","effect":"crystal_growth","cooldown":4}'::jsonb;elsif coalesce((pc->>'manyface_fall')::int,0)=0 then return '{"kind":"CHARGE","id":"manyface_fall","cooldown":3}'::jsonb;elsif coalesce((pc->>'manyface_collision')::int,0)=0 then return '{"kind":"DAMAGE","id":"manyface_collision","multiplier":1.6,"cooldown":2}'::jsonb;end if;end if;
 if id='celestial_core_matrix' then if hp<.45 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_regen') and coalesce((pc->>'matrix_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"matrix_regen","effect":"crystal_regen","cooldown":4}'::jsonb;elsif hp<.5 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_growth') and coalesce((pc->>'celestial_amplify')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"celestial_amplify","effect":"crystal_growth","cooldown":4}'::jsonb;elsif hp<.5 and coalesce((pc->>'celestial_compression')::int,0)=0 then return '{"kind":"CHARGE","id":"celestial_compression","cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='crystal_core_shield') and coalesce((pc->>'core_barrier')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"core_barrier","effect":"crystal_core_shield","cooldown":4}'::jsonb;elsif coalesce((pc->>'core_echo_stance')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"core_echo_stance","reaction":"core_echo_wave","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='crystal_glare') and coalesce((pc->>'dulling_pulse')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"dulling_pulse","effect":"crystal_glare","cooldown":3}'::jsonb;elsif coalesce((pc->>'core_impact')::int,0)=0 then return '{"kind":"DAMAGE","id":"core_impact","multiplier":1.65,"cooldown":2}'::jsonb;end if;end if;
 -- Kaleon exact normals/bosses.
 if id='blight_leech' then if not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') and coalesce((pc->>'blight_infect')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"blight_infect","effect":"kaleon_blight","cooldown":2}'::jsonb;elsif hp<.75 and coalesce((pc->>'green_drain')::int,0)=0 then return '{"kind":"DAMAGE","id":"green_drain","multiplier":1.15,"cooldown":3,"selfEffect":"kaleon_regen"}'::jsonb;end if;end if;
 if id='receptor_aberrant' then if s>=2 and coalesce((pc->>'transfer_crush')::int,0)=0 then return '{"kind":"DAMAGE","id":"transfer_crush","multiplier":1.75,"cooldown":3}'::jsonb;elsif hp<.55 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_regen') and coalesce((pc->>'receptor_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"receptor_regen","effect":"kaleon_regen","cooldown":4}'::jsonb;elsif coalesce((pc->>'transfer_mark')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"transfer_mark","effect":"kaleon_transfer_mark","cooldown":1}'::jsonb;end if;end if;
 if id='greenwrought_gatekeeper' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_overgrowth') and coalesce((pc->>'gate_growth')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"gate_growth","effect":"kaleon_overgrowth","cooldown":4}'::jsonb;elsif coalesce((pc->>'gate_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"gate_charge","cooldown":3}'::jsonb;end if;end if;
 if id='overgrowth_regenerator' then if hp<.8 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_regen') and coalesce((pc->>'overflow_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"overflow_regen","effect":"kaleon_regen","cooldown":4}'::jsonb;elsif coalesce((pc->>'rupture_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"rupture_bite","multiplier":1.25,"cooldown":2,"effect":"kaleon_blight"}'::jsonb;end if;end if;
 if id='transfer_subject_c17' then if s>=3 and coalesce((pc->>'c17_backflow')::int,0)=0 then return '{"kind":"DAMAGE","id":"c17_backflow","multiplier":2,"cooldown":3}'::jsonb;elsif coalesce((pc->>'c17_mark')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"c17_mark","effect":"kaleon_transfer_mark","cooldown":1}'::jsonb;end if;end if;
 if id='atonement_prototype' then if coalesce((pc->>'atonement_counter_prepare')::int,0)=0 then return '{"kind":"REACTIVE_PREPARE","id":"atonement_counter_prepare","reaction":"atonement_counter","cooldown":3}'::jsonb;elsif hp<.6 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_regen') and coalesce((pc->>'atonement_regen')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"atonement_regen","effect":"kaleon_regen","cooldown":4}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') and coalesce((pc->>'atonement_blight')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"atonement_blight","effect":"kaleon_blight","cooldown":2}'::jsonb;end if;end if;
 if id='false_saint_caleon' then if not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_saint_ward') and coalesce((pc->>'saint_ward')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"saint_ward","effect":"kaleon_saint_ward","cooldown":5}'::jsonb;elsif hp<.45 and coalesce((pc->>'last_receptor')::int,0)=0 then return '{"kind":"CHARGE","id":"last_receptor","cooldown":4}'::jsonb;elsif s>=3 and coalesce((pc->>'caleon_backflow')::int,0)=0 then return '{"kind":"DAMAGE","id":"caleon_backflow","multiplier":2.1,"cooldown":3}'::jsonb;elsif not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') and coalesce((pc->>'caleon_blight')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"caleon_blight","effect":"kaleon_blight","cooldown":3}'::jsonb;elsif coalesce((pc->>'caleon_mark')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"caleon_mark","effect":"kaleon_transfer_mark","cooldown":1}'::jsonb;end if;end if;
 return private.server_monster_decision(p_combat);
end $$;
revoke all on function private.server_monster_decision_v2(private.online_combat_states) from public,anon,authenticated;
create or replace function private.server_reactive_multiplier(p_reaction text)
returns numeric language sql immutable set search_path='' as $$
 select case p_reaction when 'vanguard_counter' then .68 when 'counter_strike' then .9 when 'matriarch_bite' then .9 when 'refraction_tail' then .72 when 'echo_burst' then .8 when 'reflected_claw' then .95 when 'mirror_shatter' then 1 when 'core_echo_wave' then 1.05 when 'atonement_counter' then 1 else .8 end
$$;
revoke all on function private.server_reactive_multiplier(text) from public,anon,authenticated;

create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare direct_damage bigint:=p_damage;monster_absorb numeric:=0;player_absorb numeric:=0;step_absorb numeric:=0;heal bigint:=0;player_delta bigint:=0;monster_delta bigint:=0;ret bigint:=0;reactive_damage bigint:=0;kill_no bigint;phase text:='PLAYER_TURN';turn_result jsonb;monster_action jsonb;reaction_id text;
begin
 if p_combat.monster_shield_hits>0 and direct_damage>0 then p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=direct_damage;direct_damage:=0;
 else monster_absorb:=least(p_combat.monster_shield,direct_damage);p_combat.monster_shield:=p_combat.monster_shield-monster_absorb;direct_damage:=direct_damage-monster_absorb;end if;
 p_combat.monster_hp:=greatest(0,p_combat.monster_hp-direct_damage);
 if p_combat.accessory_passive='vampire' and direct_damage>0 then heal:=floor(direct_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+heal);end if;

 -- Prepared monster reactions fire immediately after a surviving direct hit, before normal turn-end processing.
 if direct_damage>0 and p_combat.monster_hp>0 and p_combat.monster_reactive_action is not null then
  reaction_id:=p_combat.monster_reactive_action;p_combat.monster_reactive_action:=null;
  reactive_damage:=private.combat_damage(p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack')),p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense')),private.server_reactive_multiplier(reaction_id),1,greatest(0,1+private.effect_modifier(p_combat.player_effects,'receivedDamage')));
  if p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb+reactive_damage;reactive_damage:=0;
  else step_absorb:=least(p_combat.player_shield,reactive_damage);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;reactive_damage:=reactive_damage-step_absorb;end if;
  p_combat.player_hp:=greatest(0,p_combat.player_hp-reactive_damage);
 end if;

 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
  player_delta:=private.effect_periodic_delta(p_combat.player_effects,p_combat.player_max_hp,p_combat.player_turn);
  if player_delta<0 and p_combat.player_shield_hits>0 then p_combat.player_shield_hits:=p_combat.player_shield_hits-1;player_absorb:=player_absorb-player_delta;player_delta:=0;
  elsif player_delta<0 and p_combat.player_shield>0 then step_absorb:=least(p_combat.player_shield,-player_delta);player_absorb:=player_absorb+step_absorb;p_combat.player_shield:=p_combat.player_shield-step_absorb;player_delta:=player_delta+step_absorb;end if;
  p_combat.player_hp:=greatest(0,least(p_combat.player_max_hp,p_combat.player_hp+player_delta));p_combat.player_effects:=private.effect_tick(p_combat.player_effects,p_combat.player_turn);
 end if;
 if p_combat.monster_hp>0 and p_combat.player_hp>0 then
  turn_result:=private.resolve_server_monster_turn(p_combat);select * into p_combat from jsonb_populate_record(null::private.online_combat_states,turn_result->'state');
  monster_action:=turn_result->'action';ret:=coalesce((turn_result->>'damage')::bigint,0);player_absorb:=player_absorb+coalesce((turn_result->>'absorbed')::numeric,0);
  monster_delta:=private.effect_periodic_delta(p_combat.monster_effects,p_combat.monster_max_hp,p_combat.monster_turn);
  if monster_delta<0 and p_combat.monster_shield_hits>0 then p_combat.monster_shield_hits:=p_combat.monster_shield_hits-1;monster_absorb:=monster_absorb-monster_delta;monster_delta:=0;
  elsif monster_delta<0 and p_combat.monster_shield>0 then step_absorb:=least(p_combat.monster_shield,-monster_delta);monster_absorb:=monster_absorb+step_absorb;p_combat.monster_shield:=p_combat.monster_shield-step_absorb;monster_delta:=monster_delta+step_absorb;end if;
  p_combat.monster_hp:=greatest(0,least(p_combat.monster_max_hp,p_combat.monster_hp+monster_delta));p_combat.monster_effects:=private.effect_tick(p_combat.monster_effects,p_combat.monster_turn);
 end if;
 if p_combat.monster_hp=0 then kill_no:=p_run.confirmed_kills+1;insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,kill_no,p_combat.monster_id) on conflict do nothing;
  update private.online_expeditions set confirmed_kills=greatest(confirmed_kills,kill_no),last_confirmed_kill_at=now(),boss_progress=case when private.server_boss_id(tower,floor)=p_combat.monster_id then boss_progress else boss_progress+1 end,boss_defeated=case when private.server_boss_id(tower,floor)=p_combat.monster_id then true else boss_defeated end,run_version=run_version+1 where user_id=p_user;phase:='DEFEATED';
 elsif p_combat.player_hp=0 then phase:='PLAYER_DEAD';p_combat.pending_revival:=p_combat.revival_count>0;
 else p_combat.player_turn:=p_combat.player_turn+1;phase:='PLAYER_TURN';end if;
 update private.online_combat_states set monster_hp=p_combat.monster_hp,player_hp=p_combat.player_hp,player_shield=p_combat.player_shield,monster_shield=p_combat.monster_shield,player_shield_hits=p_combat.player_shield_hits,monster_shield_hits=p_combat.monster_shield_hits,player_effects=p_combat.player_effects,monster_effects=p_combat.monster_effects,monster_cooldowns=p_combat.monster_cooldowns,monster_prepared_action=p_combat.monster_prepared_action,monster_reactive_action=p_combat.monster_reactive_action,player_turn=p_combat.player_turn,monster_turn=p_combat.monster_turn,turn_no=turn_no+1,phase=phase,pending_revival=p_combat.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',direct_damage,'absorbed',monster_absorb,'healing',heal,'monsterReaction',case when reaction_id is null then null else jsonb_build_object('id',reaction_id,'damage',reactive_damage) end,'monsterAction',monster_action,'retaliation',ret,'playerAbsorbed',player_absorb,'periodicPlayer',player_delta,'periodicMonster',monster_delta,'monsterHp',p_combat.monster_hp,'playerHp',p_combat.player_hp,'playerShield',p_combat.player_shield,'monsterShield',p_combat.monster_shield,'phase',phase,'pendingRevival',p_combat.pending_revival,'confirmedKills',coalesce(kill_no,p_run.confirmed_kills),'actionNonce',p_nonce);
end $$;
