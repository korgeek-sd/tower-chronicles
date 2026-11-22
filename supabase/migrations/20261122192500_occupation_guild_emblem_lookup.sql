create or replace function public.get_occupation_guild_emblems(
 p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_association_ids uuid[]
) returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_user uuid; v_result jsonb;
begin
 v_user:=private.require_active_game_session(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if cardinality(coalesce(p_association_ids,array[]::uuid[]))>25 then raise exception 'ASSOCIATION_INPUT_INVALID';end if;
 select coalesce(jsonb_object_agg(a.association_id::text,a.emblem),'{}'::jsonb)
 into v_result from private.online_associations a
 where a.association_id=any(coalesce(p_association_ids,array[]::uuid[])) and a.status='ACTIVE';
 return v_result;
end $$;
revoke all on function public.get_occupation_guild_emblems(uuid,bigint,text,text,uuid[]) from public,anon;
grant execute on function public.get_occupation_guild_emblems(uuid,bigint,text,text,uuid[]) to authenticated;