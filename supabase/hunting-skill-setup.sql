-- Conditional six-slot cyclic hunting. Preserve receipts, economy and session authority.
alter table private.hunting_states add column if not exists skill_setup jsonb not null default '{}'::jsonb;
create or replace function private.hunting_conditions_match(conditions jsonb,context jsonb)
returns boolean language plpgsql immutable set search_path='' as $function$
declare c jsonb;k text;v numeric;actual numeric;present boolean;
begin
 if conditions is null then return true;end if;
 if jsonb_typeof(conditions)<>'array' or jsonb_array_length(conditions)>2 then return false;end if;
 for c in select value from jsonb_array_elements(conditions) loop
  k:=c->>'kind';
  if k ~ '_(gte|lte|every)
  if k='always' then continue;
  elsif k='turn_every' then if v<1 or (context->>'turn')::integer%v<>0 then return false;end if;
  elsif k ~ '_(gte|lte)$' then
   actual:=(context->>regexp_replace(k,'_(gte|lte)$',''))::numeric;
   if actual is null or (k like '%_gte' and actual<v) or (k like '%_lte' and actual>v) then return false;end if;
  elsif k ~ '_(present|absent)$' then
   present:=(context->>regexp_replace(k,'_(present|absent)$',''))::boolean;
   if present is null or (k like '%_present' and not present) or (k like '%_absent' and present) then return false;end if;
  else return false;end if;
 end loop;
 return true;
