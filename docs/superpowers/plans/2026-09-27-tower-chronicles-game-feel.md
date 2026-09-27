# Tower Chronicles Game Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable Game Feel subsystem for Tower Chronicles and integrate it into Association Seal, Equipment Enhancement, Combat, and Market screens without changing gameplay rules or server authority.

**Architecture:** Add an isolated `src/gameFeel` subsystem that turns semantic gameplay/UI events into ephemeral visual and optional haptic feedback. Screens emit semantic events only; recipes map those events to presentation commands; a React provider and feedback layer render short-lived effects while preserving current server-authoritative flows.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, CSS animations, browser `navigator.vibrate`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-27-tower-chronicles-game-feel-design.md`

## Global Constraints

- Do not add or change combat, enhancement, seal, or market probabilities.
- Do not move any server decision or RNG result to the client.
- Do not add Motion, Framer Motion, tsParticles, or another animation dependency in V1.
- Game Feel state is ephemeral and must not change save schema or Supabase schema.
- Game Feel failures must never block gameplay, transactions, battle resolution, or save application.
- Result feedback may play only after authoritative result data is available.
- `prefers-reduced-motion: reduce` must disable or simplify shake, particle travel, and large motion.
- Haptics are optional, capability-detected, non-blocking, and never awaited by gameplay code.
- Animations should prefer `transform` and `opacity`.
- No idle `requestAnimationFrame` loop and no unbounded feedback-node creation.
- Audio remains out of scope for this implementation.

## Review Focus

- Unsupported vibration API: every Game Feel event must still complete without throwing or changing gameplay behavior.
- Rapid repeated events: expired feedback must be removed and queues must stay bounded when combat or market events fire quickly.
- Reduced-motion users: semantic result visibility must remain even when movement and particles are removed.
- Server/RPC failures: pending feedback must settle into error feedback without replaying success/result recipes.
- Disabled or unavailable controls: press/haptic feedback must not fire for disabled actions.

---

### Task 1: Define the shared Game Feel type system and recipe resolver

**Files:**
- Create: `src/gameFeel/types.ts`
- Create: `src/gameFeel/engine.ts`
- Create: `src/gameFeel/recipes/seal.ts`
- Create: `src/gameFeel/recipes/enhancement.ts`
- Create: `src/gameFeel/recipes/combat.ts`
- Create: `src/gameFeel/recipes/market.ts`
- Test: `tests/gameFeelCore.test.ts`

**Interfaces:**
- Produces: `GameFeelEvent`, `GameFeelIntensity`, `GameFeelPayloadMap`, `GameFeelCommand`, `GameFeelRecipe`
- Produces: `resolveGameFeelRecipe<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E],options?:{reducedMotion?:boolean}):GameFeelRecipe`
- Consumes: no React, DOM, gameplay-engine, RPC, or storage modules

- [ ] **Step 1: Write the failing core recipe tests**

Add tests that assert:
- the event union covers the exact semantic events from the spec
- `seal.roll.result` maps step 1/2/3 to normal/strong/exceptional intensity
- `enhancement.result` maps SUCCESS / FAIL_KEEP / FAIL_DOWNGRADE / FAIL_DESTROY to distinct recipes
- combat and market events resolve without importing gameplay state
- reduced-motion resolution removes shake/particle-travel commands while retaining a visible result command
- malformed optional payloads fall back to a safe normal/subtle recipe rather than throwing

Run: `npm test -- --test-name-pattern="GAME FEEL CORE"`  
Expected: FAIL because the new modules do not exist.

- [ ] **Step 2: Implement the public types in `src/gameFeel/types.ts`**

Define:
- `GameFeelIntensity = 'subtle'|'normal'|'strong'|'exceptional'`
- exact `GameFeelEvent` union from the approved spec
- payload mappings for seal step, enhancement outcome, and optional combat intensity
- command union for press, pulse, flash, shake, burst, particles, value-pop, and haptic
- `GameFeelRecipe` with semantic event, intensity, duration, and command list

- [ ] **Step 3: Implement domain recipe modules**

Each recipe file exports one pure resolver:
- `sealRecipe(event,payload):GameFeelRecipe`
- `enhancementRecipe(event,payload):GameFeelRecipe`
- `combatRecipe(event,payload):GameFeelRecipe`
- `marketRecipe(event,payload):GameFeelRecipe`

Use the timing and intensity rules from the spec. Do not read game state or call browser APIs.

- [ ] **Step 4: Implement `resolveGameFeelRecipe` in `src/gameFeel/engine.ts`**

Dispatch by event prefix, normalize unsafe payloads, and transform commands for reduced-motion mode.

- [ ] **Step 5: Run the core tests**

Run: `npm test -- --test-name-pattern="GAME FEEL CORE"`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/gameFeel/types.ts src/gameFeel/engine.ts src/gameFeel/recipes tests/gameFeelCore.test.ts
git commit -m "feat: add Tower Chronicles game feel recipes"
```

