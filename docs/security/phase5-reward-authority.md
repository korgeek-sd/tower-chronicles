# Phase 5: reward authority and request validation

Audited against the deployed database functions on 2026-10-19.

## Existing protections confirmed

- `hunt_once` accepts a map and request UUID, calculates combat and rewards on the server, serializes through account save/wallet/hunting row locks, and stores `(user_id, request_id)` receipts. Reusing a receipt with a different map rejects the request; a valid replay returns its recorded result without another award.
- Expedition basic attacks ignore the legacy client attack argument. Current actions use `combat_v2_require_action`, which rejects a null or incorrect nonce. Kill credit uses a unique kill receipt and only an inserted kill creates server-calculated loot.
- Expedition return settlement reads `temporary_loot` and remaining consumables from server rows, checks server-authorized return/death state, and marks the run settled in the same transaction as inventory and wallet updates. Client payload rewards are not used. Already-settled runs return the current cloud record.
- The inspected legacy `begin_online_combat_state` entry point is not executable by authenticated clients. These findings concern the inspected routes; they are not an assertion that every game RPC has been audited.

## Fixed

`require_active_game_session` and the inline `save_game_state` guard compared lease components with SQL `<>`. An authenticated session on the same account could supply null lease/device/client/generation arguments: SQL UNKNOWN is not TRUE, so some mismatches were skipped. This did not permit choosing another account, but weakened the active-device/play-lease boundary. Both guards now reject missing components explicitly and use `IS DISTINCT FROM` for every lease/session comparison.

`settle_online_expedition_v2` accepted null outcomes through SQL three-valued logic. A live run could reach later save projection code without entering either valid settlement branch. Outcomes are now validated immediately after authorization, before no-run/already-settled returns or run mutations.

The migration patches only the installed validation clauses and fails closed if its expected anchors are missing. Existing reward logic, advisory locks, ownership and ACLs are preserved. No frontend release or new RPC signature is required.

## Validation

- Three behavioral regression cases fail against the pre-fix production function snapshot and pass with the migration: every null lease component, cloud-save mutation prevention, and invalid settlement outcomes. The fixture snapshot contains source definitions, not player data.
- A production transaction with one disposable synthetic identity checks valid authorization, each null component at both guards, null settlement rejection, unchanged save revision, and revoked auth-session rejection. The entire transaction is rolled back; no test user, balance or run is retained.
- Existing two-account real-browser and simultaneous bank tests remain deferred at the user's request. This phase's automated regression checks do not replace those tests.

Migration source was created with the CLI, then aligned with the version actually recorded by the production migration API: `20261019124233`.
