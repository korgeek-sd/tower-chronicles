# Tower Chronicles Combat Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current monolithic combat resolution path with a deterministic alternating-turn combat engine that implements the approved four-slot resource, cooldown, hit/reaction, shield, status, healing, revival, monster-AI, and battle-lifecycle rules while preserving the existing public battle actions.

**Architecture:** Keep `src/game/engine/combat.ts` as the public facade used by the UI and existing callers, but move resolution responsibilities into focused modules. Actions become event-queue work; direct-hit resolution owns hit-by-hit death/reaction boundaries; lifecycle code owns per-combat reset; job skills become data consumed by the engine rather than special cases embedded in the central loop.

**Tech Stack:** TypeScript 5.8, React 19, Node test runner, Vite 6.

**Spec:** `docs/superpowers/specs/2026-10-03-combat-engine-design.md`

## Global Constraints

- Strict alternating turns remain: one player normal action, then one monster normal action.
- Every job has one basic attack plus exactly three active skill slots.
- Combat resource capacity is exactly 4 and resets after every combat.
- Default basic attack generation is +1 per successful action, not per hit.
- Player default crit is 5% chance / 150% damage; monsters have no random crit by default.
- Shields stack additively up to 300% of max HP and have no turn duration.
- DOT bypasses shields and resolves before HOT at turn end.
- Same effect ID reapplication extends duration only; magnitude does not stack.
- Controls in V1 are Stun, Silence, Root; Disarm is excluded.
- Healing potion uses are limited to 5 per expedition; revival potion is death-interrupt only.
- No persistent Accuracy/Evasion stats, no true-damage type, and no equipment defense-penetration stat.
- Existing public actions `basicAttack`, `useBattleSkill`, `useBattlePotion`, `flee`, `resolveMonsterTurn`, and `resolveRevivalDecision` remain callable during migration.
- `npm test`, `npm run typecheck`, and `npm run build` must pass before merge.

## Review Focus

- Killing hit on a counter-capable target must cancel that target's pending counter and all remaining hits.
- A multi-hit action whose every hit becomes MISS/IMMUNE must not grant the basic-attack resource point.
- A shield-blocked direct hit must suppress its attached on-hit debuff, while direct non-damaging debuffs still apply.
- Cooldown N must block exactly the next N actor turns even through Stun/Silence, with no off-by-one reuse.
- Revival must discard the interrupted action queue and resume at the correct next normal turn without restoring shield or harmful effects.

---

## File Structure

### New focused engine modules

- `src/game/engine/combatResource.ts` — four-slot resource gain/spend rules and skill resource costs.
- `src/game/engine/cooldowns.ts` — ready-turn cooldown model for player and monster skills.
- `src/game/engine/combatQueue.ts` — typed combat work queue and queue cancellation on death.
- `src/game/engine/healing.ts` — critical healing, healing modifiers, overheal, and 25% excess decay.
- `src/game/engine/battleLifecycle.ts` — combat-start/combat-end transient state reset.

### Existing modules to narrow or adapt

- `src/game/types.ts` — runtime/event types and state fields.
- `src/game/engine/combat.ts` — facade/orchestration only.
- `src/game/engine/directHits.ts` — per-hit outcomes and death boundaries.
- `src/game/engine/damage.ts` — percentage defense formula.
- `src/game/engine/effects.ts` — duration extension, additive shields, control effects, DOT/HOT, cleanse/dispel.
- `src/game/engine/monsterSkills.ts` — hit/reaction hooks and on-hit effect gating.
- `src/game/engine/monsterAi.ts` — weighted/forced rules, prepared attacks, silence/stun, phases.
- `src/game/jobs/framework.ts` — Generator/Neutral/Spender metadata and fixed/variable resource cost.
- `src/game/jobs/resolver.ts` — job skill execution through shared resource/effect APIs.
- `src/game/engine/expedition.ts` — expedition potion-use counter initialization and lifecycle integration.
- `src/storage/repository.ts` — save migration/defaulting for new runtime fields.
- `src/components/battle/BattleScene.tsx` — four resource pips under player HP.
- `src/components/battle/BattleScreen.tsx` — skill disabled state/cost/cooldown presentation as needed.

---

