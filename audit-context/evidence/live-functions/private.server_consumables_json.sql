CREATE OR REPLACE FUNCTION private.server_consumables_json(p_user uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'healing_lesser', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_lesser'),0),
    'healing_standard', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_standard'),0),
    'healing_greater', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_greater'),0),
    'healing_supreme', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='healing_supreme'),0),
    'revival', coalesce((select quantity from private.player_consumables where user_id=p_user and item_id='revival'),0)
  )
$function$

