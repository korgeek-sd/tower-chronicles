CREATE OR REPLACE FUNCTION private.server_bank_state(u uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
 'userId',u,'serverNow',extract(epoch from clock_timestamp())*1000,'premium',private.premium_active(u),
 'silver',coalesce((select silver from private.player_wallets where user_id=u),0),
 'tickets',coalesce((select jsonb_object_agg(item_id,quantity) from private.market_assets where user_id=u and item_id in ('ticket:ore:1','ticket:leather:1','ticket:gem:1','ticket:kaleon:1')),'{}'::jsonb),
 'penaltyUntil',(select extract(epoch from penalty_until)*1000 from private.server_bank_profiles where user_id=u),
 'directory',coalesce((select jsonb_agg(to_jsonb(x)) from(
  select b.id,b.name,b.rate,b.durations,b.vault,(b.owner_id=u) as "isMine" from private.server_banks b order by b.created_at,b.id limit 100
 )x),'[]'::jsonb),
 'myBank',(select jsonb_build_object('id',b.id,'name',b.name,'vault',b.vault,'rate',b.rate,'durations',b.durations,
  'collateral',coalesce((select jsonb_object_agg(ticket_id,quantity) from private.server_bank_collateral where bank_id=b.id),'{}'::jsonb)) from private.server_banks b where b.owner_id=u),
 'loans',coalesce((select jsonb_agg(to_jsonb(x)) from(
  select l.id,b.name as "bankName",l.ticket_id as "ticketId",l.tickets,l.principal,l.interest,l.rate,l.duration,l.status,l.reminders,
   extract(epoch from l.maturity_at)*1000 as "maturityAt",extract(epoch from l.grace_at)*1000 as "graceAt"
  from private.server_bank_loans l join private.server_banks b on b.id=l.bank_id where l.borrower_id=u order by l.issued_at desc,l.id limit 100
 )x),'[]'::jsonb),
 'ledger',coalesce((select jsonb_agg(to_jsonb(x)) from(
  select id,kind,wallet_delta as "walletDelta",vault_delta as "vaultDelta",ticket_id as "ticketId",ticket_delta as "ticketDelta",extract(epoch from created_at)*1000 as "createdAt"
  from private.server_bank_ledger where user_id=u order by id desc limit 50
 )x),'[]'::jsonb));
$function$

