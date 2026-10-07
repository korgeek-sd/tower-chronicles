# Instant hunting
Approved reference: the user's vertical battle screenshot and Tower Chronicles mockup. A map button resolves one whole turn-based battle immediately. Display vitality, level/EXP, Silver, weapon mastery, player and monster cards, rewards, collapsible turn records. No realtime animation or job mechanics in this mode.

Initial balance: vitality cap 100, regeneration 1 per 300 seconds, cost 1 per battle including defeat. Full vitality discards overflow. Plains/forest/mine use existing monster art and increasing difficulty. Each fight starts at full HP; final HP is a receipt, not persistent injury. Available independent legacy skills run in saved slot order, with cooldowns; otherwise basic attack. No MP bar until an MP system exists. A 100-turn limit resolves as defeat.

Online: active gameplay lease required. Server owns vitality, EXP, mastery, RNG, equipment stats and rewards. Lock the account save, wallet and hunting state; retain request receipts for safe retries. Credit Silver and tier-1 material via existing economy bridge atomically. Reload restores last result. Guest mode uses isolated local hunting state and existing local save rewards.

Navigation: add Battle to the main navigation and immediate hunting to the primary camp action. Existing ongoing expeditions remain recoverable through existing routes; this does not delete prior account data or implement the entire future game redesign.

Validation: pure vitality and battle tests, rendered UI checks, PostgreSQL migration integration tests (including replay, no vitality, invalid map, lease validation), full suite, typecheck, production build. Commit exact tested source to GitHub.
