CREATE OR REPLACE FUNCTION public.is_coupon_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from auth.users where id=auth.uid() and raw_app_meta_data->>'coupon_admin'='true');
$function$

