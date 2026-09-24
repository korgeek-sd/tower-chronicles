# Tower Chronicles Mobile UI Rebuild

This UI is a from-scratch mobile presentation layer. It does not load the legacy UI styles, pixel UI sheets, navigation art, item icons, tower backgrounds, event illustrations, or other decorative game assets.

## Runtime asset rule

Allowed image assets:
- player character sprites
- monster / boss sprites

Not used by the rebuilt runtime UI:
- UI texture sheets
- navigation icons
- inventory / equipment icons
- currency icons
- tower background art
- event illustrations
- decorative panels
- externally sourced UI images

Everything outside character and monster rendering is built from CSS, typography, borders, layout, text, and simple glyphs.

## Reference skills

The implementation uses principles from:

- game-ui-ux — responsive containers, safe areas, device-aware layouts, focus and input clarity.
- game-ui-design — decision-first hierarchy, complete states, management-screen comparison, game-world identity.
- game-ui-frontend — browser-game UI that avoids dashboard patterns and protects the playfield.
- game-feel — restrained state feedback and reduced-motion support.
- game-playtest — mobile viewport, HUD obstruction, input, and responsive QA criteria.
- LovecraftUi — visual/composition study only; no runtime dependency, code, textures, or icons are imported.
- GameUIAgent — structured hierarchy and iterative design-process reference only; no runtime dependency.

## One-screen mobile rule

The document is the viewport.

- html, body, and #root do not page-scroll.
- The app shell is exactly 100dvh.
- Standard screens have fixed top status chrome, one contained main region, and fixed bottom navigation.
- Long collections use pagination, tabs, filters, drawers, or modal sheets instead of vertical page scrolling.
- Battle and field events use the entire viewport and hide the standard shell chrome.

Primary design target: 390×844.

Additional constraints:
- 360×740
- 430×932
- minimum 320×640

## Visual language

The game interface is treated as an Association expedition instrument rather than an app dashboard.

- soot-black / dark iron base
- restrained aged-brass accent
- warm parchment text
- muted status colors
- hard edges and thin rules
- very little rounding
- compact serif display type + plain Korean UI type
- no gradient-purple AI aesthetic
- no glassmorphism
- no glossy gacha storefront treatment
- no repeated oversized cards

## Screen hierarchy

- Home: explorer dossier → stats → expedition action → compact secondary tools.
- Tower board: four tower decisions at once.
- Expedition prep: floor choice → danger stats → bag/preset tab → enter.
- Battle: sprites/playfield → HP/intent/effects → six combat actions; details live behind one overlay.
- Inventory: controls → 4×3 item grid → pager → detail sheet.
- Marketplace: product/order decision table → paged lists; item detail combines compact book and order entry.
- Workshop: completion/current job/queue → field/tier → three recipes → pager/mastery footer.
- Enhancement: paged equipment list + probability/cost preview in the same viewport.
- Bestiary: tower selector → 2×3 monster grid → pager → record overlay.
- Jobs, association, cosmetics, skills, saves: fixed-capacity or paged views.

## Gameplay boundary

The rebuild replaces presentation, not game rules.

- current save schema remains unchanged
- combat and RNG remain in existing engines
- crafting jobs and timestamps remain authoritative
- marketplace matching and escrow remain authoritative
- enhancement odds/costs remain authoritative
- item/tower/job data remain authoritative

The UI reads those systems and does not create a second gameplay state machine.