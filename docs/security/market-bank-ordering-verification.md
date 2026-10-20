# Market and bank ordering verification — 2026-10-20

## Result and limits
Eight sequential scenarios passed twice in isolated, owner-only PostgreSQL namespaces. No new defect was observed within this scope. Actual concurrent connections and backend lock interleavings were NOT tested. This does not close the concurrency review or establish overall security completion.

Nine live function bodies were copied with only schema references and the advisory lock key renamed. Catalog comparisons confirmed unchanged logic for all nine: require_active_game_session, place_online_market_order, cancel_online_market_order, close_market_order, market_order_mail, deliver_market_asset, server_bank_action, settle_server_bank_loan and process_server_bank_due.

Auth transport, economy hydration, save formatting/hashing, premium lookup, response formatting and Realtime delivery use simplified fixture adapters. These tests exercise the copied transaction logic, not the complete production integration.

| Scenario | Observed invariant |
|---|---|
| Cancel SELL before BUY | No fill; stock 10 and total currency 20000 conserved |
| Full BUY before cancel | Fill 10; cancellation rejected; stock/currency conserved |
| Partial BUY then cancel | Fill 5; remaining 5 returned; stock/currency conserved |
| Automatic repayment then manual | Manual rejected as closed; wallet 45000, vault 55000, ticket 1, ledger 1 |
| Manual repayment then auto and replay | Same totals; one request receipt and ledger entry |
| Automatic default after grace | Wallet 100000 untouched; collateral 1, returned ticket 0, ledger 1 |
| Inject persistence failure during auto/manual repayment | ACTIVE loan, wallet 100000, vault 0, ledger 0; no partial settlement |
| Inject persistence failure during SELL | Stock 10; no retained order |

## Lock review
Market placement, cancellation and manual bank actions acquire the same global advisory transaction lock before their session/save/order work. The due-loan worker uses a nonblocking attempt at that key and skips a busy run. The settlement helper locks the loan and rejects closed status. Sequential results agree with that design; they do not measure simultaneous execution.

## Reproduction
Export the nine named functions as a JSON array of objects containing schema, name and definition from pg_namespace/pg_proc, using pg_get_functiondef(oid). Keep the live snapshot outside version control.

Generate the default private sandbox and concrete checks:

```sh
node scripts/security/build-economy-race-sandbox.mjs DISPOSABLE_AUTH_UUID functions.json setup.sql --checks-out checks.sql
```

Review and apply setup.sql as the database test owner, then run checks.sql. The fixture and ordering template are adjacent to the generator. The default driver is SECURITY INVOKER, restricted to postgres/supabase_admin, with PUBLIC/anon/authenticated execution revoked. Schema access is revoked too. Remove the four generated namespaces and disposable Auth account afterward. Generated SQL must not be committed or deployed as application migrations.

The optional --public-driver mode is a proposed temporary account/session-guarded SECURITY DEFINER RPC for real HTTP concurrency testing. It grants authenticated execution but checks the exact disposable account and valid Auth session before accessing only fixture namespaces. Applying that mode requires explicit approval: automatic approval review rejected creation because it adds a privileged public API surface. It was never created. No bypass was attempted. A local embedded PostgreSQL alternative could not start under the runtime UID restrictions.

## Cleanup and remaining work
All four test namespaces and the disposable Auth user were deleted. Follow-up catalog counts were zero for namespaces, user and public QA driver. Initial cleanup requests returned expired request-state errors; cleanup then succeeded through the other connection to the same project. No production gameplay function or data was changed.

Next: actual simultaneous market match/cancel and automatic/manual repayment tests; then gold escrow, market-storage claims and hunting/boss/quest reward replay. Overall defense completion remains unquantified.
