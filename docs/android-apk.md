# 탑의 기록 Android APK

The existing React / Vite game remains the source of truth. Capacitor packages the built `dist/` into an Android WebView; Supabase and server-side combat/save remain remote.

## Package identity
- App name: 탑의 기록
- Android applicationId: `com.studio1524.towerchronicles` (fix before Play release)
- OAuth callback: `towerchronicles://auth/callback`
- Display orientation: portrait
- Native source directory: `android/` is generated locally or in CI and deliberately gitignored.

Capacitor Android runtime and CLI are pinned to patched version `8.6.0`; the native App and Browser plugins are major-version compatible. Keep these dependencies audited before publishing builds.

## Automatic debug APK
On pushes to the Android integration branch or `main`, the GitHub Actions workflow **Build Android APK** installs dependencies, tests, builds the web game, regenerates the Android project, and publishes `tower-chronicles-android-debug-apk` as a downloadable Actions artifact. Unzip the artifact and install `app-debug.apk` on an Android phone.

For first setup, the integration branch workflow commits the newly resolved `package-lock.json`. Later pushes use the committed lock. A successful CI run is required before release.

## Local development
Prerequisites: Node.js 22+, JDK 21, Android SDK/Android Studio.
```sh
npm ci
npm run build
npm run android:add         # once per fresh clone
npm run android:sync        # build, sync, manifest patch
cd android
./gradlew assembleDebug
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

## OAuth: important console setup
1. In Supabase > Authentication > URL Configuration > Redirect URLs, allow the **exact** callback `towerchronicles://auth/callback`. Do not use a wildcard.
2. Keep Google provider enabled in Supabase and its OAuth redirect to the Supabase Auth callback.
3. The app invokes external Chrome Custom Tabs, not Google OAuth in the embedded WebView. The Android intent filter returns the PKCE authorization code to the app. Transactions use localStorage only on native; the original browser uses sessionStorage.
4. Test on an actual Android device after the redirect allowlist is configured. Without it, Google login will fail even if APK packaging succeeds.

## Production
The workflow produces a debug-only APK, not a Play Store release. For Google Play, establish app signing, reproducible signed release AAB, Play Billing for digital products, store listing, policy and account setup. Do not ship the debug APK to users as a production release.

To change the app ID or OAuth callback, update `capacitor.config.ts`, `src/online/auth.ts`, `scripts/configure-android.mjs`, and Supabase redirect URLs together.

## Android OAuth callback fix (2026-11-06)
The previous Android build appended `?tc_auth_state=<random>` to `towerchronicles://auth/callback` while the Supabase allowlist contained only the exact address. The unmatched address could fall back to the web Site URL in Chrome. Android now requests the exact registered deep link, retaining a random single-use PKCE verifier in native localStorage and checking the scheme, host, path, freshness, and account identity on return. Browser logins continue using the existing query state. Install the freshly built APK, not an earlier artifact; debug APK signatures may differ between GitHub-hosted runner builds, so an uninstall/reinstall might be necessary after cloud data has been verified.

## Full-height Android game viewport (2026-11-06)
The native `MainActivity` generated during `android:sync` hides only `WindowInsetsCompat.Type.statusBars()` (clock, battery, connectivity) on creation and when returning to the game from an external Chrome login. The bottom Android system navigation bar remains available. Edge swipes can temporarily reveal hidden Android system bars. Browser deployment is unchanged; the generated Android source remains gitignored and is reproducibly configured by `scripts/configure-android.mjs`.
