CREATE OR REPLACE FUNCTION private.settle_server_bank_loan(p_loan uuid, p_now timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare l private.server_bank_loans%rowtype; paid boolean:=false; n integer;
begin
 select * into l from private.server_bank_loans where id=p_loan for update;
 if not found or l.status in ('REPAID','DEFAULTED') or l.maturity_at>p_now then return;end if;
 if p_now>=l.grace_at then
  update private.server_bank_loans set status='DEFAULTED',settled_at=p_now,reminders=4 where id=l.id;
  insert into private.server_bank_collateral(bank_id,ticket_id,quantity) values(l.bank_id,l.ticket_id,l.tickets)
   on conflict(bank_id,ticket_id) do update set quantity=private.server_bank_collateral.quantity+excluded.quantity;
  insert into private.server_bank_profiles(user_id,penalty_until) values(l.borrower_id,l.grace_at+interval '15 days')
   on conflict(user_id) do update set penalty_until=greatest(private.server_bank_profiles.penalty_until,excluded.penalty_until);
  insert into private.server_bank_ledger(user_id,bank_id,loan_id,kind,ticket_id) values(l.borrower_id,l.bank_id,l.id,'DEFAULTED',l.ticket_id);
  return;
 end if;
 if l.status='ACTIVE' then
  update private.player_wallets set silver=silver-l.principal-l.interest,updated_at=p_now
   where user_id=l.borrower_id and silver>=l.principal+l.interest;
  paid:=found;
  if paid then
   update private.server_banks set vault=vault+l.principal+l.interest where id=l.bank_id;
   insert into private.market_assets(user_id,item_id,quantity) values(l.borrower_id,l.ticket_id,l.tickets)
    on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=p_now;
   update private.server_bank_loans set status='REPAID',settled_at=p_now where id=l.id;
   insert into private.server_bank_ledger(user_id,bank_id,loan_id,kind,wallet_delta,vault_delta,ticket_id,ticket_delta)
    values(l.borrower_id,l.bank_id,l.id,'AUTO_REPAID',-l.principal-l.interest,l.principal+l.interest,l.ticket_id,l.tickets);
   perform private.persist_market_economy_to_save(l.borrower_id);
   return;
  end if;
 end if;
 n:=least(4,1+floor(extract(epoch from(p_now-l.maturity_at))/21600)::integer);
 update private.server_bank_loans set status='GRACE_PERIOD',reminders=n where id=l.id;
end $function$

