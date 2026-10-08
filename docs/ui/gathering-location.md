# Gathering location UI

Approved direction: concept 3, a location scene above one selected gathering panel.

- Herb towns show a herb garden; farm towns show farmland. Novar switches between both through resource buttons.
- The header shows the real town and server action points. The scene shows its owner. Stock, inventory, tax and reset time come from the existing village state.
- Keep existing 1/10/100 batches and direct quantity input, 10 base materials per action point, and random pepper/potato/wheat farming. No selectable crop outcomes or new mining resources are added.
- Only the existing gathering callback submits requests. Results display the confirmed WorldPage message; pending disables resource selection and gathering.
- Keep inventory/map navigation. Well and manual stock-refresh controls are removed from this screen; automatic refresh stays in WorldPage. Empty material inventories display zero.
- Reuse crafting item sprites, brass frames and press feedback. Controls retain 44px touch targets, focus outlines and reduced-motion support.
- The scene uses the remaining grid row. Resource tabs occupy a separate 44px row below the scene. Fixed control rows and compact styles prevent overlap; both screen and app scrolling stay disabled. Results wrap within two reserved lines.

Backgrounds are generated environment art in `public/assets/backgrounds/gathering/`: a misty medieval herb garden and dusk farmland, without interface text or characters. WebP encoding preserves the generated composition.

Verification: render tests for both local specialties, authoritative stats, shortage/pending states and removal of utility controls; full repository tests; TypeScript/build; standalone generation. Browser rendering and a signed-in live gathering transaction require separate verification.
