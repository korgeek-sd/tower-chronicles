CREATE OR REPLACE FUNCTION private.sync_market_economy_after_save()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.sync_market_economy_from_latest_save(new.user_id);
  return new;
end;
$function$

