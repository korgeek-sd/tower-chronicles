# Security phase 2: PKCE authentication and bounded presence records

## Authentication

Google sign-in now stores a 10-minute, one-use PKCE transaction in sessionStorage. A random 32-byte verifier is exchanged using SHA-256 (`s256`, as required by Supabase Auth). A separate random request identifier is appended to redirect_to as `tc_auth_state`; callback state, origin/path and expiry must match the stored transaction. This does not override Supabase's provider-side state parameter.

Implicit access/refresh token fragments are rejected. Callback credentials are removed from browser history before network requests. App initialization waits for callback completion so game-session acquisition/cloud sync cannot race the login exchange. Identity is read from the authenticated `/auth/v1/user` response, not merely decoded JWT claims.

Existing `tower-auth-v1` sessions remain compatible. Same-tab concurrent refreshes share one request, transient failures do not erase sessions, and account-change/logout checks prevent stale refresh responses from restoring an account. Cross-tab refresh coordination remains outside this change. Access and refresh tokens remain in localStorage; this is not an HttpOnly-cookie migration.

Before production release, validate on a test Supabase project: Google sign-in from settings and save management, cancellation, expired callback, page reload, token refresh and logout. Confirm that the exact deployed origin/path is allowed in Supabase Auth redirect settings, including the returned `tc_auth_state` query parameter. No real Google-provider login was performed by the automated tests.

## Presence migration

Apply `supabase/migrations/20261019110000_presence_limits.sql` using the authorized database migration workflow. GitHub Pages deployment does not apply SQL migrations. Do not mark these server limits active until the migration has been applied and the deployed RPC definition has been verified.

The public RPC signature remains compatible with current clients:

- Client IDs: 16–80 ASCII letters/digits/underscore/hyphen; current randomUUID IDs are accepted.
- Maximum successful RPC calls: 60 per account per fixed one-minute window, including disconnects and renewals.
- Maximum unexpired presence rows: 6 per auth session, 12 per account. Normal active gameplay uses up to 3 socket kinds. Existing renewals are allowed at the row cap.
- A private per-account row lock serializes registration and counter updates across sessions. Counter rows are bounded to one per auth user and cascade on user deletion.
- Market/chat registrations must match the active gameplay session and client with an unexpired lease. Session-signal registrations also support tabs waiting to acquire or take over gameplay.
- Disconnect only removes the caller's own session/client/kind. Expired rows for that account are removed during requests; the existing monitoring collector also clears expired rows globally.

Limits bound database presence records, not the number of physical Realtime sockets or all HTTP request traffic. Failed invalid/auth/over-limit requests are rejected and their transaction changes roll back. Edge/API rate limiting is a separate layer.

## Validation and rollback

Automated tests use mocked Auth API responses and an isolated PGlite database. They cover verifier/challenge binding, request state, expiry, duplicate/replayed callbacks, implicit-fragment rejection, server-user verification, account changes, single-flight refresh, SQL auth/input validation, caps, rate reset, renewal at cap, expiry cleanup, disconnect isolation and permissions. A row lock is used in SQL; actual concurrent PostgreSQL load testing was not performed.

The migration does not rewrite saves, wallets or bank data. If presence caps unexpectedly affect normal clients, adjust thresholds in a follow-up migration after observing the use pattern; do not reopen unrestricted inserts. Restoring the previous presence function would restore the reported abuse path. PKCE failure should show a retryable login error; do not re-enable implicit fragment acceptance as a fallback.

## Protocol references

- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://github.com/supabase/auth/blob/master/openapi.yaml (`/authorize` and `/token?grant_type=pkce`)
