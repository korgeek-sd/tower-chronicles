-- Server-only banking. Existing prototype localStorage balances are never imported.
create table private.server_banks(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null unique references auth.users(id),
 name text not null check(char_length(name) between 2 and 30),rate integer not null check(rate between 1 and 50),
 durations integer[] not null check(cardinality(durations) between 1 and 4 and durations <@ array[5,10,15,30]),
 vault bigint not null check(vault between 0 and 9007199254740991),created_at timestamptz not null default now()
);
create table private.server_bank_profiles(user_id uuid primary key references auth.users(id),penalty_until timestamptz);
create table private.server_bank_loans(
 id uuid primary key default gen_random_uuid(),bank_id uuid not null references private.server_banks(id),borrower_id uuid not null references auth.users(id),
 ticket_id text not null check(ticket_id in ('ticket:ore:1','ticket:leather:1','ticket:gem:1','ticket:kaleon:1')),
 tickets bigint not null check(tickets between 1 and 1000000),principal bigint not null check(principal>0),interest bigint not null check(interest>=0),
 rate integer not null check(rate between 1 and 50),duration integer not null check(duration in (5,10,15,30)),
 issued_at timestamptz not null,maturity_at timestamptz not null,grace_at timestamptz not null,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','GRACE_PERIOD','REPAID','DEFAULTED')),
 reminders integer not null default 0 check(reminders between 0 and 4),settled_at timestamptz,
 check(principal=tickets*50000),check(maturity_at>issued_at and grace_at>maturity_at)
);
create index server_bank_loans_due_idx on private.server_bank_loans(maturity_at) where status in ('ACTIVE','GRACE_PERIOD');
create index server_bank_loans_borrower_idx on private.server_bank_loans(borrower_id,issued_at desc);
create index server_bank_loans_bank_idx on private.server_bank_loans(bank_id);
create table private.server_bank_collateral(
 bank_id uuid not null references private.server_banks(id),ticket_id text not null,quantity bigint not null check(quantity>=0),primary key(bank_id,ticket_id)
);
create table private.server_bank_requests(
 user_id uuid not null references auth.users(id),request_id uuid not null,action text not null,params jsonb not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,request_id)
);
create index server_bank_requests_rate_idx on private.server_bank_requests(user_id,created_at desc);
create table private.server_bank_ledger(
 id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),bank_id uuid not null references private.server_banks(id),
 loan_id uuid references private.server_bank_loans(id),kind text not null,wallet_delta bigint not null default 0,vault_delta bigint not null default 0,
 ticket_id text,ticket_delta bigint not null default 0,created_at timestamptz not null default now()
);
create index server_bank_ledger_user_idx on private.server_bank_ledger(user_id,id desc);
do $$declare t text;begin
 foreach t in array array['server_banks','server_bank_profiles','server_bank_loans','server_bank_collateral','server_bank_requests','server_bank_ledger'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end $$;
revoke all on sequence private.server_bank_ledger_id_seq from public,anon,authenticated;

-- Preserve the deployed save function while aligning lock order with monetary RPCs.
-- Otherwise a save can hold game_saves while maturity settlement holds the wallet.
do $lock_order$
declare definition text;patched text;
begin
 definition:=pg_get_functiondef('public.save_game_state(uuid,bigint,text,bigint,integer,text,jsonb,text,text)'::regprocedure);
 if position('tc-market-mutations' in definition)=0 then
  patched:=regexp_replace(definition,E'\nbegin\n',E'\nbegin\n perform pg_advisory_xact_lock(hashtextextended(''tc-market-mutations'',0));\n');
  if patched=definition then raise exception 'BANK_SAVE_LOCK_TARGET_UNEXPECTED';end if;
  execute patched;
 end if;
end $lock_order$;

-- Caller already owns the shared economy advisory lock. Loan row locks protect terminal transitions.
create function private.settle_server_bank_loan(p_loan uuid,p_now timestamptz)
returns void language plpgsql set search_path='' as $$
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
end $$;
revoke all on function private.settle_server_bank_loan(uuid,timestamptz) from public,anon,authenticated;

create function private.server_bank_state(u uuid)
returns jsonb language sql set search_path='' as $$
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
$$;
revoke all on function private.server_bank_state(uuid) from public,anon,authenticated;

create function public.get_server_bank(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;l record;t timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('tc-market-mutations',0));
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 perform private.sync_market_economy_from_latest_save(u);
 t:=clock_timestamp();
 for l in select id from private.server_bank_loans where borrower_id=u and status in ('ACTIVE','GRACE_PERIOD') and maturity_at<=t order by maturity_at,id loop
  perform private.settle_server_bank_loan(l.id,t);
 end loop;
 return jsonb_build_object('state',private.server_bank_state(u),'record',private.cloud_record_json(u));
end $$;
revoke all on function public.get_server_bank(uuid,bigint,text,text) from public,anon;
grant execute on function public.get_server_bank(uuid,bigint,text,text) to authenticated;

create function public.server_bank_action(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,p_request_id uuid,p_action text,p_params jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.server_bank_action(uuid,bigint,text,text,uuid,text,jsonb) from public,anon;
grant execute on function public.server_bank_action(uuid,bigint,text,text,uuid,text,jsonb) to authenticated;

create function private.process_server_bank_due()
returns integer language plpgsql security definer set search_path='' as $$
declare l record;t timestamptz:=clock_timestamp();n integer:=0;
begin
 if not exists(select 1 from private.server_bank_loans where status in ('ACTIVE','GRACE_PERIOD') and maturity_at<=t) then return 0;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('tc-market-mutations',0)) then return 0;end if;
 t:=clock_timestamp();
 for l in select id from private.server_bank_loans where status in ('ACTIVE','GRACE_PERIOD') and maturity_at<=t
  and (status='ACTIVE' or grace_at<=t or reminders<least(4,1+floor(extract(epoch from(t-maturity_at))/21600)::integer)) order by maturity_at,id limit 100 loop
  begin
   perform private.settle_server_bank_loan(l.id,t);n:=n+1;
  exception when others then raise log 'server bank settlement failed for %: %',l.id,sqlerrm;
  end;
 end loop;
 return n;
end $$;
revoke all on function private.process_server_bank_due() from public,anon,authenticated;
-- Scheduler integration (PGlite tests validate the same functions without pg_cron).
select cron.schedule('server-bank-settlement','* * * * *','select private.process_server_bank_due();');
