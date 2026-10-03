# Combat Engine V2 Online Implementation Plan

> Execute with superpowers:executing-plans; the user has authorized continuing implementation and GitHub publication.

**Goal:** Apply the approved V2 rules to authoritative online combat and publish only after server/client parity tests pass.

**Architecture:** Preserve session leases, action nonces, locked run/combat rows and kill/reward settlement. Add private catalog-driven V2 resolvers using the same authored TypeScript effect, job and monster data. Existing public RPC signatures remain unchanged.

**Tech Stack:** PostgreSQL PL/pgSQL, PGlite execution tests, TypeScript, GitHub CI/Pages, Supabase migrations.

**Spec:** `docs/superpowers/specs/2026-10-03-combat-engine-design.md`

## Global Constraints
- Resource 0–4; basic generation once per successful action; exact actor cooldowns.
- Percentage defense, shields capped at 300%, DOT bypasses shields before HOT, duration-only production effects.
- Hit-by-hit death/reaction cancellation; revival discards interrupted action and resumes the correct turn.
- Expedition healing potion limit 5; no cleanse potion; preserve authority and reward idempotency.

## Review Focus
- Forged/duplicate nonce and wrong run/session must remain rejected.
- Kill/counter death must never produce additional hits or duplicate rewards.
- Full shields suppress attached effects but still qualify successful generator hits.
- DOT death must precede healing and correctly interrupt fleeing.
- Existing active saves/encounters and server response mapping must retain resource/cooldown/event state.

### Task 1: Shared catalogs and SQL resolution primitives
- [x] Generate deterministic SQL catalog from current TS definitions.
- [x] Write and run failing PGlite parity tests for damage, shields, effects, healing and controls.
- [x] Implement private helpers, normalize old runtime, verify executable SQL and catalog identity.

### Task 2: Authoritative actions and response parity
- [x] Write failing action tests for resource, cooldown, death/counters, revival and weighted/phase AI.
- [x] Replace action/hit/turn RPC internals while retaining locks, leases, nonce checks and reward settlement.
- [x] Map authoritative runtime/events/potion counts to the client; run focused then full tests.

### Task 3: Review and release
- [x] Independent whole-change review; fix findings with regression tests.
- [ ] Full suite/typecheck/build, stage and verify migration, review advisors.
- [ ] Publish branch and CI, integrate and deploy client/server together; verify actual release outcomes.

Validation before publication: 887 tests passed; typecheck/production build passed. Review regressions cover potion allowance across reused run rows, counter-death turn ownership and event revival reward idempotency. SQL tests execute the generated migration in PostgreSQL via PGlite. Live release checks remain pending.
