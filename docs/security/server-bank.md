# Server-authoritative bank rollout

## Authority and retained rules

All production bank balances, contracts, collateral, penalties, request receipts and ledger entries live in private tables. Browser prototype storage is preserved but neither imported nor accepted as currency or debt. New online banks start with real server-wallet deposits; no system test bank or free currency is seeded.

Retained contract values: premium required to establish a bank; at least 1,000,000 silver founding capital; 1–50% simple interest; durations 5/10/15/30 days; collateral valuation 50,000 silver per ticket; no early repayment; 24-hour grace; four six-hour reminder stages; 15-day new-loan restriction after default. As in the original UI, collateral is first-floor tower tickets, not occupation-war challenge tickets. Each new contract explicitly selects one tower's ticket type; that exact asset is escrowed and returned. Multiple contracts can use different types.

Only available vault cash can be withdrawn. Defaulted collateral is recorded by ticket type in the bank vault and can be claimed by the bank owner. These operations use the same authenticated transaction path as deposits and loans. Premium expiration does not prevent an existing owner from recovering deposited funds or handling existing contracts.

## Atomicity and idempotency

Bank RPCs acquire the existing `tc-market-mutations` transaction advisory lock *before* the active gameplay lease guard, matching the production economy lock order. The migration preserves the deployed save function and adds the same advisory lock before its existing row locks; this closes a save-vs-settlement lock inversion without changing its auth or save logic. Actor identity, auth session, lease ID/generation, device and client ID come from the server guard. Transactions during an expedition are rejected. Amounts and quantities are validated by the server and SQL constraints.

Every monetary action updates wallets/assets, vault, contract status, audit ledger and save projection in one PostgreSQL transaction. A failure, including persistence failure, rolls back all those changes. A unique `(user_id, request_id)` receipt prevents double execution. Reusing an ID with different contents is rejected; replay returns a fresh state/save plus the original outcome. Terminal loan statuses cannot be settled twice. New actions are capped at 30 per account per minute, with up to 20 outstanding loans; replays remain available for reconciliation.

The client persists an uncertain action's exact request ID and parameters in sessionStorage before sending it. Reloads and token/lease renewal retain that ID. Network/5xx/invalid-success responses keep the pending intent and block new transactions until the same request is reconciled. Definitive 4xx rejections clear the failed intent. No client callback directly credits/debits game state.

## Server maturity processing

A private pg_cron job runs every minute and processes up to 100 due contracts. It uses the same economy lock, skipping a tick if another transaction owns it. Each loan is settled inside an exception boundary so a single failure rolls back that loan's changes and is logged without partially settling it or aborting unrelated contracts.

At the first check between maturity and grace expiry, an ACTIVE loan is automatically repaid only if the borrower's server wallet can cover the full amount. Otherwise it enters grace; subsequent manual repayment is allowed within the grace window. Reminder stage is derived from server time. At or after grace expiry it defaults, including after service downtime: no late retroactive debit occurs. The penalty end is the contractual grace expiry plus 15 days, so downtime cannot lengthen it. Direct borrowing also checks expired unpaid contracts so cron delay cannot bypass the restriction. Reading the borrower's bank state catches up that borrower's due contracts as well.

The scheduler's granularity is one minute; money is tested at settlement time, not a captured balance at the exact maturity instant. Financial effects are saved to the authoritative cloud projection and picked up by existing revision reconciliation on other devices. The cron function is not callable by anon/authenticated roles.

## Rollout and verification

1. Verify production helper definitions, ticket IDs, wallet/asset schemas and pg_cron availability. Do not change wallet/bootstrap implementations or economic values.
2. Apply the reviewed `server_bank_authority` migration to the target Supabase project. Confirm all new tables have RLS and no direct anon/authenticated grants; only the two authenticated RPC entry points are callable. Confirm the named cron job is active exactly once.
3. Use rollback-only production checks so no test bank, currency, contract or collateral persists. Verify invalid auth/input guards and advisory-lock serialization on the actual server.
4. Merge/release the frontend only after database readiness and CI pass; then verify the deployed bundle uses the new RPCs and no prototype grant code.

The automated PGlite suite loads the migration's actual bank functions with minimal stand-ins for the existing auth/save projection interfaces. It checks currency conservation, exact collateral return, repeated requests, insufficient funds, atomic rollback after persistence failure, competing requests, terminal settlement, grace/default timing, owner operations, privacy, permissions and invalid leases. PGlite queues calls within one engine; its competing-request tests do not prove interconnection PostgreSQL scheduling. Production advisory-lock checks supplement that coverage.

Rollback: return the frontend to maintenance first; preserve server tables/contracts/ledger/receipts. Never re-enable the old local bank or delete financial records. Pause the cron job only for a diagnosed settlement issue, with a plan for grace deadlines and reconciliation. Production user-facing Google authentication was verified by the user before this phase; live bank trades across two real users remain a separate acceptance check.
