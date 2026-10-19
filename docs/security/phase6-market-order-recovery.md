# Phase 6: shop, crafting, enhancement and market orders

Reviewed against deployed RPC definitions on 2026-10-19.

## Audit results

- Association shop purchases use the server catalog's contribution cost/reward/limits, serialize through the active-session guard, and bind purchase receipts to user, request UUID and item ID.
- Village crafting validates recipe, location, materials and action points on the server. Material consumption, mastery/yield updates and the receipt commit together; mismatched receipt parameters reject replays.
- Catalog skill enhancement uses server grade costs and expected stage, consumes books/gold atomically, and returns the current state without another charge for an already-completed stage.
- Equipment enhancement is intentionally disabled by `ENHANCEMENT_REMOVED`; this update does not re-enable it. Dismantling consumes the owned equipment instance before awarding server-calculated split stones.
- Exchange prices are user-selected limit prices, not catalog prices: the server validates bounds, reserves actual funds/assets, matches against stored orders, and computes settlement/fees. Existing equipment listing purchases consume a single OPEN listing.

The active unified order API lacked an intent UUID. A lost response followed by another submission could create a second valid order and another escrow debit. This is a retry/intent ambiguity, not a way to mint currency.

## Changes

`place_online_market_order_v2` adds authenticated, per-user request receipts and a canonical input fingerprint. It uses the existing global market lock before the active-session guard, then either returns the latest market state for the same receipt or invokes the existing core transaction and records its receipt atomically. Changed input under the same UUID rejects. Replaying a cancelled order never places a replacement order. Bounds and null side values are checked explicitly.

The private receipt table has RLS and no PUBLIC/anon/authenticated table access. The RPC revokes PUBLIC and anon execution and grants authenticated/service-role execution. The original matching and accounting routine remains unchanged for compatibility. Direct legacy RPC submissions without request IDs are separate intents and do not gain v2 retry guarantees; the current application uses v2.

The client persists one pending intent per account in session storage before dispatch. Network failures, invalid success bodies, authentication/lease failures and uncertain HTTP responses keep the exact ID. Only known transactional business rejections clear it. A replay with a refreshed lease still uses the original intent, and concurrent clicks share one request. Another account cannot consume its pending intent or receive its response.

The screen shows an explicit recovery button with the original item, side, quantity and price. It blocks new order submissions while one is unresolved. Demo mode keeps recovery disabled until the player explicitly switches to live trading. There is no automatic financial recovery on page load. Session storage survives reload in the same tab, not intentional storage deletion or tab/session destruction.

## Validation

- 85 focused market, crafting and skill-enhancement regressions passed, including 7 new request/API/UI cases. The new server wrapper unit test uses a transactional core stub to inject a failure after debit and prove escrow/order/receipt rollback together.
- A rolled-back production transaction with one disposable synthetic identity exercised the actual matching/cancellation core: BUY and SELL requests replay once, changed input rejects, and replaying either cancelled order does not submit another. It also verifies no second save revision on a direct replay. No test user, order, receipt or currency is retained.
- SELL-cancellation verification compares the legitimate post-cancellation state with replayed state, respecting the existing return/storage behavior.
- New private-table/no-policy and authenticated security-definer advisor findings are expected for this guarded design; existing findings are not dismissed or disabled.
- The CLI-generated migration filename was aligned with the production API's recorded version: `20261019130426`.

Two real-account browser/bank and simultaneous multi-connection tests remain deferred. This review covers the named routes, not every economy endpoint.
