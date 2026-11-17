CREATE OR REPLACE FUNCTION private.quest_ticket_payload(u uuid, p jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select jsonb_set(p,'{cosmetics}',coalesce(p->'cosmetics','{}')||jsonb_build_object('summonTickets',coalesce((select quantity from private.appearance_ticket_wallets where user_id=u),0)),true)
$function$

