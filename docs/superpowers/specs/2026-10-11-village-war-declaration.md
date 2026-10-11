# Village declaration from the 11-town travel board

Release scope: the existing `마을 이동` screen retains central city `노바르` plus ten specialty town cards, and adds a server-authoritative declaration control in the selected town detail panel. **This release does not replace the legacy occupation battle engine with five-front PvP**; it establishes declarations as the prerequisite record for that future integration.

## Rules deployed

- Current week comes from the shared server `private.occupation_window(clock_timestamp())` schedule (Monday KST start; registration closes Friday 22:00 KST).
- The `LEADER` of an active online association may declare for any of the eleven town IDs once per town per week.
- Each successful declaration atomically subtracts 100 `challenge_ticket` products from that leader's private village-life inventory. No Silver/Gold/other ticket currency is accepted.
- Any number of different associations may declare for the same town; a single association may declare for multiple towns by paying each town's cost.
- Current clan membership/role, village identifier, registration window, duplicate registration, and ticket balance are always validated inside SQL.
- Every mutation carries a UUID persisted in localStorage until a confirmed response or a recognized business-rule rejection. Duplicate retries return the original receipt without charging again. Conflicting reuse of one request UUID fails.
- The selection panel shows declaration count and live ticket count, confirms cost and no-refund policy, and preserves the travel/gather action. On non-registration days, a leader sees a disabled button and an explanatory message. Members see a leader-only message.
- A SQL private registry and private receipts store the records, protected by RLS with no direct client table grants. Exposed callable RPCs require an active verified game lease.
- Server changes deployed via Supabase migration `village_war_declarations`; code tracked in `supabase/migrations/20261011220000_village_war_declarations.sql`.

## Important limits

- Current map ownership/tax labels are **preview fixtures**, not authoritative captured-village data; this release does not implement owner skipping based on these labels.
- A registered declaration currently records access eligibility for the **future** village battle feature; the old 3-front tower occupation war continues separately and does not check these declaration records yet.
- Real-world user end-to-end UI test with a logged-in leader and >=100 tickets is needed when the next declaration period opens. Tests cover the display, negative permissions, SQL atomic consumption and replay.
- UI source changes trigger the repository's GitHub Pages deployment workflow on a push to `main`; workflow result must be checked separately.
