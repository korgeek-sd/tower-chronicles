# Phase 7: mail and reward claim audit

Reviewed on 2026-10-19 against main `62d0c9a` and the production Supabase RPC definitions and grants. No confirmed claim vulnerability was found. This phase adds regression coverage and records evidence; it makes no production function, schema, reward-value or frontend changes.

## Server behavior

- `get_game_mail` filters by `auth.uid()` and the expiry deadline. `manage_game_mail` requires the active gameplay lease, validates its action, checks mail ownership and expiry, and locks selected rows before testing `claimed_at`.
- Currency, stackable items and returned equipment are delivered before `claimed_at` is set, within the same PostgreSQL statement transaction. Canonical save persistence occurs in that transaction. Errors propagate without a partial-commit handler.
- Repeating an already successful claim returns current economy without another reward or save revision. An ambiguous HTTP response can therefore be checked by refreshing the mailbox and, if necessary, submitting the same mail ID again. The client does not automatically retry mutations.
- Single deletion rejects unclaimed attachments. Bulk deletion skips them. Claims are blocked during an expedition, and expired mail is unavailable before the maintenance worker deletes it.
- The production mail and guild-boss claim tables have RLS enabled and no authenticated direct CRUD grants. Anonymous execution of mail and guild-boss reward RPCs is denied. Reward delivery helpers, maintenance and notice sending are not executable by authenticated clients.
- `claim_guild_boss_reward` was reviewed in production source: the caller's active association, defeated encounter and positive personal damage determine eligibility; the per-user encounter receipt precedes rewards in the same transaction. The shared session/save locks serialize claims. This audit did not execute a synthetic guild-boss encounter.

## Added verification

`tests/mailClaimSecuritySql.test.ts` loads the existing mail/coupon implementations unchanged from migrations into PGlite, using the existing isolated dependency fixture. It runs `supabase/tests/mail_claim_security.sql` under the authenticated role and checks that rollback removes all fixture rows. Assertions cover foreign read/claim/delete, account-scoped listing, unclaimed deletion denial, expired mail, missing lease, single/bulk claim replays, save revision stability, equipment instance identity, expedition blocking, and full rollback when a later reward in a batch is invalid. PGlite dependency stubs are not evidence about production auth/session internals.

`supabase/tests/mail_claim_live_security.sql` separately ran against the actual production functions, with synthetic users and `request.jwt.claims`, inside `BEGIN`/`ROLLBACK`. It verified a failed mixed batch leaves the wallet, pre-existing bootstrap assets, claimed flags and save revision unchanged; foreign mail and null leases are rejected; retries grant exactly +50 silver, +7 gold and +3 stones once; and revoking the backing auth session blocks a replay. This privileged integration fixture does not impersonate the database role: ACLs were inspected separately. It does not call matching or global expiry maintenance. The successful response was `mail_claim_live_security: passed; rollback follows`; a follow-up query found zero retained synthetic sessions.

The first live assertion incorrectly assumed a bootstrapped player had no assets. The fixture was corrected to compare the actual before/after assets and starting stone quantity; no product change was needed.

Local verification: 1,336 tests passed; TypeScript and production Vite build passed. The build retains the existing large-chunk advisory. No migration or frontend release is required for this audit-only change.

Real-account/browser recovery and simultaneous-load testing remain deferred at the user's request. No claim is made that those manual tests were performed.
