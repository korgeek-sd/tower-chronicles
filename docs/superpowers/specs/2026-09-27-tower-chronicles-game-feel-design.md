# Tower Chronicles Game Feel Design

Date: 2026-09-27
Status: Approved design, pending implementation plan
Target: Tower Chronicles v0.1.x
Scope: Shared interaction-feedback layer for Seal, Enhancement, Combat, and Market UI

## 1. Goal

Tower Chronicles should feel like a mobile RPG rather than a collection of web controls. Button presses, pending server actions, successful results, failures, rare outcomes, and state transitions should share one visual and haptic language across the game.

The Game Feel layer must be reusable across the Association Seal, Equipment Enhancement, Combat, and Market screens without moving game rules or random outcomes into the client.

Success means:

- The same input feels the same everywhere.
- Common outcomes use consistent intensity and timing.
- Server-authoritative outcomes remain authoritative.
- Effects never block gameplay or alter saved state.
- Low-end devices and reduced-motion users remain supported.
- New screens can add feedback by selecting a recipe instead of rebuilding animation logic.

## 2. Non-goals

V1 does not:

- Add or change combat, enhancement, seal, or market probabilities.
- Move any server decision to the client.
- Add full audio management or music.
- Add a third-party animation or particle dependency.
- Add persistent gameplay state to the Game Feel layer.
- Make visual effects required for an action to complete.

Audio is deliberately deferred. The event API should leave room for a future audio adapter.

## 3. Architecture

Add a new isolated subsystem:

```text
src/gameFeel/
  types.ts
  engine.ts
  feedback.ts
  haptics.ts
  preferences.ts

  recipes/
    seal.ts
    enhancement.ts
    combat.ts
    market.ts

  react/
    GameFeelProvider.tsx
    useGameFeel.ts
    FeedbackLayer.tsx

  game-feel.css

docs/
  game-feel/
    README.md
```

### Responsibilities

`types.ts`
- Owns public event, intensity, payload, and feedback-command types.
- Contains no React, DOM, networking, or gameplay imports.

`engine.ts`
- Resolves a semantic event such as `enhancement.success` into a recipe.
- Normalizes intensity and reduced-motion behavior.
- Does not mutate game state.

`feedback.ts`
- Executes short-lived visual feedback commands.
- Generates identifiers and expiry timing for overlays, flashes, bursts, and shakes.
- Keeps feedback ephemeral and in-memory only.

`haptics.ts`
- Provides a safe optional vibration adapter.
- Uses browser capability detection.
- Fails silently when unsupported.
- Never decides whether an action succeeded.

`preferences.ts`
- Reads reduced-motion and future Game Feel preferences.
- V1 derives motion reduction from `prefers-reduced-motion`.
- Provides one interface so explicit settings can replace or augment this later.

`recipes/*.ts`
- Map domain events to reusable feedback commands.
- Contain presentation policy only.
- Must not import server RPCs or game engines.

`GameFeelProvider.tsx`
- Owns the current ephemeral feedback queue.
- Exposes one stable play API to screens.

`useGameFeel.ts`
- Primary screen-facing hook.

`FeedbackLayer.tsx`
- Renders screen-local or global transient visual effects.

`game-feel.css`
- Contains shared motion tokens, press states, flashes, hit pulses, result bursts, particles, and reduced-motion fallbacks.

## 4. Public API

Screens should only need a semantic event and optional payload.

Example:

```ts
const feel = useGameFeel();

feel.play('seal.roll.start');
feel.play('seal.roll.result', { step: 3 });

feel.play('enhancement.result', { outcome: 'SUCCESS' });
feel.play('enhancement.result', { outcome: 'FAIL_DESTROY' });

feel.play('combat.basic-hit');
feel.play('combat.critical-hit');
feel.play('combat.player-damaged');

feel.play('market.order-placed');
feel.play('market.trade-filled');
```

The initial public event union should include:

```ts
type GameFeelEvent =
  | 'ui.press'
  | 'ui.confirm'
  | 'ui.error'
  | 'seal.roll.start'
  | 'seal.roll.result'
  | 'seal.reset'
  | 'enhancement.attempt'
  | 'enhancement.result'
  | 'combat.basic-hit'
  | 'combat.critical-hit'
  | 'combat.player-damaged'
  | 'combat.guard'
  | 'combat.heal'
  | 'combat.death'
  | 'market.order-placed'
  | 'market.order-cancelled'
  | 'market.trade-partial'
  | 'market.trade-filled';
```

The API must be additive. Existing event names are stable once used by production screens.

## 5. Feedback State Model

