# Skill books and catalog learning

The shared catalog contains 60 active and 20 passive skills. Each has one stackable `skillbook:<skill_id>` item. Names and grades come from `src/game/skills/books.ts`; inventory, market labels and the skill tree share this mapping. The old three-slot battle kit is unaffected.

The skill tree reads `get_skill_book_state` under an active gameplay lease. Learning calls `learn_catalog_skill`: one matching book is consumed, ownership is recorded independently in `private.learned_catalog_skills`, and the canonical cloud save is persisted in the same transaction. The save and wallet lock order follows existing economy operations. Repeating a learned skill succeeds without consuming another book. Missing books, invalid skill IDs, lost leases and active expeditions are rejected. Failed persistence rolls back consumption and ownership. New tables are private, RLS enabled and inaccessible directly to player roles. RPCs require authenticated active lease ownership, with an empty search path.

The UI disables learning while loading, without books, after learning, in an expedition or without an online lease. Errors can refresh authoritative state. Async replies from a disposed/account-switched page are discarded. Server cloud revision metadata is remembered before updating client state. Inventory book actions lead to the skill tree rather than applying an offline consumption to online balances.

Validation: PGlite executes the migration against the existing interface fixture and checks all 80 catalog entries, consumption, replay, lease rejection, active expeditions, rollback and anonymous RPC denial. Render tests cover learning guards and image-free cards; inventory names/grades and legacy navigation remain covered.

This adds book registration, inventory/market naming, ownership, learning and enhancement. It does not add drop tables, automatic combat kits or six active/three passive loadout slots. No test books are granted by the migrations.

## Enhancement to +3

The skill detail shows the current level, the next effect amount and required/owned books and gold. A learned skill can be upgraded to +3 with guaranteed success: +1 consumes 2 books, +2 consumes 3, +3 consumes 5 of that exact skill. Including initial learning, reaching +3 needs 11 books. Base effect amounts increase by 5%, 10%, 15%; MP cost, trigger chance, durations, cooldowns and hit counts remain unchanged. Percent amounts retain two decimal places; fixed MP recovery rounds to the nearest integer. A zero base effect remains zero.

| Grade | +1 gold | +2 gold | +3 gold |
| --- | ---: | ---: | ---: |
| C | 500 | 1,000 | 2,000 |
| B | 1,000 | 2,000 | 4,000 |
| A | 2,000 | 4,000 | 8,000 |
| S | 4,000 | 8,000 | 16,000 |
| SR | 8,000 | 16,000 | 32,000 |
| SSR | 16,000 | 32,000 | 64,000 |

`enhance_catalog_skill` checks the active lease and ownership, then locks save → wallet → ownership → book balance. Books, gold, the private enhancement level and cloud save are changed atomically. The request carries the expected current level: replaying a completed stage returns fresh state without another charge; skipping ahead fails. +3, insufficient resources and an active expedition block new upgrades. Client-provided levels are replaced by `private.skill_progress_payload` inside the existing canonical economy function; save uploads and other economy actions cannot overwrite server levels. `skillEnhancements` is an optional version-23 field for old-save compatibility. The UI consumes authoritative snapshot levels and gold and disables repeated clicks while awaiting a response.

The 80 catalog skills still await combat-loadout integration. These enhanced catalog values are persisted and displayed, but this change does not retrofit them into the old three-slot combat kit.
