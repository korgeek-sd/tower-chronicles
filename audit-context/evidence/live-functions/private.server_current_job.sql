CREATE OR REPLACE FUNCTION private.server_current_job(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.current_job_id
  from private.player_job_selection s
  where s.user_id=p_user
    and (s.current_job_id is null or exists(
      select 1 from private.player_job_entitlements e
      where e.user_id=p_user and e.job_id=s.current_job_id
    ))
$function$

