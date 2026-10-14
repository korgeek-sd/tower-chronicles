# Village war stage two validation

Implementation extends approved five-front rules. Authoritative server PvP reads the same 80-skill specification and damage function as hunting. Each actor uses the complete ordered preset (six actives, three passives); legacy skills retain their behavior. Attacker HP/MP refresh, defender HP/MP persist, replacements refresh, 100-round exhaustion defends. No hunting resources or PvE food are consumed. Ownership intervals integrate exact seconds; a linear sweep reconstructs the first 9,000 occupied seconds, including delayed reads and ownership rate changes. Scheduled and read-triggered settlement preserve ties and cap scoring at the actual cutoff.

## Evidence

- Full suite: `npm test` — **1234/1234 passed**, no failures.
- Production build: `npm run build` — passed; existing bundle-size advisory remains.
- Real PostgreSQL **17.6** with separate connections: six scenarios passed: occupied-front lock, independent fronts simultaneously held, settlement against an in-flight attack, attack against exclusive settlement, same UUID replay, wallet contention and rollback.
- Dedicated stage-two tests cover real skill rotation, all 80 authored definitions, MP/weapon/enhancement, HP carryover, replacement epochs, reward exactly once, precise cutoff, historical rate change, offline settlement, cross-town defender release, private execution permissions, recovery, names and rendered UI.
- Independent reviewer identified mixed presets dropping legacy skills, cross-town eligibility after early victory, and transient replay conflicts losing pending UUIDs. Each has a reproducer and passed after correction.
- DOT application-round and legacy guard regressions were corrected and passed.
- Initial full run hit a Node 24 native WebAssembly JIT disposal crash. Reusing one isolated PGlite instance and closing it after the suite removed that runtime issue; final full run passed.
- Migration applied to `tower-chronicles`; private helpers deny both anon and authenticated execution, and only authenticated session-validated public RPCs are exposed. Cron has one active `village-war-settlement` job. RLS without direct policies and SECURITY DEFINER RPC advisor notices reflect intentional RPC-only access, with privileges verified separately.

## Decisions and limits

- Pre-approved rules and direct implementation instruction authorize native execution; no repeated design approval.
- Attacker acts first each round; both actors use the same action function. DOT starts the following round. Combat temporary effects reset between attacks; defender HP/MP alone persist as specified.
- Private occupation intervals avoid a contested event score row, allowing different fronts concurrently under shared event locks. Final settlement requires an exclusive NOWAIT event lock.
- Scratch-only uid-reporting shim was needed for local PostgreSQL because the environment maps only uid 0. It alters no kernel permissions, binds only loopback, disables Unix sockets, and is not shipped.
- Mobile browser screenshots were **not** completed: the cloud browser cannot reach the local QA server, and its URL policy rejects data pages. Rendered UI/action-condition tests passed. Do not describe this as visual mobile verification.
- Production combat was not artificially started and no real player tickets were consumed during validation. The first scheduled war provides the live gameplay check.

Release: commit/push frontend, confirm Pages success, then enable the feature and verify the setting and cron. The old three-front occupation implementation is unchanged.

Release verification: UI commit e6ed137 passed GitHub CI and Pages build/deploy. The follow-up interval-boundary migration uses one authoritative handover timestamp for both interval edges; its reproducer failed before the fix and passed afterward. Final focused tests: 16/16; final full suite: 1234/1234; PostgreSQL parallel scenarios: 6/6; build passed. Both production migrations and the active cron job were verified before feature activation.
