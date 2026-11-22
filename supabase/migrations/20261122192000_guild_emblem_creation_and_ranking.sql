
-- Guild emblem persistence, creation validation, and read APIs. Existing RPCs remain unchanged.
alter table private.online_associations add column if not exists emblem jsonb not null
 default '{"shape":"shield","symbol":"sword","pattern":"solid","border":"gold","base":"#942f3c","accent":"#c19548","scale":100,"offsetX":0,"offsetY":0}'::jsonb;

create or replace function private.guild_emblem_valid(p jsonb) returns boolean
language sql immutable set search_path to '' as $$
 select case
  when p is null or jsonb_typeof(p)<>'object' or length(p::text)>650 then false
  when coalesce(p->>'shape','') not in ('shield','round','point','diamond','banner','wide','tower','crest') then false
  when coalesce(p->>'symbol','') not in ('sword','shield','crown','skull','sun','moon','star','px-flag','px-heart','px-key','px-anchor','px-tree','px-eye','px-target','px-cross','px-castle','knight','helmet','castle','cat','fawn','swan','rabbit','book','bishop','candelabra','rook','sugar-maple','willow-tree','lauburu') then false
  when coalesce(p->>'pattern','') not in ('solid','split','horizontal','diagonal','cross','chevron','quarters','stripe','triangle','band','double','lattice') then false
  when coalesce(p->>'border','') not in ('gold','iron','silver','ancient','royal','plain') then false
  when coalesce(p->>'base','') not in ('#942f3c','#2f4f80','#386148','#624075','#c19548','#22272e','#b5b8b1','#996139','#1d6372','#9b5b69','#4d5435','#d7b878') then false
  when coalesce(p->>'accent','') not in ('#942f3c','#2f4f80','#386148','#624075','#c19548','#22272e','#b5b8b1','#996139','#1d6372','#9b5b69','#4d5435','#d7b878') then false
  when coalesce(p->>'scale','') !~ '^([0-9]{2,3})$' then false
  when coalesce(p->>'offsetX','') !~ '^(-?[0-9]{1,2})$' then false
  when coalesce(p->>'offsetY','') !~ '^(-?[0-9]{1,2})$' then false
  else (p->>'scale')::int between 60 and 140
   and (p->>'offsetX')::int between -22 and 22
   and (p->>'offsetY')::int between -22 and 22
 end
$$;
alter table private.online_associations drop constraint if exists online_associations_emblem_valid;
alter table private.online_associations add constraint online_associations_emblem_valid
 check (private.guild_emblem_valid(emblem));

create or replace function private.guild_emblem_decorate_state(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v jsonb:=p; v_directory jsonb; v_current uuid;
begin
 if jsonb_typeof(v->'current')='object' then
  v_current:=(v #>> '{current,associationId}')::uuid;
  v:=jsonb_set(v,'{current,emblem}',coalesce(
     (select a.emblem from private.online_associations a where a.association_id=v_current),
     '{"shape":"shield","symbol":"sword","pattern":"solid","border":"gold","base":"#942f3c","accent":"#c19548","scale":100,"offsetX":0,"offsetY":0}'::jsonb),true);
 end if;
 select coalesce(jsonb_agg(
  e.value||jsonb_build_object('emblem',coalesce(a.emblem,'{"shape":"shield","symbol":"sword","pattern":"solid","border":"gold","base":"#942f3c","accent":"#c19548","scale":100,"offsetX":0,"offsetY":0}'::jsonb))
  order by e.ordinality),'[]'::jsonb)
 into v_directory
 from jsonb_array_elements(coalesce(v->'directory','[]'::jsonb)) with ordinality e(value,ordinality)
 left join private.online_associations a on a.association_id=(e.value->>'associationId')::uuid;
 return jsonb_set(v,'{directory}',v_directory,true);
end $$;

create or replace function public.get_online_association_state_v2(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text) returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
 return private.guild_emblem_decorate_state(
  public.get_online_association_state(p_lease_id,p_generation,p_client_instance_id,p_device_id)
 );
end $$;

create or replace function public.create_online_association_v3(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
 p_name text,p_description text,p_join_policy text,p_emblem jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v jsonb; v_association_id uuid; v_user uuid;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if not private.guild_emblem_valid(p_emblem) then raise exception 'ASSOCIATION_EMBLEM_INVALID';end if;
 v:=public.create_online_association_v2(p_lease_id,p_generation,p_client_instance_id,p_device_id,
   p_name,p_description,p_join_policy);
 v_association_id:=(v #>> '{state,current,associationId}')::uuid;
 if v_association_id is null then raise exception 'ASSOCIATION_NOT_FOUND';end if;
 update private.online_associations set emblem=p_emblem,updated_at=now()
 where association_id=v_association_id and leader_user_id=v_user and status='ACTIVE';
 if not found then raise exception 'ASSOCIATION_LEADER_REQUIRED';end if;
 return jsonb_set(v,'{state}',private.guild_emblem_decorate_state(v->'state'),true);
end $$;

create or replace function public.get_guild_rankings_v2(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_mode text default 'OVERALL') returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v jsonb; v_entries jsonb;
begin
 v:=public.get_guild_rankings(p_lease_id,p_generation,p_client_instance_id,p_device_id,p_mode);
 select coalesce(jsonb_agg(
   e.value||jsonb_build_object('emblem',coalesce(a.emblem,'{"shape":"shield","symbol":"sword","pattern":"solid","border":"gold","base":"#942f3c","accent":"#c19548","scale":100,"offsetX":0,"offsetY":0}'::jsonb))
   order by e.ordinality),'[]'::jsonb)
 into v_entries
 from jsonb_array_elements(coalesce(v->'entries','[]'::jsonb)) with ordinality e(value,ordinality)
 left join private.online_associations a on a.association_id=(e.value->>'associationId')::uuid;
 return jsonb_set(v,'{entries}',v_entries,true);
end $$;

revoke all on function private.guild_emblem_valid(jsonb) from public,anon,authenticated;
revoke all on function private.guild_emblem_decorate_state(jsonb) from public,anon,authenticated;
revoke all on function public.get_online_association_state_v2(uuid,bigint,text,text) from public,anon;
revoke all on function public.create_online_association_v3(uuid,bigint,text,text,text,text,text,jsonb) from public,anon;
revoke all on function public.get_guild_rankings_v2(uuid,bigint,text,text,text) from public,anon;
grant execute on function public.get_online_association_state_v2(uuid,bigint,text,text) to authenticated;
grant execute on function public.create_online_association_v3(uuid,bigint,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.get_guild_rankings_v2(uuid,bigint,text,text,text) to authenticated;
