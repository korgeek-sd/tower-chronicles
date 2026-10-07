create or replace function private.combat_v2_condition(c private.online_combat_states,q jsonb,actor text default 'monster',spent int default 0,action text default 'SKILL')
returns boolean language plpgsql immutable set search_path='' as $$
declare kind text:=q->>'kind';self_hp numeric:=case when actor='player' then c.player_hp/nullif(c.player_max_hp,0) else c.monster_hp/nullif(c.monster_max_hp,0) end;target_hp numeric:=case when actor='player' then c.monster_hp/nullif(c.monster_max_hp,0) else c.player_hp/nullif(c.player_max_hp,0) end;self_effects jsonb:=case when actor='player' then c.player_effects else c.monster_effects end;target_effects jsonb:=case when actor='player' then c.monster_effects else c.player_effects end;x jsonb;v numeric;
begin
 if kind='ALL' then for x in select value from jsonb_array_elements(q->'conditions') loop if not private.combat_v2_condition(c,x,actor,spent,action) then return false;end if;end loop;return true;end if;
 if kind='ANY' then for x in select value from jsonb_array_elements(q->'conditions') loop if private.combat_v2_condition(c,x,actor,spent,action) then return true;end if;end loop;return false;end if;
 if kind='SELF_HP_BELOW' then return self_hp<(q->>'value')::numeric;elsif kind='TARGET_HP_BELOW' then return target_hp<(q->>'value')::numeric;
 elsif kind='SELF_HP_RATIO_LE' then return self_hp<=(q->>'ratio')::numeric;elsif kind='SELF_HP_RATIO_GT' then return self_hp>(q->>'ratio')::numeric;elsif kind='TARGET_HP_RATIO_LE' then return target_hp<=(q->>'ratio')::numeric;
 elsif kind='SELF_HAS_EFFECT' then return private.combat_v2_has(self_effects,q->>'effectId');elsif kind='TARGET_HAS_EFFECT' then return private.combat_v2_has(target_effects,q->>'effectId');
 elsif kind='SELF_MISSING_EFFECT' then return not private.combat_v2_has(self_effects,q->>'effectId');elsif kind='TARGET_MISSING_EFFECT' then return not private.combat_v2_has(target_effects,q->>'effectId');
 elsif kind='RESOURCE_GE' then return c.job_resource>=(q->>'amount')::int;elsif kind='RESOURCE_SPENT_GE' then return spent>=(q->>'amount')::int;
 elsif kind='FLAG_IS' then return coalesce((c.job_flags->>(q->>'flag'))::boolean,false)=(q->>'value')::boolean;
 elsif kind='ACTION_IS_BASIC_ATTACK' then return action='BASIC';elsif kind='ACTION_IS_SKILL' then return action='SKILL';elsif kind='ACTION_IS_POTION' then return action='POTION';elsif kind='IS_DIRECT_HIT' then return true;
 elsif kind='TURN_AT_LEAST' then return c.monster_turn>=(q->>'value')::int;elsif kind='EVENT_FLAG' then return coalesce((c.engine_runtime->'eventFlags'->>(q->>'flag'))::boolean,false);
 elsif kind='PHASE_IS' then return c.engine_runtime->>'phaseId'=q->>'phaseId';elsif kind='PREVIOUS_ACTION' then return c.engine_runtime->>'lastActionId'=q->>'actionId';
 elsif kind='SKILL_USES_AT_LEAST' then return coalesce((c.engine_runtime->'actionCounts'->>(q->>'skillId'))::int,0)>=(q->>'value')::int;
 elsif kind='SKILL_READY' then return coalesce((c.engine_runtime->'monsterReady'->>(q->>'skillId'))::bigint,0)<=c.monster_turn;
 elsif kind='SELF_SHIELD_AT_LEAST' then return private.combat_v2_shield(self_effects)>=(q->>'value')::numeric;elsif kind='TARGET_SHIELD_AT_LEAST' then return private.combat_v2_shield(target_effects)>=(q->>'value')::numeric;
 elsif kind in ('SELF_EFFECT_APPLICATIONS_AT_LEAST','TARGET_EFFECT_APPLICATIONS_AT_LEAST','SELF_EFFECT_STACKS_AT_LEAST','TARGET_EFFECT_STACKS_AT_LEAST') then
  select coalesce((e->>case when kind like '%APPLICATIONS%' then 'applications' else 'stacks' end)::int,1) into v from jsonb_array_elements(case when kind like 'SELF%' then self_effects else target_effects end)e where e->>'effectId'=q->>'effectId';return coalesce(v,0)>=(q->>'requiredStacks')::int;
 end if;return false;
end $$;

create or replace function private.combat_v2_effect(c private.online_combat_states,actor text,id text,source text)
returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare definition jsonb:=private.combat_v2_catalog()->'monsters'->c.monster_id;d jsonb:=private.combat_v2_definition(id);immune jsonb:=coalesce(c.engine_runtime->'immunities',definition->'effectImmunities','[]');tag text;
begin
 if actor='monster' then
  if immune ? id then return c;end if;
  for tag in select jsonb_array_elements_text(coalesce(d->'tags','[]')) loop if immune ? tag then return c;end if;end loop;
  if id='iron_armor' then c.monster_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(coalesce(c.monster_effects,'[]'))x where x->>'effectId'<>'fracture');end if;
  c.monster_effects:=private.combat_v2_apply_effect(c.monster_effects,id,c.monster_turn,c.monster_max_hp,source);
  c.monster_shield:=private.combat_v2_shield(c.monster_effects);
  if coalesce(d->'tags','[]') ? 'STUN' then c.monster_prepared_action:=null;c.engine_runtime:=c.engine_runtime||jsonb_build_object('eventFlags',coalesce(c.engine_runtime->'eventFlags','{}')||'{"interrupted":true,"stunned":true}');end if;
 else c.player_effects:=private.combat_v2_apply_effect(c.player_effects,id,c.player_turn,c.player_max_hp,source);c.player_shield:=private.combat_v2_shield(c.player_effects);end if;
 return c;