### Task 1: Combat runtime types, migration, and lifecycle state

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/engine/expedition.ts`
- Create: `src/game/engine/battleLifecycle.ts`
- Modify: `src/storage/repository.ts`
- Test: `tests/combatRuntimeV2.test.ts`

**Interfaces:**
- Produces: `resetCombatRuntime(e: Expedition, playerMaxHp: number): void`
- Produces: new typed combat resource/cooldown/queue fields used by all later tasks.
- Produces: expedition-scoped `healingPotionUses` initialized to `0`.

- [ ] **Step 1: Write failing runtime/lifecycle tests**

Cover: new expedition starts with resource `0/4`, healing potion uses `0`, empty queue, no shield runtime; ending/resetting a combat clears resource/cooldowns/effects/reactions/monster phase state and clamps overheal to max HP but preserves ordinary HP and remaining potion inventory.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatRuntimeV2.test.ts`
Expected: FAIL because the new runtime fields/lifecycle helper do not exist.

- [ ] **Step 3: Add the runtime types and lifecycle helper**

Use explicit typed fields rather than untyped keys in `cooldowns`. Keep migration compatible with currently saved expeditions by defaulting absent fields during load.

- [ ] **Step 4: Run focused test and typecheck**

Run: `node --import ./tests/register.mjs --test tests/combatRuntimeV2.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/engine/expedition.ts src/game/engine/battleLifecycle.ts src/storage/repository.ts tests/combatRuntimeV2.test.ts
git commit -m "refactor: add combat v2 runtime lifecycle"
```

### Task 2: Exact cooldown semantics

**Files:**
- Create: `src/game/engine/cooldowns.ts`
- Modify: `src/game/engine/turns.ts`
- Modify: `src/game/engine/combat.ts`
- Modify: `src/game/engine/monsterAi.ts`
- Test: `tests/combatCooldownsV2.test.ts`
- Update regression tests: `tests/battle-turns.test.ts`, `tests/monsterEngine.test.ts`

**Interfaces:**
- Produces: `setSkillCooldown(e: Expedition, actor: CombatActor, skillId: string, cooldown: number): void`
- Produces: `skillCooldownRemaining(e: Expedition, actor: CombatActor, skillId: string): number`
- Produces: `isSkillReady(e: Expedition, actor: CombatActor, skillId: string): boolean`

- [ ] **Step 1: Write failing cooldown tests**

Assert CD3 used on actor turn 5 is unavailable on turns 6/7/8 and available on 9; Stun and Silence still advance actor turn count; other actor's turns do not advance it; combat reset makes all skills ready.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatCooldownsV2.test.ts`
Expected: FAIL against decrement-based cooldown storage.

- [ ] **Step 3: Implement ready-turn cooldowns and compatibility wrappers**

`turns.ts` should delegate to the new module so existing UI/tests can keep using `skillTurnsLeft()` during migration.

- [ ] **Step 4: Verify focused and regression tests**

Run: `node --import ./tests/register.mjs --test tests/combatCooldownsV2.test.ts tests/battle-turns.test.ts tests/monsterEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/cooldowns.ts src/game/engine/turns.ts src/game/engine/combat.ts src/game/engine/monsterAi.ts tests/combatCooldownsV2.test.ts tests/battle-turns.test.ts tests/monsterEngine.test.ts
git commit -m "refactor: use exact turn cooldown expiry"
```

### Task 3: Four-slot resource and job skill metadata

**Files:**
- Create: `src/game/engine/combatResource.ts`
- Modify: `src/game/jobs/framework.ts`
- Modify: `src/game/jobs/resolver.ts`
- Modify: `src/game/jobs/service.ts`
- Modify: existing definitions under `src/game/jobs/definitions/`
- Test: `tests/combatResourceV2.test.ts`
- Update: `tests/jobsCombat.test.ts`

**Interfaces:**
- Produces: `CombatSkillResource = { kind:'GENERATOR'; gain:number } | { kind:'NEUTRAL' } | { kind:'SPENDER'; cost:{mode:'FIXED'; amount:number}|{mode:'VARIABLE'; min:number; max:number} }`
- Produces: `gainCombatResource(e: Expedition, amount: number): number`
- Produces: `spendCombatResource(e: Expedition, resource: CombatSkillResource): number | null`
- Produces: `grantBasicAttackResource(e: Expedition, successfulHitCount: number): number`

- [ ] **Step 1: Write failing resource tests**

