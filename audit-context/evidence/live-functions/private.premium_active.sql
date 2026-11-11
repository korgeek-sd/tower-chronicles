CREATE OR REPLACE FUNCTION private.premium_active(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select exists(select 1 from private.premium_accounts where user_id=u and expires_at>now())$function$