Interactive server actions use the same conceptual state machine:

```text
idle
  -> pressed
  -> pending
  -> resolved | error
  -> idle
```

### pressed

Immediate local response is allowed before the server responds:

- button compresses
- highlight changes
- very light haptic may fire

This communicates input acceptance only. It must never imply success.

### pending

While an RPC is unresolved:

- button stays disabled
- pending pulse or contained energy animation may play
- destructive or success-colored effects are forbidden

### resolved

Only after the authoritative result is known:

- state is applied
- semantic result event is played
- haptic and visual intensity are selected from the actual result

### error

A request error uses restrained feedback:

- short red/brown edge flash
- subtle horizontal nudge
- optional light error haptic

Game state remains whatever the authoritative flow dictates.

## 6. Intensity Scale

All recipes use four intensities:

```text
subtle
normal
strong
exceptional
```

Guidance:

- `subtle`: common navigation, selection, ordinary order placement
- `normal`: standard successful gameplay action
- `strong`: meaningful success, failure with consequence, large damage
- `exceptional`: rare or milestone outcome only

Rare outcomes should not be made common through visual overuse.

## 7. Timing Rules

Default timing budget:

- button press compression: 60-90 ms
- button release recovery: 90-140 ms
- ordinary feedback: 180-320 ms
- strong result: 320-550 ms
- exceptional result: up to 800 ms
- no mandatory effect may delay the next valid gameplay action

Animations should prefer `transform` and `opacity`.

Layout-affecting animation is avoided unless there is a specific design need.

## 8. Button Feel

Shared interactive buttons should support the same tactile baseline.

On pointer/touch down:

- scale to approximately 0.96-0.98
- move down 1 px where appropriate
- slightly darken the surface
- strengthen the inner border or shadow

On release:

- rebound to 1.00
- avoid exaggerated spring motion for the dark-fantasy UI

Disabled controls:

- never animate as if activated
- never vibrate
- keep current accessibility semantics

A reusable class or component-level helper must provide this behavior without every screen creating custom keyframes.

## 9. Haptic Rules

V1 uses a safe browser adapter.

The adapter may use `navigator.vibrate` when available.

Suggested semantic mapping:

- subtle: 8-12 ms
- normal: 16-24 ms
- strong: short double pulse
- exceptional: compact staged pulse

Haptics are optional presentation. Unsupported devices receive no fallback error.

Haptics must never:

- participate in gameplay logic
- be awaited by RPC flows
- determine success
- break desktop browsers

## 10. Reduced Motion

The Game Feel layer must honor `prefers-reduced-motion: reduce`.

Reduced-motion mode:

- removes screen shake
- removes continuous spinning added by Game Feel
- replaces particle travel with opacity-only flashes
- shortens or removes large scale changes
- preserves state clarity
- preserves result text and color cues

Existing reduced-motion CSS in the project remains compatible.

## 11. Performance Budget

V1 uses CSS and lightweight DOM overlays only.

Do not add tsParticles, Motion, Framer Motion, or another animation package in V1.

Limits:

- no unbounded particle creation
- one active global flash at a time
- small fixed particle count per exceptional event
- expired feedback nodes are removed promptly
- no persistent requestAnimationFrame loop when idle
- Game Feel should add no network calls

If future profiling shows a need for Canvas/WebGL, that is a separate design decision.

## 12. Domain Recipes

### 12.1 Association Seal

`seal.roll.start`
- normal press feedback
- central seal pulls inward
- restrained pending pulse
- no result color

`seal.roll.result { step: 1 }`
- normal intensity
- small radial pulse
- new node lights up
- stage value pops once

`seal.roll.result { step: 2 }`
- strong intensity
- brighter radial ring
- stronger node ignition
- secondary light streak

`seal.roll.result { step: 3 }`
- exceptional intensity
- short anticipation beat
- gold/brass burst
- compact particles
- stronger haptic
- result panel receives brief emphasis

`seal.reset`
- inward collapse
- nodes dim from active to inactive
- neutral/dark pulse
- rebuild to stage 0
- must not look like failure or destruction

### 12.2 Equipment Enhancement

`enhancement.attempt`
- pressed -> pending transition
- item frame contracts slightly
- contained metallic pulse

`enhancement.result { outcome: 'SUCCESS' }`
- strong or exceptional depending on target level
- brass flash
- item frame impact
- target enhancement level pop

`FAIL_KEEP`
- subtle
- dull metal tap
- no celebratory glow

`FAIL_DOWNGRADE`
- strong negative feedback
- downward level motion
- restrained red/brown flash

