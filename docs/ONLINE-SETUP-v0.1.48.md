# Tower Chronicles v0.1.48 Online Foundation setup

## 1. Database and Realtime

The project uses:
- `game_saves`: one current cloud save per Supabase user
- `game_save_versions`: previous revisions
- `save_game_state(...)`: atomic revision-checked save RPC
- Supabase Realtime Postgres Changes on `public.game_saves`

Migrations:
- `supabase/migrations/20260925_online_foundation.sql`
- `supabase/migrations/20260925153339_enable_game_save_realtime.sql`

The client can SELECT only its own current save through RLS. Direct INSERT/UPDATE/DELETE are not granted to authenticated clients; writes go through the RPC.

## 2. Configure Google login in Supabase

Supabase Dashboard → Authentication → Providers → Google:
- Enable Google.
- Keep the Supabase callback URL registered in Google Auth Platform.

In Google Auth Platform create a Web OAuth client:
- Add the web game's origin to Authorized JavaScript origins.
- Add the Supabase callback URL to Authorized redirect URIs.
- Put the Google Client ID and Client Secret into the Supabase Google provider page.

Do not commit the Google Client Secret.

## 3. Configure Supabase redirect URLs

Supabase Dashboard → Authentication → URL Configuration:
- Site URL: the deployed game URL.
- Add the deployed game URL to Redirect URLs.
- Add the local Vite URL for development.
- Later, add the Capacitor deep link callback when the native app login flow is enabled.

## 4. Configure browser-safe environment values

Copy `.env.example` to `.env.local` and fill only:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

These two values are intended for browser use. Never put a `service_role` key or Google Client Secret in a Vite `VITE_*` variable.

## 5. Automatic cloud-sync flow

There are no manual “device → cloud” or “cloud → device” controls.

1. The player signs in with Google.
2. If the account already has a cloud save, the latest revision is automatically loaded on that device.
3. If the account has no cloud save, the current local save is automatically created as revision 1.
4. Local game-state changes continue to save to localStorage immediately and are pushed to Supabase automatically after a short debounce.
5. Supabase Realtime watches the signed-in user's `game_saves` row. A revision written by another device triggers an immediate reconciliation.
6. Revision checks prevent stale clients from blindly overwriting a newer server save.
7. If two devices actively change the same account at the same time, the device that observes a newer server revision pulls that authoritative revision instead of creating a fork.

JSON export/import remains as an emergency/manual backup feature. When signed in, an imported valid save is automatically synchronized to the Google account.
