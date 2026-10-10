# Skill books and catalog learning

The shared catalog contains 60 active and 20 passive skills. Each has one stackable `skillbook:<skill_id>` item. Names and grades come from `src/game/skills/books.ts`; inventory, market labels and the skill tree share this mapping. The old three-slot battle kit is unaffected.

The skill tree reads `get_skill_book_state` under an active gameplay lease. Learning calls `learn_catalog_skill`: one matching book is consumed, ownership is recorded independently in `private.learned_catalog_skills`, and the canonical cloud save is persisted in the same transaction. The save and wallet lock order follows existing economy operations. Repeating a learned skill succeeds without consuming another book. Missing books, invalid skill IDs, lost leases and active expeditions are rejected. Failed persistence rolls back consumption and ownership. New tables are private, RLS enabled and inaccessible directly to player roles. RPCs require authenticated active lease ownership, with an empty search path.

The UI disables learning while loading, without books, after learning, in an expedition or without an online lease. Errors can refresh authoritative state. Async replies from a disposed/account-switched page are discarded. Server cloud revision metadata is remembered before updating client state. Inventory book actions lead to the skill tree rather than applying an offline consumption to online balances.

Validation: PGlite executes the migration against the existing interface fixture and checks all 80 catalog entries, consumption, replay, lease rejection, active expeditions, rollback and anonymous RPC denial. Render tests cover learning guards and image-free cards; inventory names/grades and legacy navigation remain covered.

This adds book registration, inventory/market naming, ownership and learning. It does not add drop tables, automatic combat kits, six active/three passive loadout slots or enhancement actions. No test books are granted by the migration.
