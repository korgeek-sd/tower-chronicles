do $verify$ declare r jsonb;s jsonb;first text;qty integer;begin
for first,qty in values('cancel'::text,10),('fill',10),('fill',5) loop
 perform __QA_PRIVATE__.qa_driver('reset_market');r:=__QA_PRIVATE__.qa_driver('sell');if r->>'ok' is distinct from 'true' then raise exception 'QA_SELL_FAILED %',r;end if;
 if first='cancel' then
  r:=__QA_PRIVATE__.qa_driver('cancel');if r->>'ok' is distinct from 'true' then raise exception 'QA_CANCEL_FAILED';end if;
  r:=__QA_PRIVATE__.qa_driver('buy',qty);if r->>'ok' is distinct from 'true' then raise exception 'QA_BUY_FAILED %',r;end if;
 else
  r:=__QA_PRIVATE__.qa_driver('buy',qty);if r->>'ok' is distinct from 'true' then raise exception 'QA_BUY_FAILED %',r;end if;
  r:=__QA_PRIVATE__.qa_driver('cancel');
  if qty=10 then if r->>'error' is distinct from 'ORDER_NOT_CANCELLABLE' then raise exception 'QA_FILLED_CANCEL %',r;end if;
  elsif r->>'ok' is distinct from 'true' then raise exception 'QA_PARTIAL_CANCEL %',r;end if;
 end if;
 s:=__QA_PRIVATE__.qa_driver('snapshot');
 if (s->'market'->>'stock')::bigint is distinct from 10::bigint or
 ((s->'market'->>'wallet')::bigint+(s->'market'->>'escrow')::bigint+(s->'market'->>'fees')::bigint) is distinct from 20000::bigint or
 (s->'market'->>'traded')::bigint is distinct from (case when first='cancel' then 0 else qty end)::bigint then raise exception 'QA_MARKET_CONSERVATION %',s;end if;
end loop;
perform __QA_PRIVATE__.qa_driver('reset_bank');r:=__QA_PRIVATE__.qa_driver('auto');if r->'result'->>'processed' is distinct from '1' then raise exception 'QA_AUTO_FAILED %',r;end if;
r:=__QA_PRIVATE__.qa_driver('repay');if r->>'error' is distinct from 'BANK_LOAN_CLOSED' then raise exception 'QA_AUTO_REPLAY %',r;end if;
s:=__QA_PRIVATE__.qa_driver('snapshot');if s->'bank'->>'status' is distinct from 'REPAID' or s->'bank'->>'wallet' is distinct from '45000' or s->'bank'->>'vault' is distinct from '55000' or s->'bank'->>'ledger' is distinct from '1' or s->'bank'->>'tickets' is distinct from '1' then raise exception 'QA_AUTO_INVARIANT %',s;end if;
perform __QA_PRIVATE__.qa_driver('reset_bank');r:=__QA_PRIVATE__.qa_driver('repay');if r->>'ok' is distinct from 'true' then raise exception 'QA_MANUAL_FAILED %',r;end if;
perform __QA_PRIVATE__.qa_driver('auto');perform __QA_PRIVATE__.qa_driver('repay');
s:=__QA_PRIVATE__.qa_driver('snapshot');if s->'bank'->>'status' is distinct from 'REPAID' or s->'bank'->>'wallet' is distinct from '45000' or s->'bank'->>'vault' is distinct from '55000' or s->'bank'->>'ledger' is distinct from '1' or s->'bank'->>'tickets' is distinct from '1' or s->'bank'->>'receipts' is distinct from '1' then raise exception 'QA_MANUAL_INVARIANT %',s;end if;
perform __QA_PRIVATE__.qa_driver('reset_bank',10,0,true);perform __QA_PRIVATE__.qa_driver('auto');perform __QA_PRIVATE__.qa_driver('auto');r:=__QA_PRIVATE__.qa_driver('repay');
s:=__QA_PRIVATE__.qa_driver('snapshot');if s->'bank'->>'status' is distinct from 'DEFAULTED' or s->'bank'->>'wallet' is distinct from '100000' or s->'bank'->>'vault' is distinct from '0' or s->'bank'->>'ledger' is distinct from '1' or s->'bank'->>'collateral' is distinct from '1' or s->'bank'->>'tickets' is distinct from '0' or r->>'error' is distinct from 'BANK_LOAN_CLOSED' then raise exception 'QA_DEFAULT_INVARIANT %',s;end if;
perform __QA_PRIVATE__.qa_driver('reset_bank');perform __QA_PRIVATE__.qa_driver('auto',10,0,false,true);r:=__QA_PRIVATE__.qa_driver('repay',10,0,false,true);
s:=__QA_PRIVATE__.qa_driver('snapshot');if r->>'error' is distinct from 'TEST_PERSIST_FAILURE' or s->'bank'->>'status' is distinct from 'ACTIVE' or s->'bank'->>'wallet' is distinct from '100000' or s->'bank'->>'vault' is distinct from '0' or s->'bank'->>'ledger' is distinct from '0' or s->'bank'->>'tickets' is distinct from '0' then raise exception 'QA_SETTLEMENT_PARTIAL_FAILURE %',s;end if;
perform __QA_PRIVATE__.qa_driver('reset_market');r:=__QA_PRIVATE__.qa_driver('sell',10,0,false,true);s:=__QA_PRIVATE__.qa_driver('snapshot');
if r->>'error' is distinct from 'TEST_PERSIST_FAILURE' or s->'market'->>'stock' is distinct from '10' or s->'market'->>'orders' is distinct from '0' then raise exception 'QA_ORDER_PARTIAL_FAILURE %',s;end if;
end $verify$;select 'PASS: 3 market orderings, 3 repayment/default orderings, bank and market rollback invariants; sequential only' as result;
