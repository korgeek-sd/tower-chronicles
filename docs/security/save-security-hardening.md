# Save security hardening — 2026-10-20 (KST)

## Fixed
- Bootstrap now replaces client equipmentItems with the canonical common +0 starter-v2 iron sword and resets all seven equipmentLoadout slots.
- save_game_state rejects NULL and negative base revisions before any writes. Both initial and existing save checks use IS DISTINCT FROM.

## Validation
Executed supabase/tests/save_security_regression.sql against the live database, first with function replacements rolled back, then again after applying the migration.
Both runs passed: forged initial equipment blocked; NULL initial/existing, negative, stale and future revision requests rejected; normal first and subsequent saves succeeded; server currencies, equipment, revision history and RPC grants preserved.
Synthetic users, sessions, saves and assets were rolled back.

The migration changes function definitions only. Existing player inventories were not rewritten. Existing suspicious equipment has not been adjudicated or removed.
The updated-save equipmentLoadout selection remains client supplied; server ownership validation in downstream equipment snapshots was not changed by this patch.

## Remaining review
Operator API authorization and realtime subscription authorization remain pending.
Security advisors still report private RLS tables without policies (117 INFO), authenticated SECURITY DEFINER RPCs (143 WARN, requiring per-function authorization review), and disabled leaked-password protection (1 WARN). These findings are not all confirmed vulnerabilities.