end $function$;
revoke all on function private.hunting_conditions_match(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.save_hunting_setup(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skills text[],p_setup jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare u uuid;k text;conditions jsonb;c jsonb;kind text;v numeric;active_ids text[];slot_ids text[];
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform 1 from public.game_saves where user_id=u for update;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if p_setup is null or jsonb_typeof(p_setup)<>'object' or jsonb_typeof(p_setup->'slots') is distinct from 'array' or jsonb_typeof(p_setup->'conditions') is distinct from 'object' then raise exception 'HUNT_PRESET_INVALID';end if;
 if jsonb_array_length(p_setup->'slots')<>6 then raise exception 'HUNT_PRESET_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_setup->'slots') x where jsonb_typeof(x) not in ('string','null')) then raise exception 'HUNT_PRESET_INVALID';end if;
 select coalesce(array_agg(x order by ord),array[]::text[]) into active_ids from unnest(p_skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 select coalesce(array_agg(x order by ord),array[]::text[]) into slot_ids from jsonb_array_elements_text(p_setup->'slots') with ordinality as chosen(x,ord) where x is not null;
 if active_ids is distinct from slot_ids then raise exception 'HUNT_PRESET_INVALID';end if;
 for k,conditions in select key,value from jsonb_each(p_setup->'conditions') loop
  if not (k=any(active_ids)) or jsonb_typeof(conditions)<>'array' then raise exception 'HUNT_PRESET_INVALID';end if;
  if jsonb_array_length(conditions)>2 then raise exception 'HUNT_PRESET_INVALID';end if;
  for c in select value from jsonb_array_elements(conditions) loop
   kind:=c->>'kind';
   if kind is null or kind not in ('always','hp_pct_gte','hp_pct_lte','hp_gte','hp_lte','mp_pct_gte','mp_pct_lte','mp_gte','mp_lte','turn_gte','turn_lte','turn_every','enemy_hp_pct_gte','enemy_hp_pct_lte','shield_present','shield_absent','buff_present','buff_absent','bleed_present','bleed_absent','poison_present','poison_absent','burn_present','burn_absent','enemy_dot_present','enemy_dot_absent','enemy_defense_present','enemy_defense_absent') then raise exception 'HUNT_PRESET_INVALID';end if;
   if kind ~ '_(gte|lte|every)$' then
    if jsonb_typeof(c->'value') is distinct from 'number' then raise exception 'HUNT_PRESET_INVALID';end if;
    v:=(c->>'value')::numeric;
    if v<>trunc(v) or v<(case when kind like 'turn_%' then 1 else 0 end) or v>(case when kind like '%_pct_%' then 100 else 999999 end) then raise exception 'HUNT_PRESET_INVALID';end if;
   end if;
  end loop;
 end loop;
 perform public.save_hunting_preset(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_skills);
 update private.hunting_states set skill_setup=p_setup where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $function$;
revoke all on function public.save_hunting_setup(uuid,bigint,text,text,text[],jsonb) from public,anon;
grant execute on function public.save_hunting_setup(uuid,bigint,text,text,text[],jsonb) to authenticated;

-- Patch existing bodies to retain deployment-specific economy and receipt logic.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.refresh_hunting_state(uuid)'::regprocedure);
 definition:=replace(definition,$old$'skills',to_jsonb(s.skills)$old$,$new$'skills',to_jsonb(s.skills),'skillSetup',s.skill_setup$new$);
 execute definition;
 definition:=pg_get_functiondef('public.save_hunting_preset(uuid,bigint,text,text,text[])'::regprocedure);
 definition:=replace(definition,$old$set skills=p_skills where$old$,$new$set skills=p_skills,skill_setup='{}'::jsonb where$new$);
 execute definition;
 definition:=pg_get_functiondef('public.hunt_once(uuid,bigint,text,text,uuid,text)'::regprocedure);
 if strpos(definition,'slot_cursor integer')=0 then
  if strpos(definition,$old$begin
 u:=$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$begin
 u:=$old$,$new$ slot_cursor integer:=1;slot_index integer;slot_offset integer;active_slots text[];
begin
 u:=$new$);
  if strpos(definition,$old$ player:=private.combat_equipment_stats(u,p);$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ player:=private.combat_equipment_stats(u,p);$old$,$new$ player:=private.combat_equipment_stats(u,p);
 weapon:=coalesce(player->>'weapon','sword');$new$);
  if strpos(definition,$old$ weapon:=coalesce(player->>'weapon','sword');
 mp_max:=$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ weapon:=coalesce(player->>'weapon','sword');
 mp_max:=$old$,$new$ mp_max:=$new$);
  if strpos(definition,$old$ mhp:=mh;$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ mhp:=mh;$old$,$new$ select coalesce(array_agg(x order by ord),array[]::text[]) into active_slots from unnest(h.skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 mhp:=mh;$new$);
  if strpos(definition,$old$  lines:='[]';skill:=null;guard:=false;$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$  lines:='[]';skill:=null;guard:=false;$old$,$new$  lines:='[]';skill:=null;guard:=false;
  if shield_until<turn_no then shield_pts:=0;end if;
  if prep_until<turn_no then prep_bonus:=0;end if;$new$);
  if strpos(definition,$old$  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   if (spec->>'family'='restore' and mp_now=mp_max)
    or (spec->>'family'='heal' and hp>=(player->>'hp')::numeric*.95)
    or (spec->>'family'='shield' and shield_pts>(player->>'hp')::numeric*.1)
    or (spec->>'family'='prepare' and prep_bonus>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   if (spec->>'family'='restore' and mp_now=mp_max)
    or (spec->>'family'='heal' and hp>=(player->>'hp')::numeric*.95)
    or (spec->>'family'='shield' and shield_pts>(player->>'hp')::numeric*.1)
    or (spec->>'family'='prepare' and prep_bonus>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
$old$,$new$  for slot_offset in 0..greatest(0,coalesce(cardinality(active_slots),0)-1) loop
   exit when coalesce(cardinality(active_slots),0)=0;
   slot_index:=1+(slot_cursor-1+slot_offset)%cardinality(active_slots);
   candidate:=active_slots[slot_index];
   if not private.hunting_conditions_match(h.skill_setup->'conditions'->candidate,jsonb_build_object(
    'hp',hp,'hp_pct',hp/(player->>'hp')::numeric*100,'mp',mp_now,'mp_pct',mp_now/mp_max*100,
    'enemy_hp_pct',mhp/mh*100,'turn',turn_no,'shield',shield_pts>0,'buff',prep_bonus>0,
    'bleed',coalesce((effects->>'bleedUntil')::integer,0)>=turn_no,
    'poison',coalesce((effects->>'poisonUntil')::integer,0)>=turn_no,
    'burn',coalesce((effects->>'burnUntil')::integer,0)>=turn_no,
    'enemy_dot',monster_dot>0 and monster_dot_until>=turn_no,
    'enemy_defense',monster_def_down>0 and monster_def_until>=turn_no)) then continue;end if;
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then slot_cursor:=1+slot_index%cardinality(active_slots);end if;
$new$);
  execute definition;
 end if;
end $migration$;
 then v:=coalesce((c->>'value')::numeric,0);end if;
  if k='always' then continue;
  elsif k='turn_every' then if v<1 or (context->>'turn')::integer%v<>0 then return false;end if;
  elsif k ~ '_(gte|lte)$' then
   actual:=(context->>regexp_replace(k,'_(gte|lte)$',''))::numeric;
   if actual is null or (k like '%_gte' and actual<v) or (k like '%_lte' and actual>v) then return false;end if;
  elsif k ~ '_(present|absent)$' then
   present:=(context->>regexp_replace(k,'_(present|absent)$',''))::boolean;
   if present is null or (k like '%_present' and not present) or (k like '%_absent' and present) then return false;end if;
  else return false;end if;
 end loop;
 return true;
end $function$;
revoke all on function private.hunting_conditions_match(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.save_hunting_setup(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_skills text[],p_setup jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare u uuid;k text;conditions jsonb;c jsonb;kind text;v numeric;active_ids text[];slot_ids text[];
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform 1 from public.game_saves where user_id=u for update;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if p_setup is null or jsonb_typeof(p_setup)<>'object' or jsonb_typeof(p_setup->'slots') is distinct from 'array' or jsonb_typeof(p_setup->'conditions') is distinct from 'object' then raise exception 'HUNT_PRESET_INVALID';end if;
 if jsonb_array_length(p_setup->'slots')<>6 then raise exception 'HUNT_PRESET_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_setup->'slots') x where jsonb_typeof(x) not in ('string','null')) then raise exception 'HUNT_PRESET_INVALID';end if;
 select coalesce(array_agg(x order by ord),array[]::text[]) into active_ids from unnest(p_skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 select coalesce(array_agg(x order by ord),array[]::text[]) into slot_ids from jsonb_array_elements_text(p_setup->'slots') with ordinality as chosen(x,ord) where x is not null;
 if active_ids is distinct from slot_ids then raise exception 'HUNT_PRESET_INVALID';end if;
 for k,conditions in select key,value from jsonb_each(p_setup->'conditions') loop
  if not (k=any(active_ids)) or jsonb_typeof(conditions)<>'array' then raise exception 'HUNT_PRESET_INVALID';end if;
  if jsonb_array_length(conditions)>2 then raise exception 'HUNT_PRESET_INVALID';end if;
  for c in select value from jsonb_array_elements(conditions) loop
   kind:=c->>'kind';
   if kind is null or kind not in ('always','hp_pct_gte','hp_pct_lte','hp_gte','hp_lte','mp_pct_gte','mp_pct_lte','mp_gte','mp_lte','turn_gte','turn_lte','turn_every','enemy_hp_pct_gte','enemy_hp_pct_lte','shield_present','shield_absent','buff_present','buff_absent','bleed_present','bleed_absent','poison_present','poison_absent','burn_present','burn_absent','enemy_dot_present','enemy_dot_absent','enemy_defense_present','enemy_defense_absent') then raise exception 'HUNT_PRESET_INVALID';end if;
   if kind ~ '_(gte|lte|every)$' then
    if jsonb_typeof(c->'value') is distinct from 'number' then raise exception 'HUNT_PRESET_INVALID';end if;
    v:=(c->>'value')::numeric;
    if v<>trunc(v) or v<(case when kind like 'turn_%' then 1 else 0 end) or v>(case when kind like '%_pct_%' then 100 else 999999 end) then raise exception 'HUNT_PRESET_INVALID';end if;
   end if;
  end loop;
 end loop;
 perform public.save_hunting_preset(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_skills);
 update private.hunting_states set skill_setup=p_setup where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $function$;
revoke all on function public.save_hunting_setup(uuid,bigint,text,text,text[],jsonb) from public,anon;
grant execute on function public.save_hunting_setup(uuid,bigint,text,text,text[],jsonb) to authenticated;

-- Patch existing bodies to retain deployment-specific economy and receipt logic.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.refresh_hunting_state(uuid)'::regprocedure);
 definition:=replace(definition,$old$'skills',to_jsonb(s.skills)$old$,$new$'skills',to_jsonb(s.skills),'skillSetup',s.skill_setup$new$);
 execute definition;
 definition:=pg_get_functiondef('public.save_hunting_preset(uuid,bigint,text,text,text[])'::regprocedure);
 definition:=replace(definition,$old$set skills=p_skills where$old$,$new$set skills=p_skills,skill_setup='{}'::jsonb where$new$);
 execute definition;
 definition:=pg_get_functiondef('public.hunt_once(uuid,bigint,text,text,uuid,text)'::regprocedure);
 if strpos(definition,'slot_cursor integer')=0 then
  if strpos(definition,$old$begin
 u:=$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$begin
 u:=$old$,$new$ slot_cursor integer:=1;slot_index integer;slot_offset integer;active_slots text[];
begin
 u:=$new$);
  if strpos(definition,$old$ player:=private.combat_equipment_stats(u,p);$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ player:=private.combat_equipment_stats(u,p);$old$,$new$ player:=private.combat_equipment_stats(u,p);
 weapon:=coalesce(player->>'weapon','sword');$new$);
  if strpos(definition,$old$ weapon:=coalesce(player->>'weapon','sword');
 mp_max:=$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ weapon:=coalesce(player->>'weapon','sword');
 mp_max:=$old$,$new$ mp_max:=$new$);
  if strpos(definition,$old$ mhp:=mh;$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$ mhp:=mh;$old$,$new$ select coalesce(array_agg(x order by ord),array[]::text[]) into active_slots from unnest(h.skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 mhp:=mh;$new$);
  if strpos(definition,$old$  lines:='[]';skill:=null;guard:=false;$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$  lines:='[]';skill:=null;guard:=false;$old$,$new$  lines:='[]';skill:=null;guard:=false;
  if shield_until<turn_no then shield_pts:=0;end if;
  if prep_until<turn_no then prep_bonus:=0;end if;$new$);
  if strpos(definition,$old$  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   if (spec->>'family'='restore' and mp_now=mp_max)
    or (spec->>'family'='heal' and hp>=(player->>'hp')::numeric*.95)
    or (spec->>'family'='shield' and shield_pts>(player->>'hp')::numeric*.1)
    or (spec->>'family'='prepare' and prep_bonus>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
$old$)=0 then raise exception 'HUNTING_SETUP_BASELINE_MISMATCH';end if;
  definition:=replace(definition,$old$  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   if (spec->>'family'='restore' and mp_now=mp_max)
    or (spec->>'family'='heal' and hp>=(player->>'hp')::numeric*.95)
    or (spec->>'family'='shield' and shield_pts>(player->>'hp')::numeric*.1)
    or (spec->>'family'='prepare' and prep_bonus>0) then continue;end if;
   skill:=candidate;exit;
  end loop;
$old$,$new$  for slot_offset in 0..greatest(0,coalesce(cardinality(active_slots),0)-1) loop
   exit when coalesce(cardinality(active_slots),0)=0;
   slot_index:=1+(slot_cursor-1+slot_offset)%cardinality(active_slots);
   candidate:=active_slots[slot_index];
   if not private.hunting_conditions_match(h.skill_setup->'conditions'->candidate,jsonb_build_object(
    'hp',hp,'hp_pct',hp/(player->>'hp')::numeric*100,'mp',mp_now,'mp_pct',mp_now/mp_max*100,
    'enemy_hp_pct',mhp/mh*100,'turn',turn_no,'shield',shield_pts>0,'buff',prep_bonus>0,
    'bleed',coalesce((effects->>'bleedUntil')::integer,0)>=turn_no,
    'poison',coalesce((effects->>'poisonUntil')::integer,0)>=turn_no,
    'burn',coalesce((effects->>'burnUntil')::integer,0)>=turn_no,
    'enemy_dot',monster_dot>0 and monster_dot_until>=turn_no,
    'enemy_defense',monster_def_down>0 and monster_def_until>=turn_no)) then continue;end if;
   if coalesce((effects->>'silenceUntil')::integer,0)>=turn_no
    or coalesce((effects->>'delayUntil')::integer,0)>=turn_no
    or coalesce((cd->>candidate)::integer,0)>turn_no then continue;end if;
   if candidate in ('heavy','guard','quick') then
    if candidate<>'guard' or hp/(player->>'hp')::numeric<=.5 then skill:=candidate;exit;end if;
    continue;
   end if;
   spec:=private.hunting_skill_spec(candidate);
   if spec is null or spec->>'type'<>'active' or spec->>'weapon' not in ('any',weapon)
    or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=candidate)
    or (spec->>'mp')::numeric>mp_now then continue;end if;
   skill:=candidate;exit;
  end loop;
  if skill is not null then slot_cursor:=1+slot_index%cardinality(active_slots);end if;
$new$);
  execute definition;
 end if;
end $migration$;