### Task 2: Add safe haptics, feedback queue, and motion preferences

**Files:**
- Create: `src/gameFeel/haptics.ts`
- Create: `src/gameFeel/feedback.ts`
- Create: `src/gameFeel/preferences.ts`
- Test: `tests/gameFeelRuntime.test.ts`

**Interfaces:**
- Consumes: `GameFeelRecipe`, `GameFeelCommand`, `GameFeelIntensity`
- Produces: `playHaptic(intensity:GameFeelIntensity):void`
- Produces: `createFeedbackQueue(options?:{maxActive?:number}):FeedbackQueue`
- Produces: `readGameFeelPreferences():{reducedMotion:boolean}`

- [ ] **Step 1: Write failing runtime tests**

Tests must prove:
- missing `navigator.vibrate` does not throw
- a throwing vibration implementation is contained
- disabled haptic capability produces no error
- queue default maximum is finite and rapid repeated events cannot exceed it
- expiry removes commands after their duration
- reduced-motion preference returns true when `matchMedia('(prefers-reduced-motion: reduce)')` matches
- missing `matchMedia` safely returns false

Run: `npm test -- --test-name-pattern="GAME FEEL RUNTIME"`  
Expected: FAIL because runtime modules do not exist.

- [ ] **Step 2: Implement `playHaptic`**

Use guarded browser capability detection. Map intensity to short vibration patterns. Catch browser errors internally and return immediately.

- [ ] **Step 3: Implement the bounded feedback queue**

Define:
- `FeedbackEntry` with id, recipe, createdAt, expiresAt
- `enqueue(recipe):FeedbackEntry`
- `snapshot():readonly FeedbackEntry[]`
- `prune(now?:number):void`
- `clear():void`

Set a finite default `maxActive` and drop the oldest entries when needed.

- [ ] **Step 4: Implement motion preference detection**

Expose a pure-safe browser adapter that can be called from React without requiring browser globals during tests.

- [ ] **Step 5: Run runtime tests**

