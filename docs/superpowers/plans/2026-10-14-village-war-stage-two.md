# Village War Stage Two Implementation Plan

> Execute natively with superpowers:executing-plans; final independent review only.

**Goal:** Complete authoritative automatic PvP, time-integrated scoring, settlement and defense rewards.
**Spec:** `docs/superpowers/specs/2026-10-14-five-front-village-war.md` (already approved).
**Architecture:** Private immutable occupation intervals permit concurrent front transactions with shared event locks. A settlement transaction exclusively locks an event and computes the earliest 9,000 occupied seconds (150 points) from interval endpoints. RPCs reuse authoritative skill specs and damage math; no hunting resources are changed.

## Constraints
60-minute Saturday 22:00 KST war; five fronts; 30-second individual cooldown; one ticket per valid attack; 100 rounds; persistent defender HP/MP; full new defender HP/MP; 50% server-only reward; same UUID replays unchanged result; no queue; actual player presets, six active slots and three passive slots; no PvE food.

## Tasks
1. RED→GREEN DB tests for score integration, precise early cutoff, ties, end caps and idempotent settlement. Add private interval/record tables, settlement and safe lookup wrappers.
2. RED→GREEN real catalog PvP tests for rotation, MP, enhancement, all skill families, persistent damage, replacement, replay, reward once and rollback. Add symmetric player action engine and atomic occupied-front attack RPC.
3. RED→GREEN rendering/pending tests. Connect attack, scores, winner, HP/MP, sanitized battle result and recent records while preserving account-scoped recovery.
4. Real PostgreSQL multi-connection tests for same-front attacks, different-front requests, settlement versus attack and wallet conflicts. Run complete suite/build, review, apply migration disabled, verify live permissions, enable only after release criteria pass, commit/push and confirm Pages deployment.

## Review focus
- Late first read must reconstruct earliest threshold, not award points past it.
- Current defender damage changes revision, never epoch; stale replacement rejects without debit.
- Membership changes and same-guild attacks cannot mint rewards.
- Event shared locks must permit independent fronts; settlement exclusive lock rejects immediately while attacks run.
- Finished events release actor eligibility, including early settlement across towns.

## Ledger
Base: 5f6c3bf. Existing dirty checkout preserved; work occurs in the clean resumed worktree.
Ruling: Pre-approved second-stage rules and direct implementation request authorize native execution without repeating design approvals.

Tasks 1–3: complete. Real PostgreSQL multi-connection checks: 6/6. Full suite: 1234/1234; build and diff check pass. Independent review findings fixed with regression tests; final evidence and release limitation are recorded in docs/validation/2026-10-14-village-war-stage-two.md.
Ruling: Same step function executes attacker first, then defender, per round. DOT starts the following round. This fills unspecified initiative consistently; cost if changed later is a PvP balance change.
Ruling: Mobile screenshots are unavailable in this environment; rendering and action-condition checks are the verified UI evidence. This does not imply mobile visual verification.

Task 4: complete — production schema and interval-boundary correction applied; private privileges verified; cron execution succeeded; frontend CI and Pages deployment passed; feature activation verified separately. Final full suite 1234/1234, focused 16/16, PostgreSQL parallel 6/6.
