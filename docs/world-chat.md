# World chat V1

All registered players with a nickname can read the world channel. The UI connects while the game session is active; guests see a login hint. A floating chat button opens a mobile sheet, shows unread messages, and preserves a draft while playing. The history is limited to the newest 50 messages, stored for seven days with hourly cleanup.

`game_chat_messages` is immutable to clients. INSERT grants only `body` and `client_id`; the private trigger derives `user_id`, nickname and timestamp from the authenticated identity and profile. Anonymous sign-ins are denied. A profile-row lock serializes the two-second per-account cooldown across devices. Messages contain 1–200 Unicode code points, with NFC normalization and control/invisible characters rejected. React renders message text without HTML parsing.

A client-generated UUID makes a failed/uncertain send retry idempotent. A duplicate insertion returns the existing record. The UI keeps the UUID with the failed draft. History, realtime and POST responses merge by server message ID.

Realtime uses the existing project's Phoenix 2.0 WebSocket pattern with Postgres INSERT changes under table RLS. Client broadcast payloads are ignored. Each connection waits for the database subscription's system acknowledgement, sends heartbeats, refreshes its auth token, reconnects with capped backoff and reloads history on subscription/visibility recovery. Opening the sheet does not create a second connection. Logout/unmount closes it. Existing monitoring includes socket_kind `chat`.

Tests: `tests/chat.test.ts` and transactional `supabase/tests/world_chat.sql`. No test messages remain in production. Guild/party/DM channels, reporting, blocking, moderator tools and a profanity dictionary are future features.

Design references: BjornMelin/dev-skills `supabase-ts`; dreamteam-hq/brigid `gamedev-mmo-persistence` Chat Architecture; Supabase official Postgres Changes and Realtime Protocol docs. Adapted to this Vite app and the existing Postgres service; no Redis or alternative backend introduced.
