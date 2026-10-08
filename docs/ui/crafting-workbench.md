# Novar crafting workbench

The approved sixth concept is implemented as a Novar guild blueprint: a vertical five-recipe rail on the left and a large selected-product illustration on the right. A quiet charcoal/navy drawing grid and thin brass reference marks frame the actual existing pixel artwork. Product name, yield and owned stock lead the workspace; the material ledger, item effect, base/bonus breakdown and batch controls sit below it. The primary action stays along the bottom edge.

All labels and numbers are live HTML from the existing authoritative crafting state. The mockup is a design reference, never an image of the interface embedded in the game. Existing typefaces, muted colors, square frames and shared feedback keep the screen consistent with the rest of Tower Chronicles.

Container-based layout keeps the workbench inside the app shell, including 320×568 phones. On short screens, optional headings collapse; when an error/pending receipt takes space, the left rail becomes two columns so all five recipes retain 44px targets. The large illustration scales to the workspace's available width and height using CSS container units.

## Components and references

GitHub repository search for `pixel game ui react` surfaced BlockUI again. Its actual inventory components remain in use; the redesign applies the game-ui-ux responsive/focus guidance and the game-feel event-based feedback guidance. RPGUI is a frame/typography reference. No new UI dependency or external code was added for this redesign.

- [BlockUI](https://github.com/malilion/BlockUI), MIT: `@malilion/block-ui-react` **0.6.1** supplies the actual `InventorySlot` and `ItemStack` components. Its stylesheet is imported by `CraftScreen`; the workshop overrides are scoped to `.tc-game-craft`. No BlockUI crafting mechanic or inventory state is used.
- [RPGUI](https://github.com/RonenNess/RPGUI): visual reference for inset framed panels and tactile buttons. No RPGUI source, textures or runtime is bundled.
- [game-ui-ux](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md): responsive containers, safe areas, focus navigation and modal flow.
- [game-feel](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md): brief button response and an outcome-driven reveal.
- [create-game-assets](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md): one coherent icon family, checked at actual screen size.
- Local authority: `.agents/skills/tower-game-ui/SKILL.md` and `docs/game-feel/README.md`.

## Artwork provenance

`public/assets/ui/crafting/` contains ten generated PNG assets: herb, pepper, potato, wheat, stone, potion, three foods and challenge ticket. The art follows the existing `healing_lesser.png` potion's dark pixel-art style and the approved potato's weathered silver square frame. All assets omit tier badges. Original generated images were preserved outside the repository; approved copies are committed here.

`CraftItemArt.tsx` loads the assets through the existing relative `assetUrl` helper, so GitHub Pages subdirectories and the offline build resolve the same paths. Crafting selection, material/output previews, confirmation and reward use these assets, as do life items in the inventory grid and detail sheet. Artwork is decorative; accessible names remain in HTML. The attack food is displayed as **떡볶이**, with the existing `attack_food` ID, pepper recipe and PvE effect retained.

## Outcome and interaction rules

The existing RPC, request IDs, costs, mastery, save format and item effects remain authoritative. `WorldPage` forwards the successful RPC's request ID, product and `result.quantity` to the screen. Each new receipt can show one reward reveal; stock refreshes, failed requests, previews and remounting with an old receipt cannot invent a reward. Shared `ui.press` and `ui.confirm` feedback are presentation only.

Confirmation and reward use a native modal dialog with initial focus, first/last button Tab wrapping, Escape dismissal and focus return to the craft action. Buttons have at least 44px touch targets; reduced motion removes the reveal and progress travel. Progress is indeterminate rather than a fabricated completion percentage.

## Validation

```sh
npm ci
npm test
npm run build
node scripts/standalone.mjs
```

The Node test loader ignores CSS only during SSR tests; Vite continues to load real styles. `craftWorkbench.test.ts` exercises product selection, artwork, stock, yield breakdown, resource shortage, pending state and all five recipes and town restrictions. Every town shows potion, three foods and challenge ticket; a nonlocal selection explains its required town and offers travel to Novar through the existing travel RPC. Novar can produce all five types; specialty restrictions remain enforced by the server.

Browser checks with a controlled UI fixture covered 320×568, 390×844, 520×740 and 1280×900: all five recipes and the whole workbench fit without scrolling, no horizontal overflow, vertical recipe rail and scaled hero, touch targets, confirmation/Tab/Shift+Tab/Escape/focus return, pending controls, exact confirmed quantity, rejected outcomes and empty stock. These fixture checks do not claim live production login or backend access; SQL crafting regression tests separately exercise the server transaction rules.
