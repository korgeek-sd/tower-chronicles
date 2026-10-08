# Novar crafting workbench

The crafting screen uses a dark iron workbench, brass frames and distinct item artwork. The recipe picker, material slot, output preview, owned stock, base production, mastery bonus and costs all read the existing crafting data. The complete workbench fits without scrolling at 320×568 and larger tested viewports. Compact layouts place materials and output side by side, keep all five recipes in one row and combine quantity controls into a single row. On short screens with an error or pending receipt, optional explanatory details collapse so resources, output, quantity and the action remain visible.

## Components and references

- [BlockUI](https://github.com/malilion/BlockUI), MIT: `@malilion/block-ui-react` **0.6.1** supplies the actual `InventorySlot` and `ItemStack` components. Its stylesheet is imported by `CraftScreen`; the workshop overrides are scoped to `.tc-game-craft`. No BlockUI crafting mechanic or inventory state is used.
- [RPGUI](https://github.com/RonenNess/RPGUI): visual reference for inset framed panels and tactile buttons. No RPGUI source, textures or runtime is bundled.
- [game-ui-ux](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-ui-ux/SKILL.md): responsive containers, safe areas, focus navigation and modal flow.
- [game-feel](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/game-feel/SKILL.md): brief button response and an outcome-driven reveal.
- [create-game-assets](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md): one coherent icon family, checked at actual screen size.
- Local authority: `.agents/skills/tower-game-ui/SKILL.md` and `docs/game-feel/README.md`.

## Artwork provenance

`CraftItemArt.tsx` contains original code-authored SVG artwork, not copied game assets or generated raster images. All ten icons share a 64×64 view box, muted fills, brass/dark edges and an overhead light treatment: herb, pepper, potato, wheat, stone, potion, three foods and challenge ticket. Food motifs distinguish attack, defense and experience. SVG scales to the recipe and workbench slots; decorative artwork is hidden from assistive technology and item names stay in HTML.

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

Browser checks with a controlled UI fixture covered 320×568, 390×844, 520×740 and 1280×900: all five recipes and the whole workbench fit without scrolling, no horizontal overflow, touch targets, confirmation/Tab/Shift+Tab/Escape/focus return, pending controls, exact confirmed quantity, rejected outcomes and empty stock. These fixture checks do not claim live production login or backend access; SQL crafting regression tests separately exercise the server transaction rules.