`FAIL_DESTROY`
- strongest negative feedback used in V1
- brief anticipation
- fracture/fragment visual
- item visual disappears only in sync with actual authoritative state change
- no gore-like treatment

### 12.3 Combat

Combat feedback should stay fast because it repeats often.

`combat.basic-hit`
- normal localized impact
- target hit pulse
- no global screen shake

`combat.critical-hit`
- strong localized impact
- larger damage-number emphasis
- short camera-layer nudge only if reduced motion is off

`combat.player-damaged`
- subtle to strong according to damage class supplied by the caller
- player-side flash

`combat.guard`
- short defensive flash
- shield-like border response

`combat.heal`
- restrained upward glow
- no long particle trail

`combat.death`
- strong state transition
- avoid extended blocking animation

The battle screen must remain responsive and readable at increased speed settings.

### 12.4 Market

Market feedback is intentionally restrained.

`market.order-placed`
- subtle confirm press
- order row or summary briefly highlights

`market.order-cancelled`
- subtle fade/withdraw motion

`market.trade-partial`
- subtle progress emphasis

`market.trade-filled`
- normal result emphasis
- wallet/result values may pulse once

Market effects must not resemble loot-box or enhancement feedback.

## 13. Server Authority Boundary

Game Feel is downstream of gameplay decisions.

Required flow:

```text
input
 -> local press feedback
 -> RPC / authoritative action
 -> authoritative result
 -> apply state
 -> play result recipe
```

Forbidden flow:

```text
input
 -> client guesses result
 -> success/failure animation
 -> RPC confirms later
```

The feedback subsystem receives result data; it never computes result data.

## 14. Error Isolation

`feel.play()` must be safe to call from gameplay code.

A visual or haptic failure must not:

- reject an economy transaction
- interrupt battle resolution
- prevent save application
- alter RPC retry behavior
- throw through to the main interaction handler

Feedback execution should catch and contain presentation errors.

## 15. Accessibility

- Preserve native button semantics.
- Do not communicate a result by motion alone.
- Result text remains available to assistive technology.
- Reduced-motion support is mandatory.
- Disabled controls remain distinguishable without relying only on opacity where possible.
- Flash duration and frequency should remain restrained.

## 16. Repository Rulebook

Create `docs/game-feel/README.md` as the durable team rulebook.

It must contain:

- public event naming convention
- intensity scale
- timing budget
- button press rules
- server authority boundary
- reduced-motion requirements
- haptic policy
- performance limits
- recipe authoring checklist
- examples for Seal, Enhancement, Combat, and Market
- rule that new gameplay screens reuse the Game Feel layer instead of adding one-off global animation systems

This document is the canonical Game Feel style guide for future Tower Chronicles UI work.

## 17. Testing Strategy

Unit tests should verify:

- event names resolve to recipes
- invalid payloads degrade safely
- reduced-motion transforms recipes correctly
- haptic adapter does nothing when unsupported
- haptic adapter does not throw
- feedback queue expires commands
- error paths remain non-throwing

UI/source-level regression tests should verify:

- Seal uses semantic Game Feel events
- Enhancement uses semantic result events
- Combat uses shared feedback calls rather than private global animation code
- Market uses restrained shared feedback calls
- no screen introduces client RNG for result presentation
- reduced-motion CSS exists for the shared layer

Existing gameplay tests continue to prove gameplay rules independently.

## 18. Rollout

Implementation should proceed in phases:

1. Add Game Feel core, CSS tokens, Provider, hook, feedback layer, and rulebook.
2. Integrate Association Seal completely as the reference implementation.
3. Integrate Equipment Enhancement.
4. Integrate Combat with a deliberately low effect budget.
5. Integrate Market with restrained feedback.
6. Re-run full CI and production build after each integration group.

Each phase should preserve existing behavior if the Game Feel layer is disabled or unsupported.

## 19. Compatibility

The design is compatible with the current React 19 + TypeScript + Vite stack.

No save-schema change is required because Game Feel state is ephemeral.

No Supabase schema change is required.

No change to server-authoritative RNG, wallet, combat, market, or enhancement RPC contracts is required.

## 20. Acceptance Criteria

The subsystem is complete when:

- a shared `useGameFeel()` API exists
- the four domain recipe modules exist
- common button feel is reusable
- Seal uses the new layer end-to-end
- Enhancement, Combat, and Market have reusable recipe integration points
- reduced motion is honored
- haptics fail safely
- feedback errors cannot block gameplay
- no third-party animation dependency has been added
- `docs/game-feel/README.md` documents the canonical rules
- automated tests cover the shared subsystem
- full test, typecheck, and production build pass
