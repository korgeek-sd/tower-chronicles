-- Three independent hunting skill sets; one condition per active slot.
alter table private.hunting_states add column if not exists skill_sets jsonb not null default '[]'::jsonb,add column if not exists active_skill_set integer not null default 0;
create or replace function private.hunting_skill_set_bank(skills text[],setup jsonb,sets jsonb,active integer)
returns jsonb language plpgsql immutable set search_path='' as $function$
declare bank jsonb;empty_set jsonb;index integer:=greatest(0,least(2,coalesce(active,0)));
begin
 empty_set:=jsonb_build_object('skills','[]'::jsonb,'setup',jsonb_build_object('slots','[null,null,null,null,null,null]'::jsonb,'conditions','{}'::jsonb));
 if jsonb_typeof(sets)='array' and jsonb_array_length(sets)=3 then bank:=sets;else bank:=jsonb_build_array(empty_set,empty_set,empty_set);end if;
 return jsonb_set(bank,array[index::text],jsonb_build_object('skills',to_jsonb(skills),'setup',setup),true);
end $function$;
revoke all on function private.hunting_skill_set_bank(text[],jsonb,jsonb,integer) from public,anon,authenticated;
create or replace function private.validate_hunting_skill_set(u uuid,p_set jsonb)
returns void language plpgsql set search_path='' as $function$
declare p_skills text[];p_setup jsonb;k text;conditions jsonb;c jsonb;kind text;v numeric;active_ids text[];slot_ids text[];chosen text;spec jsonb;actives integer:=0;passives integer:=0;
begin
 if jsonb_typeof(p_set) is distinct from 'object' or jsonb_typeof(p_set->'skills') is distinct from 'array' then raise exception 'HUNT_PRESET_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_set->'skills') x where jsonb_typeof(x)<>'string') then raise exception 'HUNT_PRESET_INVALID';end if;
 select coalesce(array_agg(value order by ord),array[]::text[]) into p_skills from jsonb_array_elements_text(p_set->'skills') with ordinality as chosen(value,ord);
 p_setup:=p_set->'setup';
 if cardinality(p_skills)>9 or cardinality(p_skills)<>(select count(distinct x) from unnest(p_skills)x) then raise exception 'HUNT_PRESET_INVALID';end if;
 foreach chosen in array p_skills loop
  if chosen in ('heavy','guard','quick') then actives:=actives+1;continue;end if;
  spec:=private.hunting_skill_spec(chosen);
  if spec is null or not exists(select 1 from private.learned_catalog_skills where user_id=u and skill_id=chosen) then raise exception 'HUNT_PRESET_INVALID';end if;
  if spec->>'type'='active' then actives:=actives+1;else passives:=passives+1;end if;
 end loop;
 if actives>6 or passives>3 then raise exception 'HUNT_PRESET_INVALID';end if;
 if p_setup is null or jsonb_typeof(p_setup)<>'object' or jsonb_typeof(p_setup->'slots') is distinct from 'array' or jsonb_typeof(p_setup->'conditions') is distinct from 'object' then raise exception 'HUNT_PRESET_INVALID';end if;
 if jsonb_array_length(p_setup->'slots')<>6 then raise exception 'HUNT_PRESET_INVALID';end if;
 if exists(select 1 from jsonb_array_elements(p_setup->'slots') x where jsonb_typeof(x) not in ('string','null')) then raise exception 'HUNT_PRESET_INVALID';end if;
 select coalesce(array_agg(x order by ord),array[]::text[]) into active_ids from unnest(p_skills) with ordinality as chosen(x,ord) where coalesce(private.hunting_skill_spec(x)->>'type','active')='active';
 select coalesce(array_agg(x order by ord),array[]::text[]) into slot_ids from jsonb_array_elements_text(p_setup->'slots') with ordinality as chosen(x,ord) where x is not null;
 if active_ids is distinct from slot_ids then raise exception 'HUNT_PRESET_INVALID';end if;
 for k,conditions in select key,value from jsonb_each(p_setup->'conditions') loop
  if not (k=any(active_ids)) or jsonb_typeof(conditions)<>'array' then raise exception 'HUNT_PRESET_INVALID';end if;
  if jsonb_array_length(conditions)>1 then raise exception 'HUNT_PRESET_INVALID';end if;
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
end $function$;
revoke all on function private.validate_hunting_skill_set(uuid,jsonb) from public,anon,authenticated;
create or replace function public.save_hunting_skill_sets(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_sets jsonb,p_active integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare u uuid;chosen jsonb;ids text[];i integer;
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform 1 from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 if p_active is null or p_active<0 or p_active>2 or jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'HUNT_PRESET_INVALID';end if;
 if jsonb_array_length(p_sets)<>3 then raise exception 'HUNT_PRESET_INVALID';end if;
 for i in 0..2 loop perform private.validate_hunting_skill_set(u,p_sets->i);end loop;
 chosen:=p_sets->p_active;
 select coalesce(array_agg(value order by ord),array[]::text[]) into ids from jsonb_array_elements_text(chosen->'skills') with ordinality as chosen(value,ord);
 -- The active set must also match the currently equipped weapon and gameplay session.
 perform public.save_hunting_setup(p_lease_id,p_generation,p_client_instance_id,p_device_id,ids,chosen->'setup');
 update private.hunting_states set skill_sets=p_sets,active_skill_set=p_active where user_id=u;
 return private.refresh_hunting_state(u)||jsonb_build_object('serverNow',extract(epoch from now())*1000);
end $function$;
revoke all on function public.save_hunting_skill_sets(uuid,bigint,text,text,jsonb,integer) from public,anon;
grant execute on function public.save_hunting_skill_sets(uuid,bigint,text,text,jsonb,integer) to authenticated;
-- Preserve the first condition of existing two-condition configurations.
update private.hunting_states h set skill_setup=jsonb_set(h.skill_setup,'{conditions}',coalesce((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' and jsonb_array_length(value)>1 then jsonb_build_array(value->0) else value end) from jsonb_each(coalesce(h.skill_setup->'conditions','{}'::jsonb))),'{}'::jsonb),true);
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('private.refresh_hunting_state(uuid)'::regprocedure);
 if strpos(definition,'''skillSets''')=0 then
  definition:=replace(definition,$old$'skillSetup',s.skill_setup$old$,$new$'skillSetup',s.skill_setup,'skillSets',private.hunting_skill_set_bank(s.skills,s.skill_setup,s.skill_sets,s.active_skill_set),'activeSkillSet',s.active_skill_set$new$);
  execute definition;
 end if;
 definition:=pg_get_functiondef('public.save_hunting_setup(uuid,bigint,text,text,text[],jsonb)'::regprocedure);
 definition:=replace(definition,'jsonb_array_length(conditions)>2','jsonb_array_length(conditions)>1');execute definition;
end $migration$;
