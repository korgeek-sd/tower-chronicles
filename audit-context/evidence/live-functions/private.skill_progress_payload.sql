CREATE OR REPLACE FUNCTION private.skill_progress_payload(u uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select jsonb_set(p,'{skillEnhancements}',coalesce((select jsonb_object_agg(skill_id,enhancement_level) from private.learned_catalog_skills where user_id=u),'{}'::jsonb),true);
$function$

