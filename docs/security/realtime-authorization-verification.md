# Realtime authorization verification — 2026-10-20 (KST)

## Result
No cross-account disclosure or unauthorized write was observed in the tested database authorization paths. Production policies were not changed.

## Verified live state
- supabase_realtime contains only public.game_chat_messages. Saves and private mail/wallet/asset tables are not included in that Postgres Changes publication.
- game_chat_messages and game_saves have RLS enabled. Chat INSERT grants are limited to body, client_id and association_id; sender identity, nickname and timestamp are server generated.
- Chat clients accept only confirmed Postgres INSERT events and ignore arbitrary broadcasts.
- Personal session notifications use private game-session:<user ID> channels, with ownership-based SELECT authorization. Shared market and resource_stronghold notifications require the authenticated role.
- Inspected broadcast producers use private=true and send change identifiers; no save payload, mail body or wallet balance was found in the inspected shared notification payloads.
- No INSERT/UPDATE/ALL policies exist on realtime.messages for client broadcast publishing.

## Executed regression
supabase/tests/realtime_authorization_regression.sql ran against the live database and passed:
- Unfiltered chat SELECT is restricted to world chat plus the current user's own active association.
- Other association reads/writes are denied.
- Unregistered and anonymous-sign-in users cannot read chat.
- Membership removal and association disbanding revoke chat access on the next DB authorization check.
- Current saves are readable only by their owners.
- Own session, market and resource topics are authorized; another user's session and unknown topics are denied.
- Presence is not authorized by the broadcast-only policies.
- Client attempts to forge a personal session broadcast are denied.
- anon cannot read private broadcasts or chat.
- All synthetic accounts, associations, saves, chat and broadcast records were rolled back.

## Scope limits
These were role/JWT-context/RLS tests within a database transaction, not actual WebSocket joins or end-to-end message delivery tests. Broadcast authorization was tested with the requested topic setting and topic-filtered authorization probes. It is not a general per-row direct SQL access guarantee across all topics.
A still-open channel's cached authorization after sign-out/token changes and wire-level delivery after membership revocation remain unverified.
This review does not claim the entire service is vulnerability-free.

## Configuration drift to follow up
The association and occupation clients request private broadcast topics for which no matching SELECT policy was present in the inspected database. This suggests availability problems, not an unauthorized data disclosure; this patch does not widen access.
The legacy cloudSync helper still requests game_saves Postgres Changes, although game_saves was intentionally removed from that publication. Its current call sites and fallback behavior were not reviewed here.

## References
https://supabase.com/docs/guides/realtime/authorization
https://supabase.com/docs/guides/realtime/postgres-changes
