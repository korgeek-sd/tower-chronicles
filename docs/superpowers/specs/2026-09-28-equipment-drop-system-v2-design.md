# Tower Chronicles Equipment Drop System V2 Design

Date: 2026-09-28
Target repository: `korgeek-sd/tower-chronicles`
Starting point: main / v0.1.63
Status: Approved design

## 1. Goal

Replace the current crafted, tier-based four-slot equipment model with a drop-first, standardized equipment economy built around nine globally shared equipment identities.

The new loop is:

`tower combat -> equipment / enhancement stone drops -> safe return -> equip / sell / dismantle -> enhancement -> marketplace`

The system must preserve Tower Chronicles' server-authoritative economy and safe-return rule while removing randomized per-instance item stats. The marketplace must be easy to compare: the same equipment identity, grade, and enhancement level always has the same gameplay stats.

Equipment crafting is removed only after the replacement drop / dismantle / enhancement / marketplace loop is working end to end.

## 2. Migration policy

This is a development-stage reset of equipment, not a full account wipe.

Preserve:
- Silver
- Gold
- jobs / profession registration
- Association and Association Seal progression
- exploration and tower progression
- skills and skill books
- potions
- non-equipment account progression unless a later migration explicitly changes it

Reset / remove:
- all legacy equipment instances in player inventory
- all legacy equipped references
- legacy equipment in marketplace assets
- legacy equipment sell orders, escrow, and marketplace storage entries
- legacy crafted equipment jobs or unclaimed equipment outputs that could reintroduce old gear

After migration each player receives exactly one starter equipment item:
- grade: Common
- item: Association Supply Iron Sword
- enhancement: +0

All other equipment slots start empty.

The migration must be idempotent. Re-running the migration or reloading a migrated save must not duplicate starter equipment.

## 3. Equipment identities

All towers use one shared equipment pool. Towers do not have separate full equipment sets.

The nine canonical items are:

| Kind ID | Slot | Korean display name |
| --- | --- | --- |
| `association_supply_iron_sword` | weapon | 협회 보급 철검 |
| `outer_guard_longbow` | weapon | 외곽 경비대 장궁 |
| `archive_standard_arcane_staff` | weapon | 기록원 제식 마도봉 |
| `expedition_iron_helmet` | helmet | 원정대 철제 투구 |
| `return_corps_plate_armor` | armor | 귀환대 판금갑 |
| `mining_detail_reinforced_gloves` | gloves | 채굴반 강화 장갑 |
| `survey_corps_dust_boots` | boots | 탐사대 방진 장화 |
| `association_registration_tag` | necklace | 협회 등록 인식패 |
| `expedition_merit_ring` | ring | 원정 공적 반지 |

Legacy dagger equipment and the legacy passive accessory identities are removed from the equipment pool.

## 4. Slots

The new equipment slots are:

- weapon
- helmet
- armor
- gloves
- boots
- necklace
- ring

Weapon is one slot shared by sword, bow, and staff.

The equipment model does not expose Speed as an equipment stat. Existing combat pacing may continue to use internal timing values during migration, but no new equipment identity, grade multiplier, or enhancement modifier may grant Speed.

## 5. Item instance model

A persisted equipment instance contains identity, grade, and enhancement only, plus a unique instance ID needed for ownership and trading.

Conceptual shape:

```ts
interface EquipmentItem {
  id: string
  kind: EquipmentKind
  grade: EquipmentGrade
  enhancement: EnhancementLevel
}
```

Do not store randomized combat rolls, randomized affixes, quality percentages, sockets, durability, binding flags, or tower-specific stat variants in V2.

Two instances with the same `kind + grade + enhancement` are gameplay-equivalent.

## 6. Grades

The five grades are:

| Grade | Korean | Core stat multiplier |
| --- | --- | ---: |
| common | 일반 | 1.00 |
| uncommon | 고급 | 1.12 |
| rare | 희귀 | 1.26 |
| heroic | 영웅 | 1.42 |
| legendary | 전설 | 1.60 |

There is no Mythic grade in V2.

Base per-item combat stat values are intentionally not redesigned in this migration. The V2 implementation must centralize those values in one equipment-definition table so they can be balanced without changing persistence, enhancement, drop, or marketplace schemas.

## 7. Enhancement

Enhancement range is +0 through +10.

Core numeric equipment stats use these deterministic multipliers:

| Level | Bonus | Multiplier |
| ---: | ---: | ---: |
| +0 | 0% | 1.00 |
| +1 | 4% | 1.04 |
| +2 | 8% | 1.08 |
| +3 | 13% | 1.13 |
| +4 | 18% | 1.18 |
| +5 | 24% | 1.24 |
| +6 | 31% | 1.31 |
| +7 | 38% | 1.38 |
| +8 | 45% | 1.45 |
| +9 | 52% | 1.52 |
| +10 | 60% | 1.60 |

Final core stat calculation:

`base item stat * grade multiplier * enhancement multiplier`

Percentage utility properties, if used by an equipment identity, are defined by the canonical item definition and grade rules rather than random per-instance rolls.