Run: `npm test -- --test-name-pattern="GAME FEEL RUNTIME"`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/gameFeel/haptics.ts src/gameFeel/feedback.ts src/gameFeel/preferences.ts tests/gameFeelRuntime.test.ts
git commit -m "feat: add safe game feel runtime adapters"
```

### Task 3: Add React provider, hook, feedback layer, and shared CSS

**Files:**
- Create: `src/gameFeel/react/GameFeelProvider.tsx`
- Create: `src/gameFeel/react/useGameFeel.ts`
- Create: `src/gameFeel/react/FeedbackLayer.tsx`
- Create: `src/gameFeel/game-feel.css`
- Modify: `src/main.tsx`
- Test: `tests/gameFeelUi.test.ts`

**Interfaces:**
- Consumes: `resolveGameFeelRecipe`, feedback queue, haptic adapter, preferences
- Produces: `GameFeelProvider`
- Produces: `useGameFeel():{play<E extends GameFeelEvent>(event:E,payload?:GameFeelPayloadMap[E]):void}`
- Produces: `FeedbackLayer`

- [ ] **Step 1: Write failing provider/source tests**

Assert:
- `main.tsx` mounts one `GameFeelProvider` around gameplay UI
- provider catches feedback execution errors
- hook exposes only semantic `play` to screens
- `FeedbackLayer` renders entries from the provider rather than gameplay state
- CSS contains shared press, pending, flash, pulse, shake, burst, particle, and value-pop rules
- CSS contains `@media(prefers-reduced-motion:reduce)`
- CSS does not introduce infinite active animation loops for feedback entries

Run: `npm test -- --test-name-pattern="GAME FEEL UI"`  
Expected: FAIL because the provider layer does not exist.

- [ ] **Step 2: Implement `GameFeelProvider`**

Provider owns the ephemeral queue, resolves recipes with current reduced-motion preference, triggers optional haptics, schedules queue pruning, and contains presentation errors.

- [ ] **Step 3: Implement `useGameFeel`**

Expose the typed semantic `play` function. Calling the hook outside the provider should degrade to a safe no-op rather than crash gameplay.

- [ ] **Step 4: Implement `FeedbackLayer`**

Render only generic feedback primitives derived from commands. Do not import Seal, Enhancement, Combat, or Market components.

- [ ] **Step 5: Add `game-feel.css`**

Add reusable:
- press compression tokens
- pending pulse
- localized flash
- value pop
- short nudge/shake
- radial burst
- bounded decorative particles
- reduced-motion replacements

- [ ] **Step 6: Mount provider and stylesheet from `src/main.tsx`**

One provider instance wraps shared UI. Avoid per-screen provider nesting.

- [ ] **Step 7: Run provider tests, typecheck, and build**

Run:
- `npm test -- --test-name-pattern="GAME FEEL UI"`
- `npm run typecheck`
- `npm run build`

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/gameFeel/react src/gameFeel/game-feel.css src/main.tsx tests/gameFeelUi.test.ts
git commit -m "feat: add reusable game feel provider"
```

### Task 4: Make Association Seal the reference integration

**Files:**
- Modify: `src/components/seal/SealScreen.tsx`
- Modify: `src/mobile-game.css`
- Test: `tests/associationSeal.test.ts`
- Test: `tests/gameFeelIntegrations.test.ts`

**Interfaces:**
- Consumes: `useGameFeel().play`
- Emits: `seal.roll.start`, `seal.roll.result`, `seal.reset`, `ui.error`

- [ ] **Step 1: Write failing Seal integration tests**

Assert:
- pressing a valid roll emits `seal.roll.start` before awaiting the RPC
- `seal.roll.result` is emitted only after a returned authoritative step exists
- step payload comes from the RPC result and no client RNG is introduced
- reset emits `seal.reset` only after authoritative reset succeeds
- RPC failure emits `ui.error` and does not emit a result recipe
- disabled roll/reset controls do not invoke Game Feel
- the current visible result text remains present for reduced-motion users

Run: `npm test -- --test-name-pattern="GAME FEEL SEAL|ASSOCIATION SEAL"`  
Expected: FAIL on missing semantic integration.

- [ ] **Step 2: Integrate semantic events into `SealScreen`**

Keep all existing server RPC and state application order. Add only presentation calls around the existing lifecycle.

- [ ] **Step 3: Replace Seal-specific duplicated keyframes where the shared layer now covers them**

Keep seal identity styling, ring artwork, and node layout. Remove only global-feel animations duplicated by the new subsystem.

- [ ] **Step 4: Run Seal tests and full typecheck**