Assert capacity 4, overflow discard, successful multi-hit basic grants only +1, all MISS/IMMUNE grants 0, shield-only HP damage still counts as a successful hit, fixed spender pre-spends exact cost, variable spender spends `min..max`, and generator gain occurs after successful execution.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatResourceV2.test.ts`
Expected: FAIL because shared resource semantics do not exist.

- [ ] **Step 3: Implement resource APIs and skill metadata**

Keep job-specific overrides explicit; default basic generation remains +1 unless a job definition overrides/replaces it.

- [ ] **Step 4: Verify resource/job tests**

Run: `node --import ./tests/register.mjs --test tests/combatResourceV2.test.ts tests/jobsCombat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/combatResource.ts src/game/jobs/framework.ts src/game/jobs/resolver.ts src/game/jobs/service.ts src/game/jobs/definitions tests/combatResourceV2.test.ts tests/jobsCombat.test.ts
git commit -m "feat: add four-slot combat resource"
```

### Task 4: Damage formula, hit outcomes, shield pool, and attached debuff gating

**Files:**
- Modify: `src/game/engine/damage.ts`
- Modify: `src/game/engine/directHits.ts`
- Modify: `src/game/engine/effects.ts`
- Modify: `src/game/engine/monsterSkills.ts`
- Test: `tests/combatDamageV2.test.ts`
- Update: `tests/combatTriggers.test.ts`, `tests/ironBosses.test.ts`

**Interfaces:**
- Produces: `DEFENSE_SCALE = 100`
- Produces: percentage-defense direct-damage resolver supporting 0..100% penetration.
- Produces: explicit hit outcomes `HIT | MISS | BLOCKED_BY_SHIELD | IMMUNE`.
- Produces: additive shield pool capped at `3 * maxHp` with no duration expiry.

- [ ] **Step 1: Write failing damage/shield tests**

Assert defense 0/50/100/200/300 produces 100%/~66.7%/50%/~33.3%/25%; penetration clamps at 100%; direct damage minimum reaching HP is 1; shields add and cap at 300% max HP; shield-only hit returns blocked outcome; attached poison is suppressed when HP damage is 0 but direct non-damaging poison still applies.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatDamageV2.test.ts`
Expected: FAIL against flat-defense and replace-shield behavior.

- [ ] **Step 3: Implement formula/outcomes/shield pool**

Remove turn-duration expiry from shield handling only; do not change non-shield effect duration semantics in this task.

- [ ] **Step 4: Verify focused/regression tests**

Run: `node --import ./tests/register.mjs --test tests/combatDamageV2.test.ts tests/combatTriggers.test.ts tests/ironBosses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/damage.ts src/game/engine/directHits.ts src/game/engine/effects.ts src/game/engine/monsterSkills.ts tests/combatDamageV2.test.ts tests/combatTriggers.test.ts tests/ironBosses.test.ts
git commit -m "refactor: rebuild damage and shield resolution"
```

### Task 5: Effect duration, controls, DOT/HOT, cleanse, and dispel

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/engine/effects.ts`
- Test: `tests/combatEffectsV2.test.ts`
- Update: `tests/combatTriggers.test.ts`

**Interfaces:**
- Produces: control tags/types for `STUN`, `SILENCE`, `ROOT` only.
- Produces: `isStunned(e, actor)`, `isSilenced(e, actor)`, `isRooted(e, actor)`.
- Produces: `cleanseEffects(e, actor, options): string[]` and `dispelEffects(...)` using priority and optional tag filtering.
- Consumes: shared shield handling from Task 4.

- [ ] **Step 1: Write failing effect tests**

Assert same effect ID extends remaining duration, magnitude/stack count does not increase; Stun/Silence/Root gating semantics; DOT bypasses shield; cleanse priority is `Stun > Silence > DOT > stat down > Root > other`; shield is not a normal cleanse/dispel target.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatEffectsV2.test.ts`
Expected: FAIL because current engine still has STACK/REFRESH behavior and no control helpers.

- [ ] **Step 3: Implement V2 effect semantics**

Migrate production effect definitions away from stack-based behavior where the new spec requires duration extension. Keep test-only legacy stack fixtures only if a surviving non-production test still needs them; otherwise remove them with their tests.

- [ ] **Step 4: Verify effects/regression tests**

Run: `node --import ./tests/register.mjs --test tests/combatEffectsV2.test.ts tests/combatTriggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/engine/effects.ts tests/combatEffectsV2.test.ts tests/combatTriggers.test.ts
git commit -m "feat: add combat control and effect semantics"
```

### Task 6: Action queue, multi-hit reactions, and death cancellation

**Files:**
- Create: `src/game/engine/combatQueue.ts`
- Modify: `src/game/engine/directHits.ts`
- Modify: `src/game/engine/monsterSkills.ts`
- Modify: `src/game/engine/reactions.ts`
- Modify: `src/game/engine/combat.ts`
- Test: `tests/combatQueueV2.test.ts`