end $$;

create or replace function private.combat_v2_absorb(effects jsonb,shield numeric,incoming numeric) returns jsonb language plpgsql immutable set search_path='' as $$
declare x jsonb;remaining numeric:=greatest(0,incoming);taken numeric;next_effects jsonb:='[]';pool numeric:=greatest(0,coalesce(shield,0));
begin
 -- Older scalar shields become one pool until an authored shield is applied.
 if private.combat_v2_shield(effects)=0 and pool>0 then taken:=least(pool,remaining);return jsonb_build_object('effects',coalesce(effects,'[]'),'shield',pool-taken,'hpDamage',remaining-taken,'absorbed',taken);end if;
 for x in select value from jsonb_array_elements(coalesce(effects,'[]')) loop
  if x->>'behavior'='SHIELD' and coalesce((x->>'currentShield')::numeric,0)>0 then
   taken:=least((x->>'currentShield')::numeric,remaining);remaining:=remaining-taken;x:=x||jsonb_build_object('currentShield',(x->>'currentShield')::numeric-taken);
   if (x->>'currentShield')::numeric<=0 then continue;end if;
  end if;next_effects:=next_effects||jsonb_build_array(x);
 end loop;
 return jsonb_build_object('effects',next_effects,'shield',private.combat_v2_shield(next_effects),'hpDamage',remaining,'absorbed',incoming-remaining);
end $$;

