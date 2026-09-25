# Tower Chronicles v0.1.48 Online Foundation setup

## 1. Apply the database migration

Open Supabase Dashboard → SQL Editor and run:

`supabase/migrations/20260925_online_foundation.sql`

This creates:
- `game_saves`: one current cloud save per Supabase user
- `game_save_versions`: previous revisions
- `save_game_state(...)`: atomic revision-checked save RPC

The client can SELECT only its own current save through RLS. Direct INSERT/UPDATE/DELETE are not granted to authenticated clients; writes go through the RPC.

## 2. Configure Google login in Supabase

Supabase Dashboard → Authentication → Providers → Google:
- Enable Google.
- Copy the callback URL shown by Supabase.

In Google Auth Platform create a Web OAuth client:
- Add the web game's origin to Authorized JavaScript origins.
- Add the Supabase callback URL to Authorized redirect URIs.
- Put the Google Client ID and Client Secret into the Supabase Google provider page.

Do not commit the Google Client Secret.

## 3. Configure Supabase redirect URLs

Supabase Dashboard → Authentication → URL Configuration:
- Add the local Vite URL used for development.
- Add the deployed website URL.
- Later, add the Capacitor deep link callback when the native app login flow is enabled.

## 4. Configure browser-safe environment values

Copy `.env.example` to `.env.local` and fill only:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

These two values are intended for browser use. Never put a `service_role` key or Google Client Secret in a Vite `VITE_*` variable.

## 5. First cloud-save flow

1. Guest/local player opens 저장 관리.
2. Google로 계속하기.
3. OAuth returns to the game and the session is stored.
4. If the account has no cloud save, “이 기기 → 클라우드” creates revision 1.
5. Another device signs into the same Google account and uses “클라우드 → 이 기기”.
6. A save upload is accepted only when the caller's base revision still matches the server revision.

If a different device has already advanced the revision, the client stops instead of overwriting it.