**Interfaces:**
- Produces: typed queue items for direct hits, effects, reactions, and action completion.
- Produces: `resolveCombatQueue(state: GameState, queue: CombatQueueItem[], rng?:()=>number): GameState`
- Produces: reaction-origin marker that sets `canTriggerReaction:false`.

- [ ] **Step 1: Write failing queue/reaction tests**

Assert per-hit counter behavior on a 3-hit action; extra hit also counters; a counter cannot trigger another counter; killing hit cancels counter and remaining hits; attacker death during counter cancels remaining original hits; no queued work executes after actor death.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatQueueV2.test.ts`
Expected: FAIL because current continuation/reaction flow is not an explicit queue.

- [ ] **Step 3: Implement queue processing and migrate direct-hit chains**

Do not yet migrate healing/turn-end or monster phase logic; this task owns only action-chain resolution.

- [ ] **Step 4: Verify queue plus combat regression tests**

Run: `node --import ./tests/register.mjs --test tests/combatQueueV2.test.ts tests/ironBosses.test.ts tests/redFang.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/combatQueue.ts src/game/engine/directHits.ts src/game/engine/monsterSkills.ts src/game/engine/reactions.ts src/game/engine/combat.ts tests/combatQueueV2.test.ts tests/ironBosses.test.ts tests/redFang.test.ts
git commit -m "refactor: resolve combat actions through event queue"
```

### Task 7: Healing, overheal decay, turn-end order, and potion limit

**Files:**
- Create: `src/game/engine/healing.ts`
- Modify: `src/game/engine/combat.ts`
- Modify: `src/game/engine/effects.ts`
- Modify: `src/game/engine/expedition.ts`
- Test: `tests/combatHealingV2.test.ts`
- Update: `tests/potion-overhaul.test.ts`

**Interfaces:**
- Produces: `applyHealing(state, actor, amount, options): HealingResult`
- Produces: `decayPlayerOverheal(e: Expedition, maxHp: number): number` using exactly 25% of current excess.
- Produces: `resolveActorTurnEnd(state, actor, rng): GameState` with order DOT -> death/revival -> HOT -> overheal decay(player) -> duration update.

- [ ] **Step 1: Write failing healing/turn-end tests**

Assert skill healing can crit; potion healing never crits; healing may exceed max HP; 25% of excess decays each player turn; DOT ignores shield; DOT death suppresses subsequent HOT; healing potion sixth expedition use is rejected even across different combats.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatHealingV2.test.ts`
Expected: FAIL because overheal and expedition-use cap are absent.

- [ ] **Step 3: Implement shared healing and turn-end flow**

Potion use increments expedition counter only after successful potion action.

- [ ] **Step 4: Verify healing/potion tests**

Run: `node --import ./tests/register.mjs --test tests/combatHealingV2.test.ts tests/potion-overhaul.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/healing.ts src/game/engine/combat.ts src/game/engine/effects.ts src/game/engine/expedition.ts tests/combatHealingV2.test.ts tests/potion-overhaul.test.ts
git commit -m "feat: add overheal and expedition potion limits"
```

### Task 8: Death/revival state machine

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/engine/combatQueue.ts`
- Modify: `src/game/engine/combat.ts`
- Modify: `src/game/engine/effects.ts`
- Test: `tests/combatRevivalV2.test.ts`
- Update: `tests/ironBosses.test.ts`, `tests/potion-overhaul.test.ts`

**Interfaces:**
- Produces: revival context storing only resume turn (`PLAYER_TURN` or `MONSTER_TURN`) and death source, not remaining hit continuation.
- Consumes: lifecycle/effect cleanup and queue cancellation APIs from Tasks 1/5/6.

- [ ] **Step 1: Write failing revival tests**

Assert player death during own action counter resumes at monster normal turn; death during monster action resumes at player turn; player-turn-end DOT death resumes at monster turn; interrupted queue never resumes; resource/cooldowns/beneficial buffs remain; harmful effects and shield are cleared.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatRevivalV2.test.ts`
Expected: FAIL because current `CombatContinuationStep[]` resumes interrupted work.

- [ ] **Step 3: Replace continuation-based revival with resume-turn state**

Delete dead action-chain continuation semantics after regression tests are migrated.

- [ ] **Step 4: Verify revival regressions**

Run: `node --import ./tests/register.mjs --test tests/combatRevivalV2.test.ts tests/ironBosses.test.ts tests/potion-overhaul.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/engine/combatQueue.ts src/game/engine/combat.ts src/game/engine/effects.ts tests/combatRevivalV2.test.ts tests/ironBosses.test.ts tests/potion-overhaul.test.ts
git commit -m "refactor: make death cancel combat action chains"
```

