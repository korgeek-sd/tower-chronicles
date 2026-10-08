# Gathering location UI

Approved direction: concept 3, a location scene above one selected gathering panel.

- Herb towns show a herb garden; farm towns show farmland. Novar switches between both through resource buttons.
- The header shows the real town and server action points. The scene shows its owner. Stock, inventory, tax and reset time come from the existing village state.
- Keep existing 1/10/100 batches and direct quantity input, 10 base materials per action point, and random pepper/potato/wheat farming. No selectable crop outcomes or new mining resources are added.
- Only the existing gathering callback submits requests. Results display the confirmed WorldPage message; pending disables resource selection and gathering.
- Keep inventory/map navigation, well recovery/cooldown, and stock refresh. Empty material inventories display zero.
- Reuse crafting item sprites, brass frames and press feedback. Controls retain 44px touch targets, focus outlines and reduced-motion support.
- The scene uses remaining vertical space. Compact rules preserve controls on shorter screens; internal overflow is a safety fallback for error banners and wrapped results. App-level scrolling stays disabled.

Backgrounds are generated environment art in `public/assets/backgrounds/gathering/`: a misty medieval herb garden and dusk farmland, without interface text or characters. WebP encoding preserves the generated composition.

Verification: render tests for both local specialties, authoritative stats, shortage/pending states and cooldown; full repository tests; TypeScript/build; standalone generation. Browser rendering and a signed-in live gathering transaction require separate verification.
