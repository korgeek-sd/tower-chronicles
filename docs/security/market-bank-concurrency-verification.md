# Market and bank backend concurrency verification

Tested 2026-10-20 UTC; cleanup status checked 2026-10-21 UTC.

## Result
Six actual backend-overlap scenarios passed across a market run and a final bank run. No duplicate asset, duplicate repayment or new defect was observed in this scope. No production gameplay function was changed. This is not overall security certification.

| Overlapping operations | Observed result |
|---|---|
| Cancel SELL then BUY | No fill; stock 10, wallet + escrow + fees 20000 |
| Full BUY then cancel | Fill 10; cancel rejected; same conservation totals |
| Partial BUY then cancel | Fill 5; remainder returned; same conservation totals |
| Automatic repayment then manual | Manual BANK_LOAN_CLOSED; wallet 45000, vault 55000, returned ticket 1, ledger 1 |
| Manual repayment then automatic | Automatic processed 0 while busy; manual replay retained one repayment and collateral return |
| Automatic default then manual | Manual BANK_LOAN_CLOSED; wallet 100000 unchanged, vault 0, collateral 1, returned ticket 0, ledger 1 |

All six pairs used distinct PostgreSQL backend IDs and overlapping clock_timestamp execution intervals, rather than HTTP interval overlap alone. Market cases used a three-second lock-holder delay. Final bank cases used seven seconds, observed advisory contention, and a one-second pre-lock delay for the contender to compensate for network arrival jitter. Initial attempts with no overlap, reused backend or reversed arrival order were excluded from passing evidence.

## Scope and access controls
Following explicit user approval, a temporary public SECURITY DEFINER test RPC was restricted to the exact disposable Auth account with a valid auth.sessions row. Anonymous HTTP execution was denied. SQL claim-context probes rejected another account and the correct account with an invalid session. Anonymous EXECUTE and authenticated fixture-schema USAGE were also verified false.

Nine critical live function bodies were copied into isolated, non-exposed namespaces. Catalog comparison confirmed all nine match after schema references and advisory-lock key renaming: require_active_game_session, place_online_market_order, cancel_online_market_order, close_market_order, market_order_mail, deliver_market_asset, server_bank_action, settle_server_bank_loan and process_server_bank_due.

The driver acquires the fixture lock before delaying to force contention. Core function bodies are unchanged. Gameplay Auth, save formatting/hashing, hydration, premium lookup, response formatting and Realtime delivery are simplified fixture adapters. This tests copied transaction logic on the managed database, not the complete production integration. The automatic worker was invoked directly; Cron scheduling was not tested. No live order book or real borrower loan was changed.

## Reproduction
Use build-economy-race-sandbox.mjs with a disposable Auth UUID and a current function snapshot; --public-driver requires approval. After reviewing/applying the generated setup, run economy-race-http.py with private configuration through stdin. Fields are url, key (publishable), email, password and driver (generated RPC name). Do not commit generated SQL, configuration or tokens. --bank-only runs the three bank cases. Setup timing failures must be excluded from passing evidence.

## Cleanup status: incomplete
The public QA driver was revoked and deleted; final catalog count was zero. Credential configuration and generated local SQL are no longer present. The disposable Auth account was banned indefinitely and its password replaced with an unknown random value.

Four non-exposed fixture namespaces and one banned Auth account remain: final counts schemas=4, users=1, user_banned=true, public_driver=0. Repeated cleanup calls returned Invalid or expired requestState or were interrupted without successful completion. Do not describe this as full removal.

scripts/security/cleanup-completed-economy-race.sql contains exact scoped cleanup and verification statements, with no credentials. It needs a working administrative database connection; cleanup of these already approved fixtures does not require new testing authorization.

Security advisors were inspected during testing. The temporary privileged-RPC warning was addressed by deleting the driver. Broader existing RPC warnings and leaked-password-protection configuration were not resolved by this test; this is not a clean advisor attestation.

Remaining review: gold escrow, market-storage claims and hunting/boss/quest reward replay, plus complete fixture cleanup.