create or replace function private.combat_v2_hit(c private.online_combat_states,actor text,mult numeric,nonce bigint,idx int,hits int,reactive boolean default true,penetration numeric default 0,critical_mode text default null)
returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare target text:=case when actor='player' then 'monster' else 'player' end;src jsonb:=case when actor='player' then c.player_effects else c.monster_effects end;dst jsonb:=case when actor='player' then c.monster_effects else c.player_effects end;attack numeric;defense numeric;received numeric;crit numeric:=1;is_crit boolean:=false;outcome text:='HIT';incoming numeric:=0;actual numeric:=0;absorbed numeric:=0;shield_before numeric;result jsonb;reaction text;skill jsonb;stance boolean;gain int;heal numeric;i int;
begin
 if c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false) then return c;end if;
 if reactive then c.engine_runtime:=coalesce(c.engine_runtime,'{}')||jsonb_build_object('actionOwner',actor);end if;
 if private.combat_v2_modifier(dst,'hitImmunity')>0 then outcome:='IMMUNE';elsif private.server_roll(c.rng_seed,c.encounter_index,nonce,idx+2000)<private.combat_v2_modifier(src,'missChance') then outcome:='MISS';end if;
 if outcome='HIT' then
  is_crit:=coalesce(critical_mode='GUARANTEED',false) or ((actor='player' or coalesce(critical_mode='ALLOWED',false)) and private.server_roll(c.rng_seed,c.encounter_index,nonce,idx)<greatest(0,least(1,case when actor='player' then coalesce(c.crit_chance,.05) else .05 end+private.combat_v2_modifier(src,'critChance'))));
  crit:=case when is_crit then case when actor='player' then coalesce(c.crit_damage,1.5) else 1.5 end+private.combat_v2_modifier(src,'critDamage') else 1 end;
  attack:=case when actor='player' then c.player_attack else c.monster_attack*coalesce((c.engine_runtime->>'attackMultiplier')::numeric,1) end*greatest(0,1+private.combat_v2_modifier(src,'attack'));
  if actor='player' and c.accessory_passive='berserker' and c.player_hp/nullif(c.player_max_hp,0)<=.4 then attack:=attack*(1+c.accessory_value);end if;
  defense:=case when actor='player' then c.monster_defense*coalesce((c.engine_runtime->>'defenseMultiplier')::numeric,1) else c.player_defense end*greatest(0,1+private.combat_v2_modifier(dst,'defense'));
  received:=greatest(0,1+private.combat_v2_modifier(dst,'receivedDamage'));
  stance:=actor='monster' and reactive and private.combat_v2_has(dst,'duelist_counter_stance');
  if actor='monster' then
   null;
   null;
   if c.accessory_passive='unyielding' and c.player_hp/nullif(c.player_max_hp,0)<=.35 then received:=received*(1-c.accessory_value);end if;
  end if;
  incoming:=private.combat_v2_damage(attack,defense,mult*greatest(0,1+private.combat_v2_modifier(src,'outgoingDamage')),crit,1,penetration);
  if stance then incoming:=incoming*.6;end if;
  incoming:=greatest(1,floor(incoming*received));
  if actor='monster' and c.job_id='contract_mercenary' then incoming:=incoming*.92;elsif actor='monster' and c.job_id='berserker' and c.player_hp/nullif(c.player_max_hp,0)<=.3 then incoming:=incoming*.85;end if;
  shield_before:=case when actor='player' then c.monster_shield else c.player_shield end;
  result:=private.combat_v2_absorb(dst,shield_before,incoming);actual:=(result->>'hpDamage')::numeric;absorbed:=(result->>'absorbed')::numeric;
  if actor='player' then c.monster_hp:=greatest(0,c.monster_hp-actual);c.monster_effects:=result->'effects';c.monster_shield:=(result->>'shield')::numeric;
  else c.player_hp:=greatest(0,c.player_hp-actual);c.player_effects:=result->'effects';c.player_shield:=(result->>'shield')::numeric;end if;
  if actual=0 and absorbed>0 then outcome:='BLOCKED_BY_SHIELD';end if;
  if shield_before>0 and (result->>'shield')::numeric=0 then c.engine_runtime:=c.engine_runtime||jsonb_build_object('eventFlags',coalesce(c.engine_runtime->'eventFlags','{}')||jsonb_build_object(target||':shieldBroken',true));end if;
 end if;
 c:=private.combat_v2_event(c,jsonb_build_object('kind','DIRECT_DAMAGE','attacker',actor,'target',target,'incomingDamage',incoming,'absorbedByShield',absorbed,'hpDamage',actual,'critical',is_crit,'outcome',outcome,'origin',case when reactive then 'ACTION' else 'REACTION' end,'hitIndex',case when reactive then idx else least(hits,greatest(1,idx-900)) end,'hitCount',hits));
 if c.monster_hp<=0 then c.monster_reactive_action:=null;return c;end if;
 if c.player_hp<=0 then c.pending_revival:=coalesce(c.revival_count,0)>0;c.engine_runtime:=c.engine_runtime||jsonb_build_object('revivalSource','DIRECT_HIT','resumeTurn',case when coalesce(c.engine_runtime->>'actionOwner',actor)='player' then 'MONSTER_TURN' else 'PLAYER_TURN' end);return c;end if;
 if actual>0 and actor='player' and c.monster_id='black_vein_armor_breaker' and private.combat_v2_has(c.monster_effects,'iron_armor') then
  c:=private.combat_v2_effect(c,'monster','fracture','player');
  if exists(select 1 from jsonb_array_elements(c.monster_effects)x where x->>'effectId'='fracture' and (x->>'applications')::int>=3) then c.monster_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(c.monster_effects)x where x->>'effectId' not in('iron_armor','fracture'));c:=private.combat_v2_effect(c,'monster','exposed_core','player');end if;
 end if;
 if actual>0 and actor='player' and c.accessory_passive='vampire' then c:=private.combat_v2_heal(c,'player',floor(actual*c.accessory_value),false,nonce,idx+1100);end if;
 if actual>0 and actor='monster' then
  if c.job_id='berserker' then c.job_resource:=least(4,c.job_resource+greatest(1,floor(actual/c.player_max_hp*4)::int));end if;
  if c.job_id='field_medic' and not coalesce((c.job_flags->>'first_aid_used')::boolean,false) and c.player_hp/c.player_max_hp<=.3 then c:=private.combat_v2_heal(c,'player',round(c.player_max_hp*.15),true,nonce,idx+1000);c.job_flags:=coalesce(c.job_flags,'{}')||'{"first_aid_used":true}';end if;
 end if;
 if incoming>0 and reactive then
  if actor='player' and c.monster_reactive_action is not null then
   reaction:=c.monster_reactive_action;c.monster_reactive_action:=null;select value into skill from jsonb_array_elements(coalesce(private.combat_v2_catalog()->'monsters'->c.monster_id->'skills','[]')) where value->>'id'=reaction;
   for i in 1..greatest(1,coalesce((skill->>'hits')::int,1)) loop c:=private.combat_v2_hit(c,'monster',coalesce((skill->>'multiplier')::numeric,1),nonce,900+i,coalesce((skill->>'hits')::int,1),false,coalesce((skill->>'penetrationRate')::numeric,0),skill->>'critical');exit when c.player_hp<=0 or c.monster_hp<=0;end loop;
  elsif actor='monster' and stance then
   c.player_effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(c.player_effects)x where x->>'effectId'<>'duelist_counter_stance');c:=private.combat_v2_hit(c,'player',1.8*c.skill_power,nonce,901,1,false);
  elsif actor='monster' and actual>0 and c.job_id='duelist' and private.server_roll(c.rng_seed,c.encounter_index,nonce,idx+701)<.2 then c:=private.combat_v2_hit(c,'player',.6*c.skill_power,nonce,902,1,false);
  end if;
 end if;
 return c;
end $$;

create or replace function private.combat_v2_remove(effects jsonb,category text,amount int default 2147483647,tags jsonb default null) returns jsonb language sql immutable set search_path='' as $$
 with eligible as(select ord from jsonb_array_elements(coalesce(effects,'[]')) with ordinality t(x,ord) where private.combat_v2_definition(x->>'effectId')->>'category'=category and private.combat_v2_definition(x->>'effectId')->>'behavior'<>'SHIELD' and (tags is null or exists(select 1 from jsonb_array_elements_text(tags)t where private.combat_v2_definition(x->>'effectId')->'tags' ? t)) order by case when private.combat_v2_has(jsonb_build_array(x),'STUN') then 0 when private.combat_v2_has(jsonb_build_array(x),'SILENCE') then 1 when private.combat_v2_has(jsonb_build_array(x),'DOT') then 2 when private.combat_v2_has(jsonb_build_array(x),'STAT_DOWN') then 3 when private.combat_v2_has(jsonb_build_array(x),'ROOT') then 4 else 5 end,ord limit greatest(0,amount))
 select coalesce(jsonb_agg(x order by ord),'[]') from jsonb_array_elements(coalesce(effects,'[]')) with ordinality t(x,ord) where ord not in(select ord from eligible);
