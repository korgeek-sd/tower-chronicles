# Equipment Foundation Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-28-equipment-drop-system-v2-design.md`

**Goal:** Introduce the V2 equipment domain types, canonical nine-item data table, and seven equipment slots without yet changing drop RNG, enhancement RPCs, Supabase persistence, or combat stat formulas.

**Execution:** Native / inline.

## Global constraints

- Keep current save schema version at 22 for this foundation-only slice; no persisted migration is shipped here.
- Do not touch Supabase migrations in this slice.
- Do not remove legacy crafting/enhancement/combat behavior yet.
- New V2 equipment data must be deterministic and centralized.
- `Slot` becomes the seven-slot model: weapon, helmet, armor, gloves, boots, necklace, ring.
- Transitional legacy systems may retain their own legacy type aliases until their later migration task.

## Task 1: Add V2 equipment type contracts

**Files**
- Modify: `src/game/types.ts`
- Create: `tests/equipmentFoundation.test.ts`

**Interfaces**
- `EquipmentKind`: nine canonical IDs from the spec
- `EquipmentGrade`: common | uncommon | rare | heroic | legendary
- `Slot`: weapon | helmet | armor | gloves | boots | necklace | ring
- `EquipmentItem`: id, kind, grade, enhancement
- Keep legacy `Item` shape temporarily for un-migrated systems.

**RED**
- Test exact grade list and exact seven-slot list through exported runtime constants added in Task 2.
- Typecheck test fixture using all nine kind literals.

**GREEN**
- Add domain types with no legacy behavior removal.

## Task 2: Add canonical nine-item data and slot metadata

**Files**
- Create: `src/game/data/equipment.ts`
- Modify: `src/game/data/config.ts`
- Modify: `tests/equipmentFoundation.test.ts`

**Interfaces**
- `EQUIPMENT_GRADES`
- `EQUIPMENT_GRADE_MULTIPLIERS`
- `EQUIPMENT_SLOTS`
- `EQUIPMENT_DEFINITIONS`
- `equipmentDefinition(kind)`

Each of nine canonical equipment definitions includes:
- kind
- Korean name
- slot
- weapon family only for the three weapons
- placeholder/base stat object centralized for later balancing

The foundation must not expose Speed in equipment base stats.

**RED**
- 9 definitions, unique IDs, exact Korean names, exact slot mapping.
- 3 weapon items share weapon slot.
- remaining six items map one-to-one to the six non-weapon slots.
- no `speed` key appears in equipment base stats.
- grade multipliers exactly match spec.

**GREEN**
- Implement data table and slot labels.

## Task 3: Expand in-memory equipment references to seven slots

**Files**
- Modify: `src/game/engine/state.ts`
- Modify: `src/game/engine/presets.ts` if needed
- Modify: UI/components only where required for TypeScript compatibility
- Modify: tests that construct explicit legacy four-slot equipment records only as needed for compile compatibility
- Modify: `tests/equipmentFoundation.test.ts`

**Behavior**
- `initialState().equipped` has exactly seven keys.
- starter remains in weapon; six other slots are null.
- any new preset snapshot of `equipped` captures all seven keys.
- legacy accessory-specific gameplay is not migrated in this slice; where old code needs an accessory concept, isolate it behind a temporary legacy adapter rather than putting `accessory` back into `Slot`.

**RED**
- assert exact seven-key initial equipped object.
- assert preset snapshots preserve all seven keys.

**GREEN**
- make minimal compatibility updates required for typecheck.

## Verification

Run:
- `npm test -- equipmentFoundation` if the harness supports name filtering; otherwise `npm test`
- `npm run typecheck`
- `npm run build`

Then inspect diff for:
- no Supabase migration
- no drop/enhancement probability changes
- no randomized equipment stats
- no Speed stat in V2 equipment definitions
