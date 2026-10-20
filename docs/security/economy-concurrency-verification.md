# Economy replay and concurrency verification — 2026-10-20 (KST)

## Result
No duplicate reward, duplicate bank transfer or repeated cancellation refund was observed in the tested paths. No production function/schema change was required.

## Actual HTTP concurrency
A dedicated disposable account authenticated through Auth and acquired a real gameplay lease.
A four-thread barrier submitted four identical requests per case. The client checked that all four HTTP request intervals overlapped; these were real REST RPC calls, not SQL-only claim simulations.

| Case | Requests | Observed result |
|---|---:|---|
| Same mail reward claim | 4 overlapping | All HTTP 200; silver +2, gold +1, item +1 exactly once |
| Same bank deposit request ID | 4 overlapping | Wallet -100, vault +100 once |
| Same bank withdrawal request ID | 4 overlapping | Wallet +200, vault -200 once |

Separate requests rejected changed parameters for a reused ID (BANK_REQUEST_CONFLICT), insufficient vault balance (BANK_VAULT_SHORTAGE), negative amount and a missing request ID (BANK_INPUT_INVALID).
The earlier database-tool calls were checked for timing and did NOT overlap; they are counted only as sequential replay checks, not concurrency evidence.

## Independent database invariants
The committed synthetic fixture ended with:
- Wallet silver 1178, gold 8; bank vault 900.
- Wallet + vault = 2078, matching initial synthetic funds 2000 plus mail awards 78.
- Exactly two bank request receipts and two DEPOSIT/WITHDRAW ledger entries.
- Seven awarded job-draw tickets; current save revision 7.
These values include earlier sequential mail probes, not additional production rewards.

## Rollback-only atomicity/cancellation regression
supabase/tests/economy_atomicity_regression.sql passed against the live database.
- A valid reward processed before an invalid reward in claim_all was fully rolled back: no retained currency/item, claimed flag or save revision increment.
- Cancelling a synthetic BUY order refunded escrow exactly once; repeated cancellation was rejected and only one summary mail existed.
- Gold order cancellation with the same request ID replayed safely; another request ID could not refund an already-cancelled order.
All orders in this SQL test were created and rolled back in one subtransaction and were never committed to the public order books.

## Existing defenses inspected
Reviewed manage_game_mail, claim_online_market_storage, claim_all_online_market_storage, cancel_online_market_order, cancel_online_gold_exchange_order and server_bank_action, plus their main lock/delivery/settlement helpers.
require_active_game_session locks the per-user active session row. Mail also locks the canonical save and mail rows. Bank checks an idempotency receipt under its mutation lock.
This is a scoped review, not a proof that every caller and cross-user interaction is safe.

## Reproduction
- SQL: supabase/tests/economy_atomicity_regression.sql (privileged test owner; self-contained rollback-only fixtures).
- HTTP: python scripts/security/economy-http-concurrency.py CONFIG_JSON.
Provision a dedicated disposable email-auth account, profile-independent gameplay fixture, seeded wallet/assets, owned bank and one unclaimed coupon reward containing silver 2, gold 1 and other:job_draw_ticket quantity 1.
The private JSON config requires url, key, email, password, mailId, depositRequestId, withdrawRequestId, initialSilver, initialGold, initialItemQuantity and initialVault.
Use fresh request IDs and an exclusive fixture lease. Seed sufficient funds for the 100 deposit and 200 withdrawal; initialVault must be below the server maximum.
The script performs real committed mutations on its fixture. The provisioning caller must delete fixtures after use. Do not commit credentials.

## Cleanup
Deleted the synthetic bank ledger, bank request receipts, bank, Auth user and cascading gameplay data. Follow-up counts were zero for users, banks, bank ledger, mail and wallets. Local temporary credentials were removed.
Some management calls failed with request-state errors; these were not counted as successful tests. Cleanup completed using an atomic, test-account-scoped statement after confirming restrictive bank foreign keys.

## Remaining checks
Concurrent market matching vs cancellation, item/gold escrow races across different users, bank automatic settlement vs manual repayment, market-storage claims and hunting/boss/quest reward replay still need targeted tests.
The HTTP observation demonstrates overlapping client requests, not a measured backend interleaving for every critical section.
