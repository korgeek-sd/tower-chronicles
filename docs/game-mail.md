# Game mail

Online accounts use the top-bar envelope to open mail. Trading settles immediately. Existing legacy storage remains claimable from the marketplace.

## Delivery rules

- A fully filled buy/sell order creates one summary, using exactly `구매 완료` / `판매 완료`.
- Partial fills grant assets/proceeds immediately, without intermediate summary mail.
- At registration +30 days, remaining purchases refund their reserve and remaining sales become attachments. Titles are `구매 주문 만료` / `판매 주문 만료`.
- Manual cancellation uses `구매 주문 취소` / `판매 주문 취소`.
- Equivalent equipment instances may be sold together. Their original IDs are held in `market_orders.escrow_gear`; fills transfer only the sold instances, and returns attach only remaining instances.
- Mail expires 30 days after delivery. Expired mail is inaccessible immediately and is physically removed by maintenance, including unclaimed attachments.
- Claim requires an active gameplay lease and no active expedition. Manual deletion rejects unclaimed attachments; delete-read skips them.
- Current order-book fees are preserved (zero). The older individual-equipment listing retains its 5% sale fee and nonrefundable listing fee.

## Server operations

The existing Supabase `pg_cron` job `tc-market-mail-expiry` calls `private.maintain_game_mail()` every minute. Matching checks the timestamp even before maintenance, so a due order cannot execute. The expiry worker skips busy market mutation transactions and retries on its next run.

Privileged server tooling may send notices to existing saved accounts:

```sql
select public.send_game_notice('unique-release-key', '공지 제목', '공지 내용');
```

This RPC is denied to anonymous/authenticated clients and allowed only to `service_role`; never expose that key in frontend code. User mail and attachments are private, with no client table grants. Notices are delivered only to accounts that exist when sent. Referral reward delivery will be connected in the referral feature; no referral rewards are fabricated by this release.

## Validation

Run the rollback-only fixtures using privileged SQL tooling. They use synthetic users, never real player data:

- `supabase/tests/game_mail.sql`: stack partial sale, immediate payout, expiry, owner checks, one-time claims.
- `supabase/tests/game_mail_equipment.sql`: ten swords, five sold, remaining five returned with original IDs.
- `supabase/tests/game_mail_edges.sql`: cancellation/refund, stale leases, expedition guard, unclaimed expiry, expired orders excluded before cron.

Frontend copy is tested by `tests/mail.test.ts`. Full checks: `npm test`, `npm run build`.
