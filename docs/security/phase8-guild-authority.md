# Phase 8: guild authority and shared economy

Reviewed on 2026-10-19 against main `a69cbc2` and current production function definitions, owners and grants. Scope: association administration, treasury/donations, contribution bids, equipment/material escrow and claims. No ordinary-member treasury escalation or cross-guild claim bypass was reproduced.

## Confirmed defects and changes

`register_guild_material_auction` declared a local `listing_id` and used `RETURNING listing_id INTO listing_id`. PostgreSQL rejected valid material auction registrations with SQLSTATE `42702` (ambiguous column). Reproduced in PGlite and against production using synthetic rows in a rollback transaction. The failed statement rolled back stock subtraction; this was a registration availability defect, not a demonstrated duplication exploit.

The migration renames the local to `v_listing_id`, including its ledger reference. Material registration and direct material transfers also explicitly reject null material/direction inputs with `GUILD_MATERIAL_INPUT_INVALID`; previously these reached later stock/constraint errors. Existing constraints already prevented these null requests from committing a reward. This is early validation hardening, not a claim that null inputs minted assets.

`20261019144158_guild_material_request_hardening.sql` patches only those installed function definitions with exact baseline checks, preserving the existing active session, expedition, verified-leader, guild ownership, escrow, request receipt and transaction rules. Function owners/grants were identical before/after: postgres owner; postgres, service_role and authenticated EXECUTE; no anon/PUBLIC execute. No schema, privilege, tax rate, reward amount, balance tuning or client bundle changes.

The file was generated using `DO_NOT_TRACK=1 npx --no-install supabase migration new guild_material_request_hardening` and renamed from the CLI timestamp to the actual version recorded by production `apply_migration` (`20261019144158`).

## Authority and transaction evidence

- Production source review: administrator membership actions constrain targets/applications to the caller's guild. Treasury transfer requires both a LEADER membership and matching active guild leader ID. Donation, bid and treasury receipts bind original inputs and reject conflicts.
- `supabase/tests/guild_security_live.sql` passed against actual production RPCs. Three synthetic identities in two synthetic guilds exercised member treasury denial; one-time donation and conflicting receipt rejection; one-time material auction registration; foreign-guild bid/claim/return rejection; one-time contribution escrow and material winner claim; one-time treasury withdrawal and unchanged foreign treasury/stock; actual leadership transfer followed by former-leader withdrawal denial.
- Integration uses privileged SQL with synthetic JWT claims and real session/lease rows. It does not impersonate the authenticated database role; ACLs are checked separately. No real accounts, global maintenance, territory changes or real auction matching are used. All fixture mutations are inside `BEGIN`/`ROLLBACK`. A follow-up query found zero retained `guild-security` sessions.
- The live fixture initially moved only an auction's end time before its start, correctly failing the existing duration constraint. It now moves both timestamps for the synthetic ended listing; no product constraint was relaxed.
- `tests/guildMaterialSecuritySql.test.ts` adds five PGlite cases using actual material migration functions and constraints, with isolated dependency stubs: owner/role checks and foreign returns; null enums; injected ledger failure rollback/retry; deposit/withdraw conservation and receipt conflicts; preserved RPC/direct-table ACLs. The first valid-registration regression failed with `42702` before the patch and passed after it. Local auth helpers are stubs, not a production authentication proof.
- Thirteen focused material, treasury, donation and auction tests passed. Full-suite/build/security status is recorded in the PR checks.
- Security advisor groups stayed unchanged at 117 private RLS/no-policy INFO, 143 authenticated SECURITY DEFINER WARN, and one leaked-password-protection WARN. Existing findings were not resolved or suppressed by this change. References: [RLS policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Real-account/browser and actual simultaneous-load tests remain deferred. Sequential synthetic checks do not prove behavior under all concurrent interleavings. Server RPC changes are live; no frontend redeployment is required.