$$;

create or replace function private.combat_v2_job_skill(c private.online_combat_states,id text,nonce bigint)
returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare skill jsonb;resource jsonb;cost jsonb;spent int:=0;a jsonb;q jsonb;mult numeric;hits int;i int;start_events int;successful boolean:=false;offensive boolean:=false;effects jsonb;tag jsonb;
begin
 select value into skill from jsonb_array_elements(coalesce(private.combat_v2_catalog()->'jobs'->c.job_id->'skills','[]')) where value->>'id'=id;
 if skill is null then raise exception 'COMBAT_SKILL_INVALID';end if;
 if private.combat_v2_has(c.player_effects,'SILENCE') then raise exception 'COMBAT_SILENCED';end if;
 if coalesce((c.engine_runtime->'playerReady'->>id)::bigint,0)>c.player_turn or coalesce((c.cooldowns->>('turn:'||id))::int,0)>0 then raise exception 'COMBAT_SKILL_COOLDOWN';end if;
 for q in select value from jsonb_array_elements(coalesce(skill->'conditions','[]')) loop if not private.combat_v2_condition(c,q,'player') then raise exception 'COMBAT_SKILL_CONDITION';end if;end loop;
 resource:=skill->'resource';cost:=resource->'cost';
 if resource->>'kind'='SPENDER' then
  spent:=case when cost->>'mode'='FIXED' then (cost->>'amount')::int else least(c.job_resource,(cost->>'max')::int) end;
  if c.job_resource<(case when cost->>'mode'='FIXED' then spent else (cost->>'min')::int end) then raise exception 'COMBAT_SKILL_RESOURCE';end if;c.job_resource:=c.job_resource-spent;
 end if;
 c.engine_runtime:=coalesce(c.engine_runtime,'{}')||jsonb_build_object('playerReady',coalesce(c.engine_runtime->'playerReady','{}')||jsonb_build_object(id,c.player_turn+(skill->>'cooldown')::int+1));c.cooldowns:=coalesce(c.cooldowns,'{}')||jsonb_build_object('turn:'||id,(skill->>'cooldown')::int);
 for a in select value from jsonb_array_elements(skill->'effectActions') loop
  exit when c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false);
  if a->>'kind'='DIRECT_ATTACK' then
   offensive:=true;hits:=(a->>'hits')::int;if a ? 'conditionalHits' and private.combat_v2_condition(c,a->'conditionalHits'->'condition','player',spent) then hits:=(a->'conditionalHits'->>'hits')::int;end if;
   for i in 1..hits loop
    exit when c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false);mult:=(a->>'baseMultiplier')::numeric;
    if i=hits and a ? 'conditionalLastHitMultiplier' and private.combat_v2_condition(c,a->'conditionalLastHitMultiplier'->'condition','player',spent) then mult:=(a->'conditionalLastHitMultiplier'->>'multiplier')::numeric;end if;
    start_events:=jsonb_array_length(coalesce(c.engine_runtime->'events','[]'));c:=private.combat_v2_hit(c,'player',mult*c.skill_power*private.server_job_damage_multiplier(c,'SKILL'),nonce,i,hits,true,coalesce((a->>'penetrationRate')::numeric,0),a->>'critical');
    select value into q from jsonb_array_elements(c.engine_runtime->'events') with ordinality t(value,ord) where ord>start_events and value->>'attacker'='player' and value->>'origin'='ACTION' and (value->>'hitIndex')::int=i order by ord limit 1;
    if coalesce((q->>'incomingDamage')::numeric,0)>0 then successful:=true;end if;
    if coalesce((q->>'hpDamage')::numeric,0)>0 and c.monster_hp>0 then for q in select value from jsonb_array_elements(coalesce(a->'onHitEffects','[]')) loop c:=private.combat_v2_effect(c,'monster',q->>'effectId','player');end loop;end if;
   end loop;
  elsif a->>'kind'='APPLY_EFFECT' then
   effects:=case when a->>'target'='SELF' then c.player_effects else c.monster_effects end;
   c:=private.combat_v2_effect(c,case when a->>'target'='SELF' then 'player' else 'monster' end,a->>'effectId','player');
   q:=private.combat_v2_definition(a->>'effectId');
   if a ? 'duration' and q->>'behavior'<>'SHIELD' and effects is distinct from (case when a->>'target'='SELF' then c.player_effects else c.monster_effects end) then
    select coalesce(jsonb_agg(case when x->>'effectId'=a->>'effectId' then x||jsonb_build_object('duration',case when q->>'stackingPolicy'='EXTEND_DURATION' then (x->>'duration')::int-(q->>'defaultDuration')::int+(a->>'duration')::int else (a->>'duration')::int end) else x end order by ord),'[]') into effects
    from jsonb_array_elements(case when a->>'target'='SELF' then c.player_effects else c.monster_effects end) with ordinality t(x,ord);
    if a->>'target'='SELF' then c.player_effects:=effects;else c.monster_effects:=effects;end if;
   end if;
  elsif a->>'kind'='HEAL_ATTACK' then c:=private.combat_v2_heal(c,'player',round(c.player_attack*greatest(0,1+private.combat_v2_modifier(c.player_effects,'attack'))*(a->>'multiplier')::numeric),true,nonce,1100);
  elsif a->>'kind' in ('HEAL_PERCENT','HEAL_FLAT') then c:=private.combat_v2_heal(c,'player',case when a->>'kind'='HEAL_FLAT' then (a->>'amount')::numeric else round(c.player_max_hp*(a->>'percent')::numeric) end,true,nonce,1100);
  elsif a->>'kind'='SELF_HP_COST_PERCENT' then c.player_hp:=greatest(1,c.player_hp-round(c.player_max_hp*(a->>'percentOfMax')::numeric));
  elsif a->>'kind'='CHANGE_RESOURCE' then c.job_resource:=greatest(0,least(4,c.job_resource+(a->>'delta')::int));
  elsif a->>'kind'='SET_FLAG' then c.job_flags:=coalesce(c.job_flags,'{}')||jsonb_build_object(a->>'flag',(a->>'value')::boolean);
  elsif a->>'kind' in ('CLEANSE','DISPEL','REMOVE_EFFECT_TAG') then
   effects:=case when a->>'target'='SELF' then c.player_effects else c.monster_effects end;
   if a->>'kind'='REMOVE_EFFECT_TAG' then effects:=(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(effects)x where not private.combat_v2_has(jsonb_build_array(x),a->>'tag') or x->>'behavior'='SHIELD');
   else effects:=private.combat_v2_remove(effects,case when a->>'kind'='DISPEL' then 'BUFF' else 'DEBUFF' end,coalesce((a->>'count')::int,2147483647),a->'tags');end if;
   if a->>'target'='SELF' then c.player_effects:=effects;else c.monster_effects:=effects;end if;
  else raise exception 'COMBAT_ACTION_UNSUPPORTED';end if;
 end loop;
 if resource->>'kind'='GENERATOR' and (not offensive or successful) and c.player_hp>0 and not coalesce(c.pending_revival,false) then c.job_resource:=least(4,c.job_resource+(resource->>'gain')::int);end if;
 return c;