### Task 9: Monster AI V2 — controls, weighted rules, prepared attacks, phases

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/engine/monsterAi.ts`
- Modify: `src/game/engine/monsterSkills.ts`
- Modify: monster combat data under `src/game/data/*Combat.ts`
- Test: `tests/monsterAiV2.test.ts`
- Update: `tests/monsterEngine.test.ts`, `tests/ironBosses.test.ts`, `tests/redFang.test.ts`, `tests/crystalTower.test.ts`

**Interfaces:**
- Produces: phase conditions supporting HP, monster-turn count, and one-shot event flags with AND/OR composition.
- Produces: forced actions before weighted candidate selection.
- Produces: weighted candidate selection with basic attack fallback and optional `cannotRepeat`.
- Produces: explicit per-effect immunity fields on monster definitions.

- [ ] **Step 1: Write failing AI tests**

Assert Stun skips the turn and cancels prepared attack; Silence blocks new active/prepared selection but does not cancel an already prepared attack; phase can advance on HP, turn number, or event; phase never regresses; forced action wins over weighted candidates; weighted selection is deterministic with injected RNG; immune control effect returns IMMUNE without applying.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/monsterAiV2.test.ts`
Expected: FAIL against current pure-priority AI.

- [ ] **Step 3: Implement AI V2 and adapt existing monster definitions**

Preserve current boss identities/pattern intent while expressing them in the new data model; do not redesign balance numbers in this task.

- [ ] **Step 4: Verify all monster suites**

Run: `node --import ./tests/register.mjs --test tests/monsterAiV2.test.ts tests/monsterEngine.test.ts tests/ironBosses.test.ts tests/redFang.test.ts tests/crystalTower.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/engine/monsterAi.ts src/game/engine/monsterSkills.ts src/game/data tests/monsterAiV2.test.ts tests/monsterEngine.test.ts tests/ironBosses.test.ts tests/redFang.test.ts tests/crystalTower.test.ts
git commit -m "feat: add phased weighted monster AI"
```

### Task 10: Combat facade integration, HUD resource pips, and full regression

**Files:**
- Modify: `src/game/engine/combat.ts`
- Modify: `src/components/battle/BattleScene.tsx`
- Modify: `src/components/battle/BattleScreen.tsx`
- Modify: relevant battle CSS in `src/mobile-game.css`
- Test: `tests/combatEngineV2.test.ts`
- Update: `tests/battleUi.test.ts`, `tests/jobsCombat.test.ts`, `tests/game.test.ts`

**Interfaces:**
- `combat.ts` remains the stable public facade.
- HUD consumes `expedition.jobRuntime.resource.value` and renders exactly four resource pips under player HP.
- Skill buttons consume shared readiness/resource helpers rather than duplicating rules.

- [ ] **Step 1: Write end-to-end engine and HUD tests**

Cover one full player-basic -> monster-action cycle; generator -> spender cycle; resource reset after kill; cooldown reset after combat; shield/effects reset after combat; ordinary HP and potion inventory persistence; four HUD pips reflect 0..4 and no longer represent generic effect count.

- [ ] **Step 2: Verify RED**

Run: `node --import ./tests/register.mjs --test tests/combatEngineV2.test.ts tests/battleUi.test.ts`
Expected: FAIL until facade/UI are wired to V2 state.

- [ ] **Step 3: Finish facade integration and HUD**

Remove obsolete combat branches only after their replacement tests are green. Keep battle animation/event emission compatible with `CombatEvent` consumers.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, TypeScript reports no errors, Vite production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine/combat.ts src/components/battle/BattleScene.tsx src/components/battle/BattleScreen.tsx src/mobile-game.css tests/combatEngineV2.test.ts tests/battleUi.test.ts tests/jobsCombat.test.ts tests/game.test.ts
git commit -m "feat: integrate tower chronicles combat engine v2"
```

## Final Verification

- [ ] Run `npm test` and confirm no old stack/shield/cooldown expectations remain accidentally preserved.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Confirm public battle actions still work from `src/main.tsx` without call-site rewrites.
- [ ] Confirm save migration loads a pre-V2 active expedition with safe defaults.
- [ ] Confirm battle HUD resource pips display 0..4 and clear on the next encounter.
- [ ] Compare implementation against every section of `docs/superpowers/specs/2026-10-03-combat-engine-design.md` before merge.
