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

create or replace function private.resolve_server_monster_turn(p_combat private.online_combat_states)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare d jsonb:=private.server_monster_decision(p_combat);kind text:=d->>'kind';id text:=d->>'id';mult numeric:=coalesce((d->>'multiplier')::numeric,1);cd int:=coalesce((d->>'cooldown')::int,0);raw bigint:=0;absorb numeric:=0;effdef numeric;received numeric:=1;nextcd jsonb;effectid text:=d->>'effect';
begin
 select coalesce(jsonb_object_agg(key,to_jsonb(greatest(0,(value#>>'{}')::int-1))),'{}') into nextcd from jsonb_each(p_combat.monster_cooldowns);
 if cd>0 then nextcd:=nextcd||jsonb_build_object(id,cd);end if;
 if kind='CHARGE' then p_combat.monster_prepared_action:=id;
 elsif kind='EFFECT_SELF' then p_combat.monster_effects:=private.apply_server_effect(p_combat.monster_effects,effectid,p_combat.turn_no);
 elsif kind='EFFECT_TARGET' then p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.turn_no);
 else
  effdef:=p_combat.player_defense*greatest(.05,1+private.effect_modifier(p_combat.player_effects,'defense'));
  received:=greatest(.05,1+private.effect_modifier(p_combat.player_effects,'receivedDamage'));
  if p_combat.guard_turns>0 then received:=received*.6;end if;
  if p_combat.accessory_passive='unyielding' and p_combat.player_hp::numeric/nullif(p_combat.player_max_hp,0)<=.35 then received:=received*(1-p_combat.accessory_value);end if;
  raw:=greatest(1,round((p_combat.monster_attack*greatest(.05,1+private.effect_modifier(p_combat.monster_effects,'attack'))*mult-effdef)*received)::bigint);
  absorb:=least(p_combat.player_shield,raw);p_combat.player_shield:=p_combat.player_shield-absorb;raw:=raw-absorb;p_combat.player_hp:=greatest(0,p_combat.player_hp-raw);
  if effectid is not null and p_combat.player_hp>0 then p_combat.player_effects:=private.apply_server_effect(p_combat.player_effects,effectid,p_combat.turn_no);end if;
  if coalesce((d->>'prepared')::boolean,false) then p_combat.monster_prepared_action:=null;end if;
 end if;
 p_combat.monster_cooldowns:=nextcd;
 return jsonb_build_object('state',to_jsonb(p_combat),'action',d,'damage',raw,'absorbed',absorb);
end $$;
revoke all on function private.resolve_server_monster_turn(private.online_combat_states) from public,anon,authenticated;

create or replace function private.finish_server_player_action(p_user uuid,p_run private.online_expeditions,p_combat private.online_combat_states,p_nonce bigint,p_damage bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_kill bigint;v_heal bigint:=0;v_absorb numeric;v_turn jsonb;v_state private.online_combat_states%rowtype;v_action jsonb;v_ret bigint;v_player_delta bigint;v_monster_delta bigint;v_phase text;
begin
 v_absorb:=least(p_combat.monster_shield,p_damage);p_combat.monster_shield:=p_combat.monster_shield-v_absorb;p_damage:=p_damage-v_absorb;p_combat.monster_hp:=greatest(0,p_combat.monster_hp-p_damage);
 if p_combat.accessory_passive='vampire' and p_damage>0 then v_heal:=floor(p_damage*p_combat.accessory_value);p_combat.player_hp:=least(p_combat.player_max_hp,p_combat.player_hp+v_heal);end if;
 if p_combat.monster_hp=0 then
  v_kill:=p_run.confirmed_kills+1;insert into private.online_expedition_kills(user_id,run_id,kill_index,monster_id) values(p_user,p_run.run_id,v_kill,p_combat.monster_id);
  update private.online_expeditions set confirmed_kills=v_kill,last_confirmed_kill_at=now() where user_id=p_user;
  update private.online_combat_states set monster_hp=0,monster_shield=p_combat.monster_shield,player_hp=p_combat.player_hp,phase='DEFEATED',action_nonce=p_nonce,updated_at=now() where user_id=p_user;
  return jsonb_build_object('damage',p_damage,'absorbed',v_absorb,'healing',v_heal,'monsterHp',0,'playerHp',p_combat.player_hp,'phase','DEFEATED','confirmedKills',v_kill,'actionNonce',p_nonce);
 end if;
 v_turn:=private.resolve_server_monster_turn(p_combat);select * into v_state from jsonb_populate_record(null::private.online_combat_states,v_turn->'state');v_action:=v_turn->'action';v_ret:=coalesce((v_turn->>'damage')::bigint,0);
 v_player_delta:=private.effect_periodic_delta(v_state.player_effects,v_state.player_max_hp);v_monster_delta:=private.effect_periodic_delta(v_state.monster_effects,v_state.monster_max_hp);
 v_state.player_hp:=greatest(0,least(v_state.player_max_hp,v_state.player_hp+v_player_delta));v_state.monster_hp:=greatest(0,least(v_state.monster_max_hp,v_state.monster_hp+v_monster_delta));v_state.player_effects:=private.effect_tick(v_state.player_effects);v_state.monster_effects:=private.effect_tick(v_state.monster_effects);
 if v_state.player_hp=0 and v_state.revival_count>0 then v_phase:='PLAYER_DEAD';v_state.pending_revival:=true;else v_phase:=case when v_state.player_hp=0 then 'PLAYER_DEAD' else 'PLAYER_TURN' end;end if;
 update private.online_combat_states set monster_hp=v_state.monster_hp,player_hp=v_state.player_hp,player_shield=v_state.player_shield,monster_shield=v_state.monster_shield,player_effects=v_state.player_effects,monster_effects=v_state.monster_effects,monster_cooldowns=v_state.monster_cooldowns,monster_prepared_action=v_state.monster_prepared_action,turn_no=turn_no+1,guard_turns=greatest(0,guard_turns-1),phase=v_phase,pending_revival=v_state.pending_revival,action_nonce=p_nonce,updated_at=now() where user_id=p_user;
 return jsonb_build_object('damage',p_damage,'healing',v_heal,'monsterAction',v_action,'retaliation',v_ret,'periodicPlayer',v_player_delta,'periodicMonster',v_monster_delta,'monsterHp',v_state.monster_hp,'playerHp',v_state.player_hp,'playerShield',v_state.player_shield,'monsterShield',v_state.monster_shield,'phase',v_phase,'pendingRevival',v_state.pending_revival,'confirmedKills',p_run.confirmed_kills,'actionNonce',p_nonce);
end $$;
