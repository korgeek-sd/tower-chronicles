# Tower Chronicles UI Architecture

This branch applies a mobile-first UI architecture pass to Tower Chronicles without changing gameplay rules.

## Design references

- **game-ui-ux**: anchors/flow layout, safe areas, target-resolution verification, touch/focus behavior, screen hierarchy.
- **game-ui-design**: decision-first information hierarchy, complete states, inventory/equipment usability, feedback and accessibility.
- **LovecraftUi**: used only as a visual/composition reference for material surfaces, restrained motion, focus states, layered game UI and texture-like depth. The WebGL library itself is not integrated because Tower Chronicles is React/DOM-first and mobile-focused.
- **GameUIAgent**: used as a process reference for structured component hierarchy and iterative visual consistency, not as a runtime dependency.

## Tower Chronicles direction

The interface represents tools and records used by professional tower explorers rather than a modern dashboard.

Core material language:
- blackened iron and worn steel
- aged brass
- old leather
- dark wood / soot
- warm ivory text
- muted danger red and moss recovery green

The UI deliberately avoids glassmorphism, neon gradients, SaaS cards, glossy gacha chrome and oversized rounded rectangles.

## Mobile reference

Primary: **390×844**

Verification targets:
- 360×740
- 430×932
- minimum 320×640

Critical UI uses safe-area insets. Primary actions keep a minimum 44px touch target.

## Information hierarchy

- **Battle**: enemy/player state → intent/effects → actions → logs.
- **Workshop**: completed items → active craft → queue → recipe catalog.
- **Market**: item identity → current price/bid/ask → order book → order entry → history.
- **Inventory**: category/filter → item grid → selected-item detail.
- **Tower selection**: tower art/identity → progression → availability → expedition action.

## Implementation constraints

- Existing gameplay engines remain authoritative.
- UI reads existing state instead of duplicating gameplay state.
- Existing save schema remains unchanged.
- Existing pixel art remains pixelated and is framed by higher-resolution UI.
- Reduced-motion preferences disable nonessential motion.
- Korean text is the layout baseline.

## New UI layer

`src/ui-overhaul.css` is imported after legacy/component styles and acts as the shared presentation layer while the older UI is progressively decomposed into dedicated components.

The workshop is the first major screen extracted from `main.tsx` into a dedicated production component, including active work, queued jobs, completed-unclaimed output, explicit claiming and cancellation.