---
name: tower-game-ui
description: Use when changing Tower Chronicles gameplay UI, HUD, overlays, persistent buttons, mobile sheets, menus, or when an interface element obscures combat, exploration, or touch controls.
---

# Tower Chronicles Game UI

## Principle
Gameplay has priority over utility UI. Persistent secondary controls stay reachable without occupying combat space, and immersive screens reduce their visual weight automatically.

## Read First
Before editing, inspect the relevant component and CSS plus `docs/game-feel/README.md`. Check whether the screen runs under `tc-battle-mode` or `tc-event-mode`; those modes use a wider 620px immersive shell while normal mobile screens use 520px.

## Layout Rules
- Put persistent non-critical controls on a screen/app edge, not over the central play field or primary action bar.
- Keep touch targets at least 44×44px even when the visible treatment is compact.
- In battle/event modes, compact and de-emphasize secondary controls; restore full emphasis on hover/focus/open state.
- Keep unread/state information as a small badge instead of enlarging the control.
- Respect `env(safe-area-inset-*)` and the app shell edge on narrow and wide screens.
- Prefer existing colors, borders, typography and CSS variables over new one-off visual systems.

## Interaction Rules
- Preserve existing keyboard focus, `aria-*`, Escape handling and focus return behavior.
- Use opacity/transform for short presentation changes and provide a `prefers-reduced-motion` fallback.
- Do not solve a placement problem by changing networking, server authority, game state, save data, cooldowns, or chat message behavior.
- Opening a utility sheet may cover gameplay; the closed persistent entry must not.
- When a persistent utility control is user-repositionable, keep tap/click as the primary action and use a deliberate long press before drag begins. Cancel the long press if the pointer moves first, snap released controls to a safe app edge, and store presentation-only placement outside the game save.

## Implementation Workflow
1. Add or update a regression test before production UI changes and verify it fails for the intended reason.
2. Make the smallest component/CSS change that satisfies the behavior.
3. Run the focused test, then typecheck/build or let repository CI run the full suite when local dependencies are unavailable.
4. Inspect the final diff for unrelated gameplay or data changes.

## Chat Entry Pattern
The world-chat entry starts on the right edge. Normal screens use the 520px app edge. Battle/event screens use the 620px immersive edge, compact to 44×44px, reduce opacity while idle, and keep the unread badge visible. A short tap opens chat. Holding for 500ms enters drag mode, provides a light capability-detected vibration, follows the pointer, and snaps to the nearest left/right app edge on release. Normal and immersive vertical positions are stored independently in local storage, never in the game save. The chat sheet, realtime connection, draft, channel and send logic stay unchanged.

## Reference
Adapt game-HUD principles from the external `game-ui-designer` skill, but use this repository's existing React/CSS architecture and `docs/game-feel/README.md` as the authority for implementation.
