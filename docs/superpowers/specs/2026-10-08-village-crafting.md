# Village crafting and consumables

Extend the existing server-owned life flow. Herb towns craft potions, farm towns craft three foods, central city crafts all five products. Each craft costs 1 shared life AP and 10 input units. Herb produces 1000 one-HP potions; pepper/potato/wheat produce one attack/defense/experience food; split stone produces one challenge ticket. Batch 1..100; server atomically validates location, material and AP. Crafting never reduces shared gathering stock.

Shared crafting mastery gains 1 per action; every 100 mastery grants +1% production, capped +50%. Each action uses pre-action mastery. Per-product fractional carry is stored as hundredths, so split batches have identical yields. UI previews this exact loop and shows authoritative output after RPC.

Three foods grant PvE attack/defense/experience +10%, last 30 resolved instant hunts per unit, stack duration rather than strength, and can coexist. Consume from life inventory with no AP. Existing legacy expedition consumables remain separate until that old game mode is retired; these foods and potions affect the current instant hunting mode only.

Before combat, newly obtained potions also fill missing HP at current equipment maximum. Hunting persists current HP and automatically consumes exactly one potion per HP recovered after resolution, capped at maximum equipment HP. With insufficient potions, recover partially and preserve a minimum next-battle HP of 1. New hunting state and wells use NULL HP as full health at next authoritative equipment calculation. Every village has a free well, shared character cooldown 30 seconds. Instant hunting has no mana resource; no fictional mana bar or consumption is introduced.

Online equipment dismantling additionally awards dedicated split stones by equipment tier (1/3/6/10/15 for tiers 1..5) to the life materials inventory, preserving legacy enhancement stone rewards. Challenge tickets are stored, but trading and war consumption connect in the later market/occupation stage.

All craft/food/well requests have persisted UUID receipts. Replays return the existing result and fresh state even after travel; mismatched arguments fail. Frontend saves pending request before send, disables other mutations until recovery, and discards late responses on account/lease unmount. Private tables have deny-by-default RLS and no direct client grants; RPCs require verified active session, including non-null lease parameters. Lock order: session -> save -> wallet -> hunting -> life for hunting; well -> hunting -> life; craft/food only life. Never acquire save/wallet after taking hunting/life locks.

Verification: executable PGlite transactions cover craft cost/bonus/carry, specialties, rollback, daily reset, food duration and bonuses, potion shortages, receipt replay, well cooldown, dismantle materials and ACL. UI tests cover crafting limits, previews and persistent HP/food information. Run full tests, typecheck/build, inspect diff; deploy SQL then commit frontend to main and confirm CI/Pages.

## Unified inventory follow-up

The existing bag is the single inventory UI. It reads life material/product quantities directly from the same server inventory used by gathering, crafting and combat. Food use lives in the bag detail sheet; village life has only gathering and crafting, with a bag navigation shortcut. Remove the obsolete inventory catalog entries from the current bag (tower materials/tickets, old potion variants, skill books, appearance vouchers and old miscellaneous items). Modern equipment remains part of the newly planned equipment system. Historical save fields are not a second visible inventory and are never copied into the authoritative life inventory. Shared pending UUID recovery works across life and bag navigation.
