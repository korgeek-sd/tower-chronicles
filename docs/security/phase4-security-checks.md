# Security automation and browser policy

## Enforced checks

- `security-checks.yml` runs `npm audit --audit-level=moderate` against the complete lockfile, including development/build dependencies, and scans all fetched Git history using Gitleaks. Pull requests, weekly schedules and manual runs are covered. Pages calls the same workflow and its build requires successful security checks.
- Gitleaks is the official MIT-licensed CLI, version 8.30.1, verified against the release asset SHA-256. Findings are fully redacted. `.gitleaks.toml` allows only this project's exact browser-public Supabase publishable key, which caused two historical generic-key false positives. Secret/service-role keys remain prohibited.
- CodeQL analyzes JavaScript/TypeScript and Actions on PRs, main pushes and weekly schedules, using `security-extended`. This uploads alerts; it does not by itself fail deployment for every finding. Enforcing CodeQL alert thresholds requires repository ruleset/code-scanning protection configured by an administrator.
- Dependabot checks npm and GitHub Actions weekly. New security workflows use commit-pinned actions and minimum token permissions. Existing CI and balance workflows now explicitly request read-only repository access.
- `source-map-js` was upgraded from 1.2.1 to 1.2.2 for GHSA-68fv-2mgg-jv7q. `npm audit` reported zero vulnerabilities after the upgrade (2026-10-19).

## Browser policy

The production Vite build injects a CSP meta before resource tags. Scripts must be same-origin: no inline scripts, inline event handlers or eval. Connections are limited to same-origin plus the build's exact HTTPS Supabase origin and WSS counterpart. Other resource classes have narrow explicit sources. React's inline styling requires `style-src 'unsafe-inline'`. Referrer metadata uses `no-referrer`. Development HMR remains unaffected.

The offline standalone packaging authorizes the exact final inline module bytes by SHA-256 rather than permitting arbitrary inline scripts. Changing the script requires regenerating its hash.

GitHub Pages currently serves HSTS, but does not provide a repository-controlled custom response-header mechanism. Meta CSP cannot enforce `frame-ancestors`, Permissions-Policy, or X-Content-Type-Options. Full response-header control and framing protection would require a hosting/proxy change. Do not claim those headers are enabled by HTML meta tags.

No production `console.*` calls were found in `src/online`. An unused legacy test-bank module has console warnings and is not imported into the production bank. This review does not assert that provider-side access logs never contain URLs; auth code handling still clears callback parameters before exchange as implemented in phase 2.

## Bank operation review (2026-10-19)

Read-only production checks found 0 banks and 0 loans, one active settlement cron and zero failed settlement runs during the preceding hour. `authenticated` has no direct SELECT access to the private bank table, and `anon` cannot execute the bank state RPC. Phase 3's rollback transaction already verified two synthetic server identities, idempotent requests and balance conservation. Two signed-in real browser users and actual simultaneous-connection load testing remain unverified. No production test bank, user or currency was created for this phase.

## Validation

Run `npm test`, `npm run build`, `npm audit --audit-level=moderate`, and `bash scripts/security/scan-secrets.sh`. For offline output, run `node scripts/standalone.mjs` after the build and verify its CSP hashes. Check the deployed guest UI and console for blocked required resources after publishing. Changes to Supabase project origin must rebuild the CSP and the application together.
