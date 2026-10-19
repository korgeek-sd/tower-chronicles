# Operations authorization verification — 2026-10-20 (KST)

## Scope and result
Verified 20 live public RPCs: 16 ops_* endpoints, three coupon administration endpoints, and get_system_monitoring. The authority-helper caller inventory matched this scope. No deployed Edge Functions were listed.
No unauthorized access was observed in the tested database paths.

## Evidence
- All 20 endpoints reject the anon role at EXECUTE permission.
- All 20 reject authenticated ordinary users, user_metadata coupon_admin claims, app_metadata JWT claims absent corresponding server DB authority, and an authenticated role with no subject: 80 checks, plus 20 anon checks.
- Authorization uses auth.users.raw_app_meta_data, not editable raw_user_meta_data. Revoking server-side coupon_admin denies all 19 operations/coupon endpoints despite a stale privileged JWT claim.
- Monitoring requires a separate private.monitoring_admins membership; coupon administrator status alone is insufficient.
- Normal administrator reward grant produces one mail and one audit entry even when the same request is retried. Coupon creation/status changes each produce an audit entry.
- No anon/authenticated table grants were found for private.monitoring_admins, private.operations_audit, or private.game_coupons. The private authority helper is not executable by these roles.
- All synthetic accounts, coupons, mail, audit and permission changes were rolled back.

## Reproduction
Execute supabase/tests/operations_authorization_regression.sql as the privileged database test owner.
The test assumes the current set of 20 endpoints; it discovers calls from pg_proc and verifies their expected permission errors.
JWT claim contexts were set only inside the privileged test transaction. This is a database authorization test, not a JWT signature or HTTP gateway test.

## Limits and next step
This result does not establish that all administrative/session paths are secure. Expired or revoked auth-session handling, HTTP gateway behavior, and every positive operator filter combination were not tested.
No production permission/schema changes were needed for the tested paths.
Next: realtime subscription authorization, including cross-account private channels and Postgres Changes table policies.