Run:
- `npm test -- --test-name-pattern="GAME FEEL SEAL|ASSOCIATION SEAL"`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/seal/SealScreen.tsx src/mobile-game.css tests/associationSeal.test.ts tests/gameFeelIntegrations.test.ts
git commit -m "feat: apply game feel to association seal"
```

### Task 5: Integrate Equipment Enhancement outcomes

**Files:**
- Modify: `src/components/enhancement/EnhancementScreen.tsx`
- Test: `tests/gameFeelIntegrations.test.ts`

**Interfaces:**
- Consumes: `useGameFeel().play`
- Emits: `enhancement.attempt`, `enhancement.result`, `ui.error`

- [ ] **Step 1: Write failing enhancement integration tests**

Assert:
- valid confirmation emits `enhancement.attempt`
- online SUCCESS / FAIL_KEEP / FAIL_DOWNGRADE / FAIL_DESTROY values are passed unchanged to `enhancement.result`
- offline local enhancement emits a result based on the resulting game state/notice rather than a guessed result
- server failure emits `ui.error` and no success recipe
- disabled attempt controls emit nothing

Run: `npm test -- --test-name-pattern="GAME FEEL ENHANCEMENT"`  
Expected: FAIL before integration.

- [ ] **Step 2: Integrate semantic events into `EnhancementScreen`**

Do not alter enhancement quotes, costs, probabilities, RPC calls, or item mutation behavior.

- [ ] **Step 3: Run enhancement tests and build**

Run:
- `npm test -- --test-name-pattern="GAME FEEL ENHANCEMENT"`
- `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/enhancement/EnhancementScreen.tsx tests/gameFeelIntegrations.test.ts
git commit -m "feat: apply game feel to equipment enhancement"
```

### Task 6: Integrate Combat with a low effect budget

**Files:**
- Modify: `src/components/battle/BattleScreen.tsx`
- Modify: `src/components/battle/BattleScene.tsx` only if the existing scene needs a semantic impact target
- Test: `tests/gameFeelCombat.test.ts`

**Interfaces:**
- Consumes: `useGameFeel().play`
- Emits: `combat.basic-hit`, `combat.critical-hit`, `combat.player-damaged`, `combat.guard`, `combat.heal`, `combat.death`
- Reads existing authoritative/local combat event records; does not derive new combat outcomes

- [ ] **Step 1: Write failing combat integration tests**

Pin:
- ordinary damage maps to `combat.basic-hit`
- existing critical markers map to `combat.critical-hit`
- player damage maps to `combat.player-damaged`
- guard/shield events map to `combat.guard`
- heal events map to `combat.heal`
- death/end events map to `combat.death`
- duplicate renders of the same combat event do not replay feedback
- speed multipliers do not create an unbounded queue

Run: `npm test -- --test-name-pattern="GAME FEEL COMBAT"`  
Expected: FAIL before integration.

- [ ] **Step 2: Add a combat-event-to-Game-Feel adapter**

Consume existing combat event identifiers/timestamps so each authoritative event produces at most one feedback event.

- [ ] **Step 3: Integrate the adapter into the battle UI**

Keep feedback localized and short. Do not add global persistent screen shake.

- [ ] **Step 4: Run combat tests, existing battle tests, and typecheck**

Run:
- `npm test -- --test-name-pattern="GAME FEEL COMBAT|BATTLE|COMBAT"`
- `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/battle tests/gameFeelCombat.test.ts
git commit -m "feat: apply restrained game feel to combat"
```

### Task 7: Integrate Market and Gold Exchange with restrained feedback

**Files:**
- Modify: `src/components/market/MarketScreen.tsx`
- Modify: `src/components/market/ServerMarketScreen.tsx`
- Modify: `src/components/market/GoldExchangeScreen.tsx`
- Test: `tests/gameFeelMarket.test.ts`

**Interfaces:**
- Consumes: `useGameFeel().play`
- Emits: `market.order-placed`, `market.order-cancelled`, `market.trade-partial`, `market.trade-filled`, `ui.error`

- [ ] **Step 1: Write failing market integration tests**

Assert:
- successful order placement emits `market.order-placed`
- successful cancellation emits `market.order-cancelled`
- server-reported partial fill emits `market.trade-partial`
- completed fill emits `market.trade-filled`
- DEMO-mode visual orderbook updates do not emit real trade feedback
- rejected/failed order RPC emits `ui.error` without success feedback
- market recipes resolve only to subtle/normal intensity

Run: `npm test -- --test-name-pattern="GAME FEEL MARKET"`  
Expected: FAIL before integration.

- [ ] **Step 2: Integrate semantic feedback into market screens**

Use existing transaction results and order/trade state. Never infer a fill from animation/demo data.

- [ ] **Step 3: Run market tests and build**

Run:
- `npm test -- --test-name-pattern="GAME FEEL MARKET|MARKET|GOLD EXCHANGE"`
- `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/market tests/gameFeelMarket.test.ts
git commit -m "feat: apply restrained game feel to markets"
```

### Task 8: Add the canonical Tower Chronicles Game Feel rulebook

**Files:**
- Create: `docs/game-feel/README.md`
- Modify: `README.md`
- Test: `tests/gameFeelDocs.test.ts`

**Interfaces:**
- Consumes: actual public event names and timing/intensity constants from Tasks 1-7
- Produces: canonical contributor-facing Game Feel rules

- [ ] **Step 1: Write failing documentation contract test**

Assert the rulebook contains:
- event naming convention
- four intensity levels
- 60-90 ms press budget
- server authority ordering
- reduced-motion requirement
- haptic policy
- performance limits
- recipe authoring checklist
- examples for Seal, Enhancement, Combat, and Market
- prohibition on one-off global animation systems for new gameplay screens

Run: `npm test -- --test-name-pattern="GAME FEEL DOCS"`  
Expected: FAIL because the rulebook does not exist.

- [ ] **Step 2: Write `docs/game-feel/README.md`**

Document the final implemented API, not speculative APIs. Include a short contributor checklist for adding a new recipe.

- [ ] **Step 3: Add a README pointer**

Add the Game Feel rulebook to the repository's major-structure/development documentation.

- [ ] **Step 4: Run docs test**

Run: `npm test -- --test-name-pattern="GAME FEEL DOCS"`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/game-feel/README.md README.md tests/gameFeelDocs.test.ts
git commit -m "docs: add Tower Chronicles game feel rulebook"
```

