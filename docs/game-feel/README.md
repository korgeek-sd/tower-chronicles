# Tower Chronicles Game Feel

This is the canonical interaction-feedback rulebook for Tower Chronicles. New gameplay screens reuse the shared `src/gameFeel` layer instead of creating a one-off global animation system.

## Event naming

Use semantic `domain.action` names. Screens report what happened; recipes decide how it feels. Current domains are `ui`, `seal`, `enhancement`, `combat`, and `market`.

## Intensity

Every recipe uses one of four levels: **subtle**, **normal**, **strong**, **exceptional**. Common repeated actions stay subtle/normal. Strong is reserved for meaningful outcomes. Exceptional is reserved for rare or milestone outcomes.

## Timing

Button compression is **60–90ms**. Ordinary feedback should finish in roughly 180–320ms, strong results in 320–550ms, and exceptional results in at most about 800ms. Effects must never delay the next valid gameplay action.

## Button feel

Interactive gameplay buttons use `tc-feel-press` / `data-game-feel="press"`: slight compression, a 1px downward response where appropriate, then quick recovery. Disabled controls must not look activated.

## Authority boundary

Game Feel is downstream of **server-authoritative** gameplay:

`input → local press feedback → RPC/action → authoritative result → apply state → result recipe`

Never guess a server result, run client RNG for presentation, or play success/failure feedback before the result exists.

## Reduced motion

Honor `prefers-reduced-motion: reduce`. Remove shake, traveling particles, and large bursts while preserving visible flashes, result text, and state changes.

## Haptics

`navigator.vibrate` is an optional adapter only. Capability-detect it, never await it, catch failures, and never make gameplay depend on vibration support.

## Performance

Keep feedback ephemeral and bounded. No idle requestAnimationFrame loop, no unbounded particle creation, no network calls, and no third-party animation dependency in V1. Prefer transform and opacity.

## Object-targeted feedback

V2 keeps semantic recipes global but lets each screen attach a short local class to the object that actually changed. Use this only for presentation: seal cores/nodes, enhancement panels, combat sprites, and trade summary regions may animate after the authoritative result is known. Local classes must not compute results or replace the semantic `feel.play()` event.

Prefer the object that changed over a full-screen shake. A critical hit belongs on the target sprite; an enhancement failure belongs on the equipment panel; a market fill belongs on the real trade summary. DEMO-only or speculative data must never trigger authoritative-result feedback.

## Domain recipes

### Association Seal
`seal.roll.start` communicates input/pending only. `seal.roll.result` uses the authoritative +1/+2/+3 result: normal/strong/exceptional. `seal.reset` is a neutral collapse/rebuild, not a failure.

### Enhancement
`enhancement.attempt` is pending feedback. `enhancement.result` consumes SUCCESS, FAIL_KEEP, FAIL_DOWNGRADE, or FAIL_DESTROY. Destruction is the strongest negative treatment, but item removal must come from actual gameplay state.

### Combat
Combat is deliberately restrained because it repeats quickly. Basic hit, critical hit, player damage, guard, heal, and death reuse shared recipes. Structured combat event IDs prevent duplicate replay.

### Market
Market feedback stays subtle/normal. Order placement/cancellation and trade state changes must use real online state. DEMO orderbook motion never counts as a real trade.

## Recipe authoring checklist

- Add a semantic event only when an existing event cannot express the outcome.
- Keep gameplay/RPC/storage imports out of recipe modules.
- Choose the lowest intensity that communicates the result.
- Provide a reduced-motion-safe visible cue.
- Keep duration bounded.
- Do not add client RNG.
- Do not add network or save side effects.
- Verify unsupported haptics cannot throw.
- Add a test before implementation.
- Reuse the shared layer; do not add a one-off global animation system.

## Failure isolation

`feel.play()` is presentation only. If visual or haptic feedback fails, the transaction, battle resolution, save application, and navigation continue normally.

### Combat sound and weapon signatures
Combat impact sound uses bounded Web Audio synthesis after confirmed damage or shield absorption. Unlock audio on a player gesture; blocked/unsupported audio remains silent and cannot block actions. The battle menu persists a separate sound toggle outside the game save. Stop active voices when leaving an encounter.

Critical hits hold only target presentation and impact particles for 55ms at normal playback speed, scaled with playback speed and disabled for reduced motion. Inputs, RPCs, HP, and turn timing continue normally. Equipped sword/dagger, bow, and staff select local slash, arrow, and energy trails; weapon signatures never schedule damage.
