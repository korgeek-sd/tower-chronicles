CREATE OR REPLACE FUNCTION private.assert_operations_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.is_coupon_admin() then raise exception 'OPERATIONS_FORBIDDEN' using errcode='42501'; end if;
end $function$