### Task 9: Release verification and regression gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/storage/repository.ts`
- Modify: `index.html`
- Modify: release assertion test(s)
- Modify: `README.md`

**Interfaces:**
- Consumes: completed Tasks 1-8
- Produces: one versioned release commit ready for PR review

- [ ] **Step 1: Bump the app version by one patch release**

Update package version, runtime `APP_VERSION`, build marker, lockfile, release test, and README consistently.

- [ ] **Step 2: Add release notes**

Document:
- shared Game Feel subsystem
- Seal reference integration
- Enhancement integration
- Combat integration
- Market integration
- reduced motion
- optional haptics
- no gameplay probability or server-authority changes

- [ ] **Step 3: Run the full verification suite**

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`
- `node scripts/standalone.mjs`

Expected: zero test failures, typecheck success, production build success, standalone verification success when source assets are versioned.

- [ ] **Step 4: Inspect the final diff for authority and dependency regressions**

Confirm:
- no new runtime dependency
- no `Math.random` added to Game Feel integrations
- no Supabase migration
- no save-schema migration
- result recipes use existing authoritative outputs
- reduced-motion rules remain present

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/storage/repository.ts index.html README.md tests
git commit -m "chore: release reusable game feel system"
```

- [ ] **Step 6: Request whole-branch code review before merge**

Review specifically for:
- gameplay authority leaks
- duplicate feedback replay
- queue/performance leaks
- reduced-motion regressions
- event/payload type drift
