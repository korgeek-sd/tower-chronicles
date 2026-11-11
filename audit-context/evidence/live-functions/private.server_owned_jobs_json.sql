CREATE OR REPLACE FUNCTION private.server_owned_jobs_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(job_id order by acquired_at,job_id),'[]'::jsonb)
  from private.player_job_entitlements where user_id=p_user
$function$