## 8. Enhancement outcomes

Every enhancement button press produces exactly one unconditional outcome. Rates sum to 100%.

| Attempt | Success | Keep | Downgrade 1 | Destroy |
| --- | ---: | ---: | ---: | ---: |
| +0 -> +1 | 50% | 50% | 0% | 0% |
| +1 -> +2 | 65% | 32% | 2.8% | 0.2% |
| +2 -> +3 | 60% | 34% | 5.7% | 0.3% |
| +3 -> +4 | 55% | 34% | 10.5% | 0.5% |
| +4 -> +5 | 48% | 34% | 17.3% | 0.7% |
| +5 -> +6 | 40% | 33% | 26% | 1% |
| +6 -> +7 | 32% | 31% | 36% | 1% |
| +7 -> +8 | 24% | 27% | 47.5% | 1.5% |
| +8 -> +9 | 19% | 24% | 55% | 2% |
| +9 -> +10 | 10% | 23% | 64.5% | 2.5% |

Destroy permanently removes the equipment instance and clears any matching equipped reference.

No protection item, pity, recovery, inheritance, or failure-stack mechanic is added in V2.

## 9. Enhancement cost

Every attempt consumes Silver and Enhancement Stones regardless of outcome.

Legendary per-attempt Silver costs:

| Target | Silver |
| --- | ---: |
| +1 | 2,500 |
| +2 | 3,750 |
| +3 | 5,500 |
| +4 | 8,000 |
| +5 | 11,250 |
| +6 | 16,250 |
| +7 | 23,750 |
| +8 | 35,000 |
| +9 | 52,500 |
| +10 | 80,000 |

Grade base costs:

| Grade | Base |
| --- | ---: |
| common | 500 |
| uncommon | 750 |
| rare | 1,100 |
| heroic | 1,600 |
| legendary | 2,500 |

Enhancement stage factors are:
`1.0, 1.5, 2.2, 3.2, 4.5, 6.5, 9.5, 14, 21, 32`

Silver cost is `grade base cost * stage factor`, rounded to an integer using one shared rule on client and server.

## 10. Enhancement Stone

There is one universal tradable resource: `enhancement_stone` / 강화석.

Rules:
- usable by every equipment type and grade
- marketplace tradable
- never sold directly for Gold
- acquired from combat drops and dismantling
- consumed on every enhancement attempt
- not refunded on failure

Stone costs:

| Target | Stones |
| --- | ---: |
| +1 | 1 |
| +2 | 1 |
| +3 | 2 |
| +4 | 2 |
| +5 | 3 |
| +6 | 4 |
| +7 | 5 |
| +8 | 7 |
| +9 | 10 |
| +10 | 15 |

Dismantle yields:

| Grade | Stones |
| --- | ---: |
| common | 1 |
| uncommon | 2 |
| rare | 4 |
| heroic | 8 |
| legendary | 15 |

Dismantling enhanced equipment gives the grade yield only in V2. Enhancement level does not increase dismantle yield.

## 11. Early Iron Vein Spire drop table

The first implementation targets 철맥의 첨탑 floors 1 through 10.

Equipment drop chance is evaluated per defeated monster. If equipment drops, item identity and grade are rolled separately.

### Floor equipment availability

| Floor | Primary pool | Equipment chance | Grade range |
| ---: | --- | ---: | --- |
| 1 | sword / helmet / boots | 8% | common-uncommon |
| 2 | bow / armor / gloves | 9% | common-uncommon |
| 3 | staff / necklace / ring | 10% | common-rare |
| 4 | all 9 | 11% | common-rare |
| 5 | all 9 | 12% | common-rare |
| 6 | all 9 | 14% | common-heroic |
| 7 | all 9 | 16% | common-heroic |
| 8 | all 9 | 18% | uncommon-heroic |
| 9 | all 9 | 20% | uncommon-legendary |
| 10 | all 9 | 25% | uncommon-legendary |

### Normal-monster grade rates

| Floor band | Common | Uncommon | Rare | Heroic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1-2 | 85% | 15% | 0% | 0% | 0% |
| 3-5 | 70% | 24% | 6% | 0% | 0% |
| 6-7 | 55% | 30% | 12% | 3% | 0% |
| 8 | 0% | 65% | 27% | 8% | 0% |
| 9 | 0% | 55% | 32% | 12% | 1% |
| 10 | 0% | 48% | 34% | 16% | 2% |

### Monster identity weighting

Weights change item identity only, not grade.

- 고블린 광부: gloves 22%, boots 18%, sword 18%, each other item 7%
- 고블린 운반꾼: armor and necklace receive elevated weight
- 고블린 감독관: ring, helmet, and sword receive elevated weight
- 동굴쥐: boots and necklace receive elevated weight
- 광산박쥐: bow and staff receive elevated weight

For monster rows whose exact percentages are not separately listed above, use a deterministic weighted table where named favored items have equal elevated weight and remaining items share the remainder equally. Keep the weights in data, not combat code.

### Boss equipment