end $$;

create or replace function private.combat_v2_consume_event(c private.online_combat_states,q jsonb) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare x jsonb;
begin
 if q->>'kind'='EVENT_FLAG' then c.engine_runtime:=c.engine_runtime||jsonb_build_object('eventFlags',coalesce(c.engine_runtime->'eventFlags','{}')||jsonb_build_object(q->>'flag',false));
 elsif q->>'kind'='ALL' then for x in select value from jsonb_array_elements(q->'conditions') loop c:=private.combat_v2_consume_event(c,x);end loop;
 elsif q->>'kind'='ANY' then for x in select value from jsonb_array_elements(q->'conditions') loop if private.combat_v2_condition(c,x) then c:=private.combat_v2_consume_event(c,x);exit;end if;end loop;end if;
 return c;
end $$;
create or replace function private.combat_v2_phase(c private.online_combat_states) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare d jsonb:=private.combat_v2_catalog()->'monsters'->c.monster_id;phases jsonb:=coalesce(d->'phases','[]');idx int:=coalesce((c.engine_runtime->>'phaseIndex')::int,0);p jsonb;next_phase jsonb;
begin
 c.engine_runtime:=coalesce(c.engine_runtime,'{}');
 while idx+1<jsonb_array_length(phases) loop next_phase:=phases->(idx+1);exit when next_phase->'when' is null or not private.combat_v2_condition(c,next_phase->'when');idx:=idx+1;c:=private.combat_v2_consume_event(c,next_phase->'when');end loop;
 p:=phases->idx;c.engine_runtime:=c.engine_runtime||jsonb_build_object('phaseIndex',idx,'phaseId',p->>'id','immunities',coalesce(d->'effectImmunities','[]')||coalesce(p->'effectImmunities','[]'),'attackMultiplier',coalesce((p->>'attackMultiplier')::numeric,1),'defenseMultiplier',coalesce((p->>'defenseMultiplier')::numeric,1));return c;
