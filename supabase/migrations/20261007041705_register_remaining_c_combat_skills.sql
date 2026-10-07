-- Register the remaining five C kits and shared scaling effects, preserving existing catalog entries.
do $migration$
declare catalog jsonb;
begin
 catalog := private.combat_v2_catalog();
 catalog := jsonb_set(catalog, '{jobs}', (catalog->'jobs') || $c${"excavator":{"jobId":"excavator","resource":{"id":"combat","initialValue":0,"maxValue":4},"passives":[],"skills":[{"id":"excavator_skill_1","name":"곡괭이 타격","description":"125% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.25}]},{"id":"excavator_skill_2","name":"작업 자세","description":"2턴간 공격력 +20%·방어력 +25%","cooldown":4,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_attack_20","duration":2},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_defense_25","duration":2}]},{"id":"excavator_skill_3","name":"암반 분쇄","description":"280% 피해, 기절 1턴","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":3}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.8},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"stun","duration":1}]}]},"reclaimer":{"jobId":"reclaimer","resource":{"id":"combat","initialValue":0,"maxValue":4},"passives":[],"skills":[{"id":"reclaimer_skill_1","name":"회수용 칼질","description":"115% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.15}]},{"id":"reclaimer_skill_2","name":"악착같은 회수","description":"100% 피해, 공격력의 50% 회복","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1},{"kind":"HEAL_ATTACK","multiplier":0.5}]},{"id":"reclaimer_skill_3","name":"싹쓸이","description":"250% 피해, 공격력의 80% 회복","cooldown":3,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":2}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.5},{"kind":"HEAL_ATTACK","multiplier":0.8}]}]},"green_crown_pilgrim":{"jobId":"green_crown_pilgrim","resource":{"id":"combat","initialValue":0,"maxValue":4},"passives":[],"skills":[{"id":"green_crown_pilgrim_skill_1","name":"순례자의 지팡이","description":"110% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.1}]},{"id":"green_crown_pilgrim_skill_2","name":"고행의 기도","description":"3턴간 공격력 +15%·방어력 +25%","cooldown":4,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_attack_15","duration":3},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_defense_25","duration":3}]},{"id":"green_crown_pilgrim_skill_3","name":"녹관의 은총","description":"공격력의 190% 회복, 2턴간 방어력 +30%","cooldown":3,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":2}},"effectActions":[{"kind":"HEAL_ATTACK","multiplier":1.9},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_defense_30","duration":2}]}]},"porter":{"jobId":"porter","resource":{"id":"combat","initialValue":0,"maxValue":4},"passives":[],"skills":[{"id":"porter_skill_1","name":"짐짝 후려치기","description":"105% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.05}]},{"id":"porter_skill_2","name":"짐으로 막기","description":"최대 HP의 18% 보호막","cooldown":3,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_porter_shield_18","duration":3}]},{"id":"porter_skill_3","name":"악착같이 버티기","description":"최대 HP의 30% 보호막, 2턴간 방어력 +30%","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":2}},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_porter_shield_30","duration":3},{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_defense_30","duration":2}]}]},"guide":{"jobId":"guide","resource":{"id":"combat","initialValue":0,"maxValue":4},"passives":[],"skills":[{"id":"guide_skill_1","name":"길목 베기","description":"110% 피해","cooldown":0,"resource":{"kind":"GENERATOR","gain":1},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":1.1}]},{"id":"guide_skill_2","name":"길잡이의 판단","description":"2턴간 공격력 +25%","cooldown":4,"resource":{"kind":"NEUTRAL"},"effectActions":[{"kind":"APPLY_EFFECT","target":"SELF","effectId":"c_attack_25","duration":2}]},{"id":"guide_skill_3","name":"퇴로 차단","description":"220% 피해, 침묵 1턴","cooldown":4,"resource":{"kind":"SPENDER","cost":{"mode":"FIXED","amount":2}},"effectActions":[{"kind":"DIRECT_ATTACK","hits":1,"baseMultiplier":2.2},{"kind":"APPLY_EFFECT","target":"TARGET","effectId":"silence","duration":1}]}]}}$c$::jsonb);
 catalog := jsonb_set(catalog, '{effects}', (catalog->'effects') || $c${"c_attack_15":{"id":"c_attack_15","name":"공격력 강화 15%","description":"공격력 강화 15%","category":"BUFF","behavior":"STAT_MODIFIER","tags":["STAT_UP"],"defaultDuration":2,"stackingPolicy":"EXTEND_DURATION","payload":{"stat":"attack","multiplier":0.15}},"c_attack_20":{"id":"c_attack_20","name":"공격력 강화 20%","description":"공격력 강화 20%","category":"BUFF","behavior":"STAT_MODIFIER","tags":["STAT_UP"],"defaultDuration":2,"stackingPolicy":"EXTEND_DURATION","payload":{"stat":"attack","multiplier":0.2}},"c_attack_25":{"id":"c_attack_25","name":"공격력 강화 25%","description":"공격력 강화 25%","category":"BUFF","behavior":"STAT_MODIFIER","tags":["STAT_UP"],"defaultDuration":2,"stackingPolicy":"EXTEND_DURATION","payload":{"stat":"attack","multiplier":0.25}},"c_defense_25":{"id":"c_defense_25","name":"방어력 강화 25%","description":"방어력 강화 25%","category":"BUFF","behavior":"STAT_MODIFIER","tags":["STAT_UP"],"defaultDuration":2,"stackingPolicy":"EXTEND_DURATION","payload":{"stat":"defense","multiplier":0.25}},"c_defense_30":{"id":"c_defense_30","name":"방어력 강화 30%","description":"방어력 강화 30%","category":"BUFF","behavior":"STAT_MODIFIER","tags":["STAT_UP"],"defaultDuration":2,"stackingPolicy":"EXTEND_DURATION","payload":{"stat":"defense","multiplier":0.3}},"c_porter_shield_18":{"id":"c_porter_shield_18","name":"짐꾼 보호막 18%","description":"최대 HP의 18% 보호막","category":"BUFF","behavior":"SHIELD","tags":["SHIELD"],"defaultDuration":3,"stackingPolicy":"REPLACE","shieldPercent":0.18,"scope":"BATTLE"},"c_porter_shield_30":{"id":"c_porter_shield_30","name":"짐꾼 보호막 30%","description":"최대 HP의 30% 보호막","category":"BUFF","behavior":"SHIELD","tags":["SHIELD"],"defaultDuration":3,"stackingPolicy":"REPLACE","shieldPercent":0.3,"scope":"BATTLE"}}$c$::jsonb);
 execute format('create or replace function private.combat_v2_catalog() returns jsonb language sql immutable set search_path='''' as %L', 'select ' || quote_literal(catalog::text) || '::jsonb;');
end $migration$;
revoke all on function private.combat_v2_catalog() from public,anon,authenticated;

create or replace function private.combat_v2_apply_effect(effects jsonb,id text,turn_no bigint,max_hp numeric,source text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare d jsonb:=private.combat_v2_definition(id);old jsonb;created jsonb;duration int;amount numeric;seq bigint;
begin
 if d is null then return coalesce(effects,'[]');end if;
 select x into old from jsonb_array_elements(coalesce(effects,'[]'))x where x->>'effectId'=id limit 1;
 duration:=coalesce((d->>'defaultDuration')::int,1);
 if d->>'behavior'='SHIELD' then
  amount:=least(coalesce((d->>'shieldAmount')::numeric,round(max_hp*(d->>'shieldPercent')::numeric),0),greatest(0,3*max_hp-private.combat_v2_shield(effects)));
  if amount<=0 then return coalesce(effects,'[]');end if;
  if old is not null then created:=old||jsonb_build_object('currentShield',coalesce((old->>'currentShield')::numeric,0)+amount);
  else created:=jsonb_build_object('effectId',id,'duration',duration,'stacks',1,'createdTurn',turn_no,'behavior','SHIELD','currentShield',amount,'sourceActorId',source);end if;
 elsif old is not null then
  created:=old||jsonb_build_object('duration',coalesce((old->>'duration')::int,0)+duration,'stacks',1,'applications',coalesce((old->>'applications')::int,(old->>'stacks')::int,1)+1);
 else
  created:=jsonb_build_object('effectId',id,'duration',duration,'stacks',1,'applications',1,'createdTurn',turn_no,'behavior',d->>'behavior','sourceActorId',source)||coalesce(d->'payload','{}');
 end if;
 if old is not null then return (select jsonb_agg(case when x->>'effectId'=id then created else x end order by ord) from jsonb_array_elements(coalesce(effects,'[]')) with ordinality t(x,ord));end if;
 select coalesce(max(coalesce((x->>'applicationSequence')::bigint,0)),0)+1 into seq from jsonb_array_elements(coalesce(effects,'[]'))x;
 return coalesce(effects,'[]')||jsonb_build_array(created||jsonb_build_object('applicationSequence',seq));
end $$;

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