| Floor | Equipment drop | Grade distribution |
| ---: | ---: | --- |
| 6 boss | 60% | U 55 / R 35 / H 10 |
| 7 boss | 70% | U 45 / R 40 / H 15 |
| 8 boss | 80% | U 35 / R 43 / H 21 / L 1 |
| 9 boss | 90% | U 25 / R 45 / H 27 / L 3 |
| 10 boss | 100% | R 55 / H 38 / L 7 |

Boss equipment identity is selected from all nine items with equal weight in V2.

### Enhancement Stone combat drops

- normal monster: 15% chance for 1
- 고블린 감독관: 25% chance for 1
- floor 6-7 boss: 2-4 guaranteed
- floor 8-9 boss: 3-6 guaranteed
- floor 10 boss: 5-8 guaranteed

## 12. Safe-return semantics

Equipment and Enhancement Stones acquired during an expedition are temporary expedition loot.

They become owned marketplace/economy assets only after successful safe return.

Death discards expedition equipment and Enhancement Stones from that run, matching the existing loot-loss rule.

The client may present pending expedition loot, but it must not be inserted into authoritative owned assets before settlement.

## 13. Server authority

The server owns:
- equipment and grade drop RNG for online play
- Enhancement Stone drop RNG
- safe-return settlement of equipment and stones
- dismantle validation and stone credit
- enhancement RNG
- Silver / stone consumption
- downgrade / destruction
- marketplace ownership and escrow
- migration cleanup of legacy equipment

Client code owns presentation only.

For privileged Postgres RPCs, preserve the repository's current explicit session validation pattern. Any `security definer` function must use a fixed/empty `search_path`, schema-qualified relations, explicit execute revocation from `public` and `anon`, and explicit grant only to the intended role.

## 14. Marketplace identity

Equipment remains individually owned and individually traded because enhanced items can be destroyed and ownership requires instance IDs.

For browse / aggregation / price-history purposes, the canonical fungible comparison key is:

`kind + grade + enhancement`

No randomized stats are part of the key.

Enhancement Stones use a fungible asset key:
`other:enhancement_stone`

Legacy gear assets and orders are removed by migration so they cannot re-enter inventory.

## 15. Crafting removal

Do not remove crafting first.

Implementation order:
1. new equipment types and definitions
2. stat computation and slot model
3. equipment-reset migration
4. server-authoritative drop and safe-return settlement
5. Enhancement Stone asset
6. dismantling
7. +0 through +10 enhancement
8. marketplace compatibility
9. inventory / equipment / enhancement UI updates
10. end-to-end verification
11. remove equipment crafting recipes, UI paths, server RPC paths, and old equipment-material dependencies

Alchemy / potion crafting remains outside this equipment-removal scope.

## 16. UI requirements

Inventory:
- show Korean item name
- grade
- enhancement
- slot
- equipped state
- deterministic stat contribution
- dismantle action when allowed

Equipment screen:
- seven visible slots
- one-screen mobile layout
- no horizontal comparison spreadsheet
- preserve existing Tower Chronicles Game Feel patterns

Enhancement screen:
- +0 through +10
- exact success / keep / downgrade / destroy rates for the selected attempt
- Silver and Enhancement Stone costs
- current and next deterministic stat preview
- server result drives effects; no client RNG

Marketplace:
- equipment filters by kind, grade, enhancement
- identical key items are directly comparable
- no randomized-stat comparison UI

## 17. Compatibility boundaries

V2 intentionally removes compatibility with:
- dagger gear
- legacy armor / boots / passive-accessory gear identities
- tier-based equipment progression
- enhancement +0 through +3 schema
- tower-material enhancement costs
- equipment crafting

V2 preserves:
- safe-return philosophy
- existing server session lock
- server-owned wallet / market asset model
- server-authoritative market
- Game Feel presentation subsystem
- unrelated character progression

## 18. Testing requirements

At minimum, automated tests must prove:
- legacy equipment is reset once and starter sword is not duplicated
- seven-slot state validates
- all nine identities map to exactly one slot
- grade multipliers are deterministic
- enhancement multiplier table matches +0 through +10
- every enhancement outcome row sums to 1
- enhancement costs use Silver + Enhancement Stones
- downgrade floors at +0 and destruction removes/unequips the item
- dismantle yields exactly the grade table
- no equipment stat randomization exists
- Iron Vein Spire floor pools and grade bands match this spec
- dead expeditions do not settle equipment or stones
- successful return settles them exactly once
- online RNG and resource mutation remain server-authoritative
- marketplace grouping key is kind + grade + enhancement
- legacy gear cannot be listed or restored after migration
- full typecheck, test suite, and production build pass before release

## 19. Release strategy

Implement on a dedicated equipment-system branch from current main.

Do not label the feature complete until:
- migration is applied to the connected Supabase project
- client and server behavior agree
- existing accounts load after the equipment reset
- the starter sword appears exactly once
- at least one equipment drop can be earned, safely returned, dismantled, enhanced, and listed in the marketplace
- death correctly loses pending equipment and stones
- tests, typecheck, and production build are green

The first release after the replacement should be treated as an equipment-system migration release rather than a balance-complete release.