end $$;
create or replace function private.combat_v2_eligible(c private.online_combat_states,skill jsonb,phase jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare q jsonb;
begin
 if coalesce((c.engine_runtime->'monsterReady'->>(skill->>'id'))::bigint,0)>c.monster_turn then return false;end if;
 if phase ? 'skillIds' and not (phase->'skillIds' ? (skill->>'id')) then return false;end if;
 if skill ? 'phaseIds' and not (skill->'phaseIds' ? (c.engine_runtime->>'phaseId')) then return false;end if;
 if skill->>'id'=c.engine_runtime->>'lastActionId' and (coalesce((skill->>'cannotRepeat')::boolean,false) or coalesce((c.engine_runtime->>'repeatCount')::int,0)>=coalesce((skill->>'repeatLimit')::int,2147483647)) then return false;end if;
 for q in select value from jsonb_array_elements(coalesce(skill->'conditions','[]')) loop if not private.combat_v2_condition(c,q) then return false;end if;end loop;return true;
end $$;
create or replace function private.combat_v2_monster_decision(c private.online_combat_states,nonce bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare d jsonb:=private.combat_v2_catalog()->'monsters'->c.monster_id;skills jsonb:=coalesce(d->'skills','[]');phase jsonb;skill jsonb;rule jsonb;q jsonb;allowed boolean;candidates jsonb:='[]';candidate jsonb;weight numeric;total numeric:=0;roll numeric;
begin
 c:=private.combat_v2_phase(c);phase:=d->'phases'->coalesce((c.engine_runtime->>'phaseIndex')::int,0);
 if c.monster_prepared_action is not null then select value into skill from jsonb_array_elements(skills) where value->>'id'=c.monster_prepared_action;if skill->>'kind'='charge' then return jsonb_build_object('state',to_jsonb(c),'action',skill||'{"prepared":true}');end if;end if;
 if private.combat_v2_has(c.monster_effects,'SILENCE') then return jsonb_build_object('state',to_jsonb(c),'action','{"kind":"BASIC","id":"basic"}'::jsonb);end if;
 for rule in select value from jsonb_array_elements(coalesce(d->'aiRules','[]')) order by (value->>'priority')::int desc,value->>'id' loop
  select value into skill from jsonb_array_elements(skills) where value->>'id'=rule->>'actionId';if skill is null or not private.combat_v2_eligible(c,skill,phase) then continue;end if;allowed:=true;
  for q in select value from jsonb_array_elements(coalesce(rule->'conditions','[]')) loop if not private.combat_v2_condition(c,q) then allowed:=false;exit;end if;end loop;
  if not allowed then continue;end if;
  if coalesce((rule->>'forced')::boolean,true) then return jsonb_build_object('state',to_jsonb(c),'action',skill);end if;
  weight:=coalesce((phase->'skillWeights'->>(skill->>'id'))::numeric,(rule->>'weight')::numeric,(skill->>'weight')::numeric,1);candidates:=candidates||jsonb_build_array(jsonb_build_object('skill',skill,'weight',greatest(0,weight)));
 end loop;
 for skill in select value from jsonb_array_elements(skills) loop
  if skill ? 'weight' and private.combat_v2_eligible(c,skill,phase) and not exists(select 1 from jsonb_array_elements(candidates)x where x->'skill'->>'id'=skill->>'id') then candidates:=candidates||jsonb_build_array(jsonb_build_object('skill',skill,'weight',greatest(0,coalesce((phase->'skillWeights'->>(skill->>'id'))::numeric,(skill->>'weight')::numeric))));end if;
 end loop;
 if d ? 'basicAttackWeight' then candidates:=candidates||jsonb_build_array(jsonb_build_object('skill','{"kind":"BASIC","id":"basic"}'::jsonb,'weight',greatest(0,(d->>'basicAttackWeight')::numeric)));end if;
 select coalesce(sum((x->>'weight')::numeric),0) into total from jsonb_array_elements(candidates)x;
 if total>0 then roll:=private.server_roll(c.rng_seed,c.encounter_index,nonce,3000+c.monster_turn::int)*total;for candidate in select value from jsonb_array_elements(candidates) loop roll:=roll-(candidate->>'weight')::numeric;if roll<0 then return jsonb_build_object('state',to_jsonb(c),'action',candidate->'skill');end if;end loop;end if;
 return jsonb_build_object('state',to_jsonb(c),'action','{"kind":"BASIC","id":"basic"}'::jsonb);
end $$;
create or replace function private.resolve_server_monster_turn_v2(p_combat private.online_combat_states,p_nonce bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare c private.online_combat_states:=p_combat;result jsonb;a jsonb;effect jsonb;event jsonb;idx int;hits int;before_hp numeric:=c.player_hp;id text;ready jsonb;repeat_count int;start_events int;
begin
 c.monster_turn:=c.monster_turn+1;c:=private.combat_v2_phase(c);
 select coalesce(jsonb_object_agg(key,greatest(0,(value#>>'{}')::bigint-c.monster_turn)),'{}') into c.monster_cooldowns from jsonb_each(coalesce(c.engine_runtime->'monsterReady','{}'));
 if private.combat_v2_has(c.monster_effects,'STUN') then c.monster_prepared_action:=null;return jsonb_build_object('state',to_jsonb(c),'action','{"kind":"SKIP","id":"stun"}'::jsonb,'damage',0);end if;
 result:=private.combat_v2_monster_decision(c,p_nonce);select * into c from jsonb_populate_record(null::private.online_combat_states,result->'state');a:=result->'action';id:=a->>'id';hits:=coalesce((a->>'hits')::int,1);
 repeat_count:=case when c.engine_runtime->>'lastActionId'=id then coalesce((c.engine_runtime->>'repeatCount')::int,0)+1 else 1 end;
 c.engine_runtime:=c.engine_runtime||jsonb_build_object('lastActionId',id,'repeatCount',repeat_count,'actionCounts',coalesce(c.engine_runtime->'actionCounts','{}')||jsonb_build_object(id,coalesce((c.engine_runtime->'actionCounts'->>id)::int,0)+1));
 if a->>'kind'='charge' and not coalesce((a->>'prepared')::boolean,false) then c.monster_prepared_action:=id;return jsonb_build_object('state',to_jsonb(c),'action',a||'{"kind":"CHARGE"}','damage',0);end if;
 if a->>'kind'='reactive_prepare' then c.monster_reactive_action:=a->>'reactionSkillId';
 else
  if a->>'kind' in ('damage','charge','BASIC') then
   for idx in 1..hits loop
    exit when c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false);
    start_events:=jsonb_array_length(coalesce(c.engine_runtime->'events','[]'));c:=private.combat_v2_hit(c,'monster',coalesce((a->>'multiplier')::numeric,1),p_nonce,idx,hits,true,coalesce((a->>'penetrationRate')::numeric,0),a->>'critical');
    select value into event from jsonb_array_elements(c.engine_runtime->'events') with ordinality t(value,ord) where ord>start_events and value->>'attacker'='monster' and value->>'origin'='ACTION' and (value->>'hitIndex')::int=idx order by ord limit 1;
    if coalesce((event->>'hpDamage')::numeric,0)>0 and c.player_hp>0 then for effect in select value from jsonb_array_elements(coalesce(a->'effects','[]')) where value->>'target'='TARGET' loop c:=private.combat_v2_effect(c,'player',effect->>'effectId','monster');end loop;end if;
   end loop;
  end if;
  if c.player_hp>0 and c.monster_hp>0 and not coalesce(c.pending_revival,false) then for effect in select value from jsonb_array_elements(coalesce(a->'effects','[]')) loop if a->>'kind'='effect' or effect->>'target'='SELF' then c:=private.combat_v2_effect(c,case when effect->>'target'='SELF' then 'monster' else 'player' end,effect->>'effectId','monster');end if;end loop;end if;
 end if;
 if coalesce((a->>'prepared')::boolean,false) then c.monster_prepared_action:=null;end if;
 if id<>'basic' then ready:=coalesce(c.engine_runtime->'monsterReady','{}')||jsonb_build_object(id,c.monster_turn+coalesce((a->>'cooldown')::int,0)+1);c.engine_runtime:=c.engine_runtime||jsonb_build_object('monsterReady',ready);end if;
 select coalesce(jsonb_object_agg(key,greatest(0,(value#>>'{}')::bigint-c.monster_turn)),'{}') into c.monster_cooldowns from jsonb_each(coalesce(c.engine_runtime->'monsterReady','{}'));
 if id<>'basic' then c.monster_cooldowns:=c.monster_cooldowns||jsonb_build_object(id,coalesce((a->>'cooldown')::int,0));end if;
 return jsonb_build_object('state',to_jsonb(c),'action',a,'damage',greatest(0,before_hp-c.player_hp));
end $$;

create or replace function private.combat_v2_initialize(c private.online_combat_states,fresh boolean default false) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare x jsonb;effects jsonb;actor text;shield numeric;ready jsonb;entry record;budget numeric;amount numeric;
begin
 c.engine_runtime:=coalesce(c.engine_runtime,'{}');
 if fresh then
  c.engine_runtime:='{"version":2,"events":[],"playerReady":{},"monsterReady":{}}';c.cooldowns:='{}';c.monster_cooldowns:='{}';c.job_resource:=0;c.job_flags:='{}';c.player_effects:='[]';c.monster_effects:='[]';c.player_shield:=0;c.monster_shield:=0;c.player_shield_hits:=0;c.monster_shield_hits:=0;c.monster_prepared_action:=null;c.monster_reactive_action:=null;c.pending_revival:=false;c.player_turn:=1;c.monster_turn:=0;c.player_hp:=least(c.player_hp,c.player_max_hp);
  c:=private.combat_v2_phase(c);
  if c.monster_id='black_vein_armor_breaker' then c:=private.combat_v2_effect(c,'monster','iron_armor','monster');elsif c.monster_id='sanctuary_talon_bishop' then c:=private.combat_v2_effect(c,'monster','blood_rite_ward','monster');end if;
 elsif c.engine_runtime->>'version' is distinct from '2' then
  c.job_resource:=greatest(0,least(4,floor(coalesce(c.job_resource,0)/25.0)::int));
  c.engine_runtime:=c.engine_runtime||'{"version":2,"events":[]}';
  ready:='{}';for entry in select * from jsonb_each(coalesce(c.cooldowns,'{}')) loop ready:=ready||jsonb_build_object(regexp_replace(entry.key,'^turn:',''),c.player_turn+(entry.value#>>'{}')::int);end loop;c.engine_runtime:=c.engine_runtime||jsonb_build_object('playerReady',ready);
  ready:='{}';for entry in select * from jsonb_each(coalesce(c.monster_cooldowns,'{}')) loop ready:=ready||jsonb_build_object(entry.key,c.monster_turn+(entry.value#>>'{}')::int);end loop;c.engine_runtime:=c.engine_runtime||jsonb_build_object('monsterReady',ready);
  for actor in select unnest(array['player','monster']) loop
   shield:=case when actor='player' then c.player_shield else c.monster_shield end;budget:=greatest(0,least(coalesce(shield,0),3*case when actor='player' then c.player_max_hp else c.monster_max_hp end));
   effects:='[]';for x in select value from jsonb_array_elements(case when actor='player' then c.player_effects else c.monster_effects end) loop
    x:=x||jsonb_build_object('applications',coalesce((x->>'applications')::int,(x->>'stacks')::int,1),'stacks',1,'sourceActorId',coalesce(x->>'sourceActorId',case when coalesce(private.combat_v2_definition(x->>'effectId')->>'category','DEBUFF')='BUFF' then actor else case when actor='player' then 'monster' else 'player' end end));
    if x->>'behavior'='SHIELD' then amount:=least(budget,coalesce((x->>'currentShield')::numeric,budget));budget:=budget-amount;if amount<=0 then continue;end if;x:=x||jsonb_build_object('currentShield',amount);end if;effects:=effects||jsonb_build_array(x);
   end loop;
   if budget>0 then effects:=effects||jsonb_build_array(jsonb_build_object('effectId','legacy_shield','behavior','SHIELD','duration',1,'stacks',1,'currentShield',budget,'sourceActorId',actor));end if;
   if actor='player' then c.player_effects:=effects;c.player_shield:=private.combat_v2_shield(effects);else c.monster_effects:=effects;c.monster_shield:=private.combat_v2_shield(effects);end if;
  end loop;c:=private.combat_v2_phase(c);
 end if;return c;
end $$;

create or replace function private.combat_v2_player_start(c private.online_combat_states) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
begin
 c.player_turn:=c.player_turn+1;
 select coalesce(jsonb_object_agg('turn:'||key,greatest(0,(value#>>'{}')::bigint-c.player_turn)),'{}') into c.cooldowns from jsonb_each(coalesce(c.engine_runtime->'playerReady','{}'));
 c.phase:='PLAYER_TURN';return c;
end $$;
create or replace function private.combat_v2_round(c private.online_combat_states,nonce bigint) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
declare result jsonb;skip_end boolean:=coalesce((c.engine_runtime->>'skipPlayerEnd')::boolean,false);cycles int:=0;
begin
 if c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false) then return c;end if;
 if coalesce((c.engine_runtime->>'skipRound')::boolean,false) then c.engine_runtime:=c.engine_runtime-'skipRound';return c;end if;
 c.engine_runtime:=c.engine_runtime-'skipPlayerEnd';
 loop
  if not skip_end then
   c:=private.combat_v2_periodic(c,'player',nonce);
   if c.player_hp<=0 then c.pending_revival:=coalesce(c.revival_count,0)>0;c.engine_runtime:=c.engine_runtime||'{"resumeTurn":"MONSTER_TURN","revivalSource":"PERIODIC_DAMAGE"}';return c;end if;
   c.player_hp:=c.player_hp-greatest(0,c.player_hp-c.player_max_hp)*.25;c.player_effects:=private.combat_v2_tick(c.player_effects,c.player_turn);
  end if;
  result:=private.resolve_server_monster_turn_v2(c,nonce+cycles*10000);select * into c from jsonb_populate_record(null::private.online_combat_states,result->'state');c.engine_runtime:=c.engine_runtime||jsonb_build_object('monsterAction',result->'action');
  if c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false) then return c;end if;
  c:=private.combat_v2_periodic(c,'monster',nonce);c.monster_effects:=private.combat_v2_tick(c.monster_effects,c.monster_turn);
  if c.monster_hp<=0 then return c;end if;
  c:=private.combat_v2_player_start(c);exit when not private.combat_v2_has(c.player_effects,'STUN');
  cycles:=cycles+1;if cycles>1000 then raise exception 'COMBAT_CONTROL_DURATION_INVALID';end if;skip_end:=false;
 end loop;
 return c;
end $$;

create or replace function private.combat_v2_payload(c private.online_combat_states,r private.online_expeditions) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('encounterIndex',c.encounter_index,'monsterId',c.monster_id,'playerHp',c.player_hp,'playerMaxHp',c.player_max_hp,'monsterHp',c.monster_hp,'monsterMaxHp',c.monster_max_hp,'monsterAttack',c.monster_attack,'monsterDefense',c.monster_defense,'playerShield',c.player_shield,'monsterShield',c.monster_shield,'playerEffects',c.player_effects,'monsterEffects',c.monster_effects,'playerCooldowns',c.cooldowns,'monsterCooldowns',c.monster_cooldowns,'monsterPreparedAction',c.monster_prepared_action,'monsterReactiveAction',c.monster_reactive_action,'jobId',c.job_id,'jobResource',c.job_resource,'jobFlags',c.job_flags,'playerTurn',c.player_turn,'monsterTurn',c.monster_turn,'turnNo',c.turn_no,'phase',c.phase,'pendingRevival',c.pending_revival,'actionNonce',c.action_nonce,'stateVersion',c.state_version,'runVersion',r.run_version,'confirmedKills',r.confirmed_kills,'healingPotionUses',r.healing_potion_uses,'combatEvents',coalesce(c.engine_runtime->'events','[]'),'playerReadyTurns',coalesce(c.engine_runtime->'playerReady','{}'),'monsterReadyTurns',coalesce(c.engine_runtime->'monsterReady','{}'),'revivalResumeTurn',c.engine_runtime->>'resumeTurn','revivalSource',c.engine_runtime->>'revivalSource','engineVersion',2,'monsterAction',c.engine_runtime->'monsterAction','monsterPhaseId',c.engine_runtime->>'phaseId','returnAuthorized',c.return_authorized);
$$;

create or replace function private.combat_v2_require_action(c private.online_combat_states,r private.online_expeditions,nonce bigint,action text) returns private.online_combat_states language plpgsql immutable set search_path='' as $$
begin
 if c.user_id is null or r.user_id is null or r.status<>'ACTIVE' or r.pending_event is not null or c.run_id<>r.run_id or c.phase<>'PLAYER_TURN' or c.player_hp<=0 or c.monster_hp<=0 or coalesce(c.pending_revival,false) then raise exception 'COMBAT_PHASE_INVALID';end if;
 if nonce is null or nonce<>c.action_nonce+1 then raise exception 'COMBAT_ACTION_SEQUENCE_INVALID';end if;
 if private.combat_v2_has(c.player_effects,'STUN') then raise exception 'COMBAT_STUNNED';end if;
 if action='FLEE' and private.combat_v2_has(c.player_effects,'ROOT') then raise exception 'COMBAT_ROOTED';end if;
 if action='SKILL' and private.combat_v2_has(c.player_effects,'SILENCE') then raise exception 'COMBAT_SILENCED';end if;
 c:=private.combat_v2_initialize(c);c.engine_runtime:=c.engine_runtime||'{"events":[]}';return c;
end $$;
