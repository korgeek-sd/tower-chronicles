# Realtime authorization verification — 2026-10-20 (KST)

## Applied follow-up
Migration 20261020014529_realtime_shared_topic_authorization adds SELECT-only policies for the private association and occupation change-notification topics.
Only authenticated users with a nonempty subject and without is_anonymous=true qualify. The payloads are shared change identifiers, not private association chat content.
Client broadcast publishing remains denied. Existing personal-session policies were not widened.

## Actual WebSocket checks
Using two dedicated disposable accounts and genuine Auth-issued access tokens:
- Own game-session channel: join succeeded.
- Other account's game-session channel: join rejected as unauthorized.
- association and occupation private topics: both joins failed before the migration and succeeded after it.
- An unfiltered Postgres Changes subscription received an association message while the second account was a member.
- That account acquired a normal gameplay lease, created its own save and left through leave_online_association.
- Without reconnecting the same WebSocket, the next association message was not delivered during the 8-second observation window. The first successful message confirmed that the subscription worked before revocation.
These results support live topic isolation and association membership revocation, within this finite observation window.

## Database regression
supabase/tests/realtime_authorization_regression.sql includes the two restored shared topics.
The updated suite passed with the proposed policies inside a rollback-only preflight transaction.
It covers cross-account save visibility, unfiltered world/association chat visibility, outsider writes, unregistered/anonymous chat, membership removal, disbanding, private topics, presence rejection and client broadcast forgery rejection.
Post-apply catalog verification found both new SELECT policies and zero INSERT/UPDATE/ALL policies on realtime.messages. Live joins then confirmed the applied result.
Later attempts to rerun the complete SQL suite encountered connector request-state errors; they are not counted as additional successful runs.

## Live fixture cleanup
The WebSocket checks required committed synthetic fixtures, not rollback-only fixtures.
Deleted the test association, both test users (including cascading sessions, identities, saves and chat), and their test broadcast notices.
A follow-up query confirmed zero remaining test users, associations and chat rows. Local temporary credentials were removed.
Existing player accounts/inventories were not modified.

## Reproduction
SQL: supabase/tests/realtime_authorization_regression.sql
Wire-level chat: scripts/security/realtime-live-chat.py CONFIG_JSON
The Python script requires websockets and a private JSON config with url, key, associationId and two users with email/password.
Provision dedicated disposable accounts beforehand: both have profiles; users[0] leads the test association and users[1] is its member with no save yet.
The script creates a save and leaves that association as users[1]. The provisioning caller must remove fixtures afterwards.
Never commit the config or credentials.

## Remaining limits
This does not establish immediate invalidation of already-connected private broadcasts after server-side sign-out/session revocation. Realtime caches broadcast authorization, and an issued JWT may remain valid until expiry.
Full reconnect/expiry behavior and large-scale rate/resource abuse are still outside this completed check.
The legacy cloudSync helper requests game_saves Postgres Changes although that table was intentionally removed from the publication; its current usage remains a separate availability review.
No whole-service security guarantee is implied.

## References
https://supabase.com/docs/guides/realtime/authorization
https://supabase.com/docs/guides/realtime/postgres-changes
