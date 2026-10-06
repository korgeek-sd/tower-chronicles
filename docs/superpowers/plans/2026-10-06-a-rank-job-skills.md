# A-Rank Job Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved 36 active skills for all 12 A-rank jobs with no basic-attack dependency and keep client/server combat catalogs identical.

**Architecture:** Author A-rank combat definitions in a dedicated `aDefinitions.ts`, register them through the existing job registry, and derive catalog/detail state from those definitions. Regenerate the server combat catalog from the same TypeScript source, then deploy that catalog through a migration so online combat uses exactly the same skill IDs and numbers.

**Tech Stack:** TypeScript, Node test runner, Vite, Supabase/PostgreSQL combat-v2 catalog.

**Spec:** `docs/superpowers/specs/2026-10-06-a-rank-job-skills-design.md`

## Global Constraints

- No A-rank skill or passive may depend on `ACTION_IS_BASIC_ATTACK`.
- Each A-rank job has exactly three active skills and combat resource `{id:'combat', initialValue:0, maxValue:4}`.
- Skill 1 is `GENERATOR +1` with cooldown `0` for every A-rank job.
- Skill 2 is `NEUTRAL` and expresses the job identity using only existing engine actions/effects.
- Skill 3 is a fixed-cost `SPENDER` consuming exactly `3` resource.
- Active actions must remain within the current engine whitelist.
- Reuse existing effects only; do not add a new combat mechanic or resource type.
- SR/SSR combat definitions are out of scope.

## Review Focus

- A player at 0 resource must always have skill 1 available and must not be soft-locked when skills 2/3 are cooling down.
- Generator resource is awarded only after a successful offensive hit, preserving the current resolver semantics.
- Conditional finishers must evaluate current HP/effect state through existing `JobCondition` paths rather than custom logic.
- Self-HP-cost skills must never kill the player because the existing resolver clamps the player to at least 1 HP.
- Server combat-v2 catalog must match authored TypeScript definitions exactly, including cooldown 0 and penetration values.

---

### Task 1: Add failing A-rank definition/catalog tests

**Files:**
- Create: `tests/aJobCombatDefinitions.test.ts`
- Modify: `tests/jobs.test.ts`

**Interfaces:**
- Consumes: `JOB_CATALOG`, `A_JOB_DEFINITIONS`, `getJobCombatDefinition`, `initFiveJobCombatDefinitions`.
- Produces: regression assertions for all 12 A-rank jobs and 36 skills.

- [ ] **Step 1: Write the failing tests**
  - Assert there are 12 A-rank definitions and every job has exactly 3 skills.
  - Assert every skill 1 is `GENERATOR`, gain `1`, cooldown `0`.
  - Assert every skill 3 is fixed `SPENDER`, amount `3`.
  - Assert no A-rank condition tree contains `ACTION_IS_BASIC_ATTACK`.
  - Assert representative exact values: executor finisher 3.0→3.8 under target HP 30%, inquisitor finisher penetration .35 and weaken condition, bloodfighter HP costs .08/.12, life stitcher heal/regen/cleanse, stair scout 4×.9.
  - Update job catalog expectation from 14 combat-ready jobs to 26 after A-rank registration.
- [ ] **Step 2: Verify tests fail before production implementation** using `npm test -- tests/aJobCombatDefinitions.test.ts tests/jobs.test.ts`.

### Task 2: Implement A-rank authored combat definitions and registry wiring

**Files:**
- Create: `src/game/jobs/aDefinitions.ts`
- Modify: `src/game/jobs/definitions.ts`
- Modify: `src/game/jobs/catalog.ts`

**Interfaces:**
- Produces: `A_JOB_DEFINITIONS: JobCombatDefinition[]` containing the approved 12 definitions.
- `initFiveJobCombatDefinitions()` registers `A_JOB_DEFINITIONS` alongside existing definitions.
- `JOB_CATALOG` derives A-rank `combatKit` and resource metadata from `A_JOB_DEFINITIONS`.

- [ ] **Step 1: Implement the 12 definitions** exactly from the approved spec with IDs `<job_id>_skill_1..3`, no passives, resource 0/4, and existing effects/actions only.
- [ ] **Step 2: Register A definitions** in `definitions.ts`.
- [ ] **Step 3: Mark all A jobs COMBAT_READY via catalog derivation** in `catalog.ts`.
- [ ] **Step 4: Run focused tests** and confirm the Task 1 tests pass.
- [ ] **Step 5: Commit** the authored definitions and catalog wiring.

### Task 3: Keep job detail UI synchronized with live A definitions

**Files:**
- Modify: `src/game/jobs/details.ts`
- Modify or remove stale authored values from: `src/game/jobs/aDetails.ts`
- Test: `tests/jobDetailSheet.test.ts` and/or `tests/aJobCombatDefinitions.test.ts`

**Interfaces:**
- Consumes: `A_JOB_DEFINITIONS` / registered A definitions.
- Produces: detail previews whose names, descriptions, cooldowns and resource labels match live combat definitions.

- [ ] **Step 1: Add a failing detail synchronization test** for all 12 A-rank jobs.
- [ ] **Step 2: Replace stale A detail skill values with data derived from combat definitions**, retaining only flavor description where useful.
- [ ] **Step 3: Run focused tests** and confirm UI detail metadata matches combat definitions.
- [ ] **Step 4: Commit** the detail synchronization.

### Task 4: Regenerate and verify the server combat-v2 catalog

**Files:**
- Modify (generated): `supabase/combat-v2-catalog.sql`
- Modify/Create migration under: `supabase/migrations/`
- Test: existing combat catalog parity tests plus `tests/aJobCombatDefinitions.test.ts`

**Interfaces:**
- Consumes: `scripts/generateCombatSqlCatalog.ts`, which calls `initFiveJobCombatDefinitions()` and serializes `JOB_CATALOG` combat definitions.
- Produces: `private.combat_v2_catalog()` containing all 12 A-rank job definitions with client-identical IDs/numbers.

- [ ] **Step 1: Regenerate `supabase/combat-v2-catalog.sql`** from the TypeScript authored catalogs.
- [ ] **Step 2: Add a migration** replacing `private.combat_v2_catalog()` with the regenerated catalog.
- [ ] **Step 3: Add/extend parity assertions** for A-rank skill IDs, cooldowns, resource definitions, penetration, conditional multipliers, and effect IDs.
- [ ] **Step 4: Run the complete project test suite and build** (`npm test`, `npm run build`).
- [ ] **Step 5: Commit** generated SQL and migration.

### Task 5: Apply server migration and end-to-end verify

**Files:**
- No additional source files unless verification finds a mismatch.

**Interfaces:**
- Consumes: committed Supabase migration/catalog.
- Produces: live server catalog where A-rank online combat resolves the same 36 skills as the client.

- [ ] **Step 1: Apply the catalog migration to project `zecdhceihrdwdkdykxhx`.**
- [ ] **Step 2: Query `private.combat_v2_catalog()` and verify all 12 A-rank jobs, 36 skills, skill-1 cooldown 0/generator +1, and skill-3 cost 3.**
- [ ] **Step 3: Verify GitHub CI/build on the final commit is green.**
- [ ] **Step 4: Report final commit(s), server verification, and explicitly note that A-rank skill image generation remains the next separate step.**
