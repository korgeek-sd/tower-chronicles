-- v0.1.50 authoritative monster AI/effect application foundation.
alter table private.online_combat_states
 add column if not exists monster_cooldowns jsonb not null default '{}'::jsonb,
 add column if not exists monster_prepared_action text;

create or replace function private.effect_definition(p_id text)
returns jsonb language sql immutable set search_path='' as $$
 select case p_id
 when 'attack_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"attack","multiplier":0.3}'::jsonb
 when 'defense_up' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.4}'::jsonb
 when 'weaken' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"defense","multiplier":-0.2}'::jsonb
 when 'fang_wound' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"STACK","maxStacks":3,"amount":6}'::jsonb
 when 'crystal_glare' then '{"behavior":"STAT_MODIFIER","duration":2,"policy":"REFRESH_DURATION","stat":"attack","multiplier":-0.2}'::jsonb
 when 'crystal_venom' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":5}'::jsonb
 when 'crystal_hardening' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.35}'::jsonb
 when 'crystal_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.06}'::jsonb
 when 'crystal_shell' then '{"behavior":"SHIELD","duration":3,"policy":"REPLACE","shieldAmount":32}'::jsonb
 when 'kaleon_regen' then '{"behavior":"PERIODIC_HEAL","duration":3,"policy":"REFRESH_DURATION","amount":0.07}'::jsonb
 when 'kaleon_blight' then '{"behavior":"PERIODIC_DAMAGE","duration":3,"policy":"REFRESH_DURATION","amount":7}'::jsonb
 when 'kaleon_overgrowth' then '{"behavior":"STAT_MODIFIER","duration":3,"policy":"REFRESH_DURATION","stat":"defense","multiplier":0.3}'::jsonb
 when 'kaleon_transfer_mark' then '{"behavior":"STAT_MODIFIER","duration":5,"policy":"STACK","maxStacks":3,"stat":"defense","multiplier":-0.05}'::jsonb
 else null end
$$;
revoke all on function private.effect_definition(text) from public,anon,authenticated;

create or replace function private.apply_server_effect(p_effects jsonb,p_id text,p_turn bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d jsonb:=private.effect_definition(p_id);a jsonb;old jsonb;stacks int:=1;
begin
 if d is null then return p_effects;end if;
 select x into old from jsonb_array_elements(coalesce(p_effects,'[]'))x where x->>'effectId'=p_id limit 1;
 if old is not null and d->>'policy'='STACK' then stacks:=least(coalesce((d->>'maxStacks')::int,99),coalesce((old->>'stacks')::int,1)+1);end if;
 a:=jsonb_build_object('effectId',p_id,'duration',(d->>'duration')::int,'stacks',stacks,'createdTurn',p_turn,'currentTurn',p_turn,'behavior',d->>'behavior')||
   case when d ? 'stat' then jsonb_build_object('stat',d->>'stat','multiplier',(d->>'multiplier')::numeric) else '{}'::jsonb end||
   case when d ? 'amount' then jsonb_build_object('amount',(d->>'amount')::numeric) else '{}'::jsonb end;
 return (select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(p_effects,'[]'))x where x->>'effectId'<>p_id)||jsonb_build_array(a);
end $$;
revoke all on function private.apply_server_effect(jsonb,text,bigint) from public,anon,authenticated;

create or replace function private.server_monster_decision(p_combat private.online_combat_states)
returns jsonb language plpgsql immutable set search_path=''
as $$
declare id text:=p_combat.monster_id;hp numeric:=p_combat.monster_hp::numeric/nullif(p_combat.monster_max_hp,0);pc jsonb:=p_combat.monster_cooldowns;
begin
 -- Prepared charge always discharges before evaluating a new rule.
 if p_combat.monster_prepared_action is not null then
  return jsonb_build_object('kind','DAMAGE','id',p_combat.monster_prepared_action,'multiplier',
   case p_combat.monster_prepared_action when 'boar_charge' then 1.75 when 'vanguard_charge' then 1.9 when 'whiteglow_charge' then 1.9 when 'graft_charge' then 2.0 else 1.8 end,'prepared',true);
 end if;
 -- Current server-selected normal pools. Priority mirrors the TypeScript AI where represented.
 if id='wasteland_boar' and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='defense_up') and coalesce((pc->>'boar_hide_brace')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"boar_hide_brace","effect":"defense_up","cooldown":4}'::jsonb;end if;
 if id='wasteland_boar' and coalesce((pc->>'boar_charge')::int,0)=0 then return '{"kind":"CHARGE","id":"boar_charge","cooldown":3}'::jsonb;end if;
 if id='thorn_jackal' then
  if exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='fang_wound') and coalesce((pc->>'blood_scent_bite')::int,0)=0 then return '{"kind":"DAMAGE","id":"blood_scent_bite","multiplier":1.45,"cooldown":2}'::jsonb;end if;
  return '{"kind":"DAMAGE","id":"thorn_bite","multiplier":1.0,"cooldown":1,"effect":"fang_wound"}'::jsonb;
 end if;
 if id='carrion_vulture' and not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='weaken') and coalesce((pc->>'wing_feint')::int,0)=0 then return '{"kind":"EFFECT_TARGET","id":"wing_feint","effect":"weaken","cooldown":3}'::jsonb;end if;
 if id='hide_gnawer' and hp<.55 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='attack_up') and coalesce((pc->>'gnaw_frenzy')::int,0)=0 then return '{"kind":"EFFECT_SELF","id":"gnaw_frenzy","effect":"attack_up","cooldown":4}'::jsonb;end if;
 if id='moss_spirit' and hp<.7 and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_regen') then return '{"kind":"EFFECT_SELF","id":"moss_regen","effect":"kaleon_regen","cooldown":4}'::jsonb;end if;
 if id='spore_hound' then
  if exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') and coalesce((pc->>'sick_hunt')::int,0)=0 then return '{"kind":"DAMAGE","id":"sick_hunt","multiplier":1.45,"cooldown":2}'::jsonb;end if;
  return '{"kind":"DAMAGE","id":"spore_bite","multiplier":1.05,"cooldown":2,"effect":"kaleon_blight"}'::jsonb;
 end if;
 if id='graft_stag' and not exists(select 1 from jsonb_array_elements(p_combat.monster_effects)x where x->>'effectId'='kaleon_overgrowth') then return '{"kind":"EFFECT_SELF","id":"bark_growth","effect":"kaleon_overgrowth","cooldown":4}'::jsonb;end if;
 if id='graft_stag' then return '{"kind":"CHARGE","id":"graft_charge","cooldown":3}'::jsonb;end if;
 if id='blight_leech' and not exists(select 1 from jsonb_array_elements(p_combat.player_effects)x where x->>'effectId'='kaleon_blight') then return '{"kind":"EFFECT_TARGET","id":"blight_infect","effect":"kaleon_blight","cooldown":2}'::jsonb;end if;
 if id='receptor_aberrant' then return '{"kind":"EFFECT_TARGET","id":"transfer_mark","effect":"kaleon_transfer_mark","cooldown":1}'::jsonb;end if;
 return '{"kind":"BASIC","id":"basic","multiplier":1}'::jsonb;
end $$;
revoke all on function private.server_monster_decision(private.online_combat_states) from public,anon,authenticated;
