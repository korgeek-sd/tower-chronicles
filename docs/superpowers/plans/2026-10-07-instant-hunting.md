# Instant Hunting Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline.

**Goal:** Apply the approved instant battle screen to the playable game and commit it.
**Architecture:** Independent pure hunting model, result UI, authenticated RPC and private SQL state. Existing save/economy bridge applies payments.
**Tech Stack:** React 19, TypeScript, Vite, PostgreSQL.
**Spec:** docs/superpowers/specs/2026-10-07-instant-hunting.md

## Global Constraints
- 100 vitality, 300-second regeneration, cost 1 including loss.
- Server authority online; no jobs in hunting; preserve old accounts.

## Review Focus
- Rapid taps/retries cannot charge or pay twice.
- Full vitality cannot accumulate overflow.
- Account switch cannot show another player's receipt.
- Active expedition prevents hunting.
- Defeat and turn limit yield no rewards.

## Tasks
- [x] Test vitality and deterministic battle; implement src/game/hunting/model.ts.
- [x] Test rendered result and disabled controls; implement HuntingScreen and responsive CSS.
- [x] Test SQL with PGlite; implement atomic state/receipt/RPC migration and online client.
- [x] Wire main navigation, guest persistence, server record hydration and error recovery.
- [x] Run full tests/typecheck/build; review diff; apply verified migration.
- [ ] Commit to GitHub; check CI/Pages.

Validation: 972 tests passed, TypeScript check passed, production build passed. Live RPC privileges verified: authenticated only, fixed empty search_path. Migration applied successfully.

Review: independent review identified stale lease responses and save/wallet lock ordering. Both fixed with regression tests. Browser QA blocked by localhost connection refusal.
