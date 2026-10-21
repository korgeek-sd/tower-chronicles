CREATE OR REPLACE FUNCTION public.server_bank_action(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_action text, p_params jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid;b private.server_banks%rowtype;l private.server_bank_loans%rowtype;r private.server_bank_requests%rowtype;
 amount bigint;qty bigint;ticket text;days integer;rate integer;durations integer[];t timestamptz;target uuid;result jsonb:='{}';
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null or p_action is null or p_params is null or jsonb_typeof(p_params) is distinct from 'object' or octet_length(p_params::text)>2048 then raise exception 'BANK_INPUT_INVALID';end if;
 select * into r from private.server_bank_requests where user_id=u and request_id=p_request_id;
 if found then
  if r.action<>p_action or r.params<>p_params then raise exception 'BANK_REQUEST_CONFLICT';end if;
  return jsonb_build_object('result',r.result,'state',private.server_bank_state(u),'record',private.cloud_record_json(u));
 end if;
 if (select count(*) from private.server_bank_requests where user_id=u and created_at>clock_timestamp()-interval '1 minute')>=30 then raise exception 'BANK_RATE_LIMIT';end if;
 perform private.sync_market_economy_from_latest_save(u);
 if exists(select 1 from public.game_saves where user_id=u and payload->'expedition' is not null and payload->'expedition'<>'null'::jsonb)
  or exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') then raise exception 'BANK_EXPEDITION_ACTIVE';end if;
 t:=clock_timestamp();
 if p_action='CREATE' then
  if not private.premium_active(u) then raise exception 'BANK_PREMIUM_REQUIRED';end if;
  if exists(select 1 from private.server_banks where owner_id=u) then raise exception 'BANK_ALREADY_OWNED';end if;
  if jsonb_typeof(p_params->'amount') is distinct from 'number' or (p_params->>'amount') !~ '^[0-9]{1,13}$'
   or jsonb_typeof(p_params->'rate') is distinct from 'number' or (p_params->>'rate') !~ '^[0-9]{1,2}$'
   or jsonb_typeof(p_params->'name') is distinct from 'string' or length(trim(p_params->>'name')) not between 2 and 30
   or jsonb_typeof(p_params->'durations') is distinct from 'array' or jsonb_array_length(p_params->'durations') not between 1 and 4 then raise exception 'BANK_INPUT_INVALID';end if;
  amount:=(p_params->>'amount')::bigint;rate:=(p_params->>'rate')::integer;
  if amount not between 1000000 and 1000000000000 or rate not between 1 and 50 then raise exception 'BANK_INPUT_INVALID';end if;
  if exists(select 1 from jsonb_array_elements(p_params->'durations') x where jsonb_typeof(x) is distinct from 'number' or x::text not in ('5','10','15','30')) then raise exception 'BANK_INPUT_INVALID';end if;
  select array_agg(distinct x::integer order by x::integer) into durations from jsonb_array_elements_text(p_params->'durations') x;
  update private.player_wallets set silver=silver-amount,updated_at=t where user_id=u and silver>=amount;
  if not found then raise exception 'BANK_SILVER_SHORTAGE';end if;
  insert into private.server_banks(owner_id,name,rate,durations,vault) values(u,trim(p_params->>'name'),rate,durations,amount) returning * into b;
  insert into private.server_bank_ledger(user_id,bank_id,kind,wallet_delta,vault_delta) values(u,b.id,'CREATE',-amount,amount);
  result:=jsonb_build_object('bankId',b.id);
 elsif p_action in ('DEPOSIT','WITHDRAW','CLAIM_COLLATERAL') then
  select * into b from private.server_banks where owner_id=u for update;
  if not found then raise exception 'BANK_NOT_OWNER';end if;
  if p_action='CLAIM_COLLATERAL' then
   ticket:=p_params->>'ticketId';
   if ticket is null or ticket not in ('ticket:ore:1','ticket:leather:1','ticket:gem:1','ticket:kaleon:1') then raise exception 'BANK_INPUT_INVALID';end if;
   select quantity into qty from private.server_bank_collateral where bank_id=b.id and ticket_id=ticket for update;
   if not found or qty<=0 then raise exception 'BANK_COLLATERAL_EMPTY';end if;
   update private.server_bank_collateral set quantity=0 where bank_id=b.id and ticket_id=ticket;
   insert into private.market_assets(user_id,item_id,quantity) values(u,ticket,qty)
    on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=t;
   insert into private.server_bank_ledger(user_id,bank_id,kind,ticket_id,ticket_delta) values(u,b.id,p_action,ticket,qty);
   result:=jsonb_build_object('ticketId',ticket,'tickets',qty);
  else
  if jsonb_typeof(p_params->'amount') is distinct from 'number' or (p_params->>'amount') !~ '^[0-9]{1,13}$' then raise exception 'BANK_INPUT_INVALID';end if;
  amount:=(p_params->>'amount')::bigint;if amount not between 1 and 1000000000000 then raise exception 'BANK_INPUT_INVALID';end if;
  if p_action='DEPOSIT' then
   update private.player_wallets set silver=silver-amount,updated_at=t where user_id=u and silver>=amount;
   if not found then raise exception 'BANK_SILVER_SHORTAGE';end if;
   update private.server_banks set vault=vault+amount where id=b.id;
   insert into private.server_bank_ledger(user_id,bank_id,kind,wallet_delta,vault_delta) values(u,b.id,p_action,-amount,amount);
  else
   update private.server_banks set vault=vault-amount where id=b.id and vault>=amount;
   if not found then raise exception 'BANK_VAULT_SHORTAGE';end if;
   update private.player_wallets set silver=silver+amount,updated_at=t where user_id=u;
   insert into private.server_bank_ledger(user_id,bank_id,kind,wallet_delta,vault_delta) values(u,b.id,p_action,amount,-amount);
  end if;
  end if;
 elsif p_action='BORROW' then
  if (select count(*) from private.server_bank_loans where borrower_id=u and status in ('ACTIVE','GRACE_PERIOD'))>=20 then raise exception 'BANK_LOAN_LIMIT';end if;
  if exists(select 1 from private.server_bank_profiles where user_id=u and penalty_until>t)
   or exists(select 1 from private.server_bank_loans where borrower_id=u and status in ('ACTIVE','GRACE_PERIOD') and grace_at<=t and grace_at+interval '15 days'>t) then raise exception 'BANK_PENALIZED';end if;
  target:=(p_params->>'bankId')::uuid;ticket:=p_params->>'ticketId';
  if target is null or ticket is null or ticket not in ('ticket:ore:1','ticket:leather:1','ticket:gem:1','ticket:kaleon:1')
   or jsonb_typeof(p_params->'tickets') is distinct from 'number' or (p_params->>'tickets') !~ '^[0-9]{1,7}$'
   or jsonb_typeof(p_params->'duration') is distinct from 'number' or (p_params->>'duration') !~ '^[0-9]{1,2}$' then raise exception 'BANK_INPUT_INVALID';end if;
  qty:=(p_params->>'tickets')::bigint;days:=(p_params->>'duration')::integer;
  if qty not between 1 and 1000000 or days not in (5,10,15,30) then raise exception 'BANK_INPUT_INVALID';end if;
  select * into b from private.server_banks where id=target for update;
  if not found then raise exception 'BANK_NOT_FOUND';end if;
  if b.owner_id=u then raise exception 'BANK_SELF_LOAN';end if;
  if not days=any(b.durations) then raise exception 'BANK_DURATION_INVALID';end if;
  amount:=qty*50000;
  update private.server_banks set vault=vault-amount where id=b.id and vault>=amount;
  if not found then raise exception 'BANK_VAULT_SHORTAGE';end if;
  update private.market_assets set quantity=quantity-qty,updated_at=t where user_id=u and item_id=ticket and quantity>=qty;
  if not found then raise exception 'BANK_TICKET_SHORTAGE';end if;
  update private.player_wallets set silver=silver+amount,updated_at=t where user_id=u;
  insert into private.server_bank_loans(bank_id,borrower_id,ticket_id,tickets,principal,interest,rate,duration,issued_at,maturity_at,grace_at)
   values(b.id,u,ticket,qty,amount,floor(amount*b.rate/100.0),b.rate,days,t,t+days*interval '1 day',t+(days+1)*interval '1 day') returning * into l;
  insert into private.server_bank_ledger(user_id,bank_id,loan_id,kind,wallet_delta,vault_delta,ticket_id,ticket_delta)
   values(u,b.id,l.id,'BORROW',amount,-amount,ticket,-qty);
  result:=jsonb_build_object('loanId',l.id);
 elsif p_action='REPAY' then
  target:=(p_params->>'loanId')::uuid;
  select * into l from private.server_bank_loans where id=target and borrower_id=u for update;
  if not found then raise exception 'BANK_LOAN_NOT_FOUND';end if;
  if l.status not in ('ACTIVE','GRACE_PERIOD') then raise exception 'BANK_LOAN_CLOSED';end if;
  if t<l.maturity_at then raise exception 'BANK_NOT_MATURE';end if;
  if t>=l.grace_at then
   perform private.settle_server_bank_loan(l.id,t);
   result:=jsonb_build_object('loanId',l.id,'status','DEFAULTED');
  else
   amount:=l.principal+l.interest;
   update private.player_wallets set silver=silver-amount,updated_at=t where user_id=u and silver>=amount;
   if not found then raise exception 'BANK_SILVER_SHORTAGE';end if;
   update private.server_banks set vault=vault+amount where id=l.bank_id;
   insert into private.market_assets(user_id,item_id,quantity) values(u,l.ticket_id,l.tickets)
    on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+excluded.quantity,updated_at=t;
   update private.server_bank_loans set status='REPAID',settled_at=t where id=l.id;
   insert into private.server_bank_ledger(user_id,bank_id,loan_id,kind,wallet_delta,vault_delta,ticket_id,ticket_delta)
    values(u,l.bank_id,l.id,'REPAID',-amount,amount,l.ticket_id,l.tickets);
   result:=jsonb_build_object('loanId',l.id,'status','REPAID');
  end if;
 else raise exception 'BANK_INPUT_INVALID';end if;
 perform private.persist_market_economy_to_save(u);
 insert into private.server_bank_requests(user_id,request_id,action,params,result) values(u,p_request_id,p_action,p_params,result);
 return jsonb_build_object('result',result,'state',private.server_bank_state(u),'record',private.cloud_record_json(u));
end $function$

