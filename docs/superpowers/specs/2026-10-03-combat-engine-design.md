# Tower Chronicles Combat Engine Design

Date: 2026-10-03
Status: Approved design for implementation planning
Scope: Core turn-based combat engine only. Job-specific skill kits are intentionally out of scope until this engine is implemented.

## 1. Goal

Tower Chronicles keeps its existing strict alternating-turn combat model:

`Player turn -> one player action -> Monster turn -> one monster action -> Player turn`

The engine must support 48+ jobs, multi-hit actions, reactions, shields, status effects, boss phases, and a four-slot builder-spender resource system without hard-coding job behavior into the central combat loop.

The selected architecture is an **action pipeline with an event queue**. Existing combat, effect, job, and monster-AI code should be reused where practical, while action resolution is refactored into smaller, testable resolvers.

## 2. Core Combat Model

### 2.1 Turn ownership

- Combat is fully turn based.
- A normal player turn grants exactly one action.
- A normal monster turn grants exactly one action.
- Player actions are:
  - Basic attack
  - Active skill 1
  - Active skill 2
  - Active skill 3
  - Healing potion
  - Flee attempt
- Reactions, counters, extra hits, passive follow-ups, and queued effects do not create a new normal turn.
- A counter does not consume the monster's normal turn.

### 2.2 Player active skill slots

Every job has:

- One basic attack
- Exactly three active skills

Each active skill is classified as one of:

- `GENERATOR`
- `NEUTRAL`
- `SPENDER`

The engine does not force every job to use one of each type. Job kits may mix these categories freely.

## 3. Four-Slot Combat Resource

### 3.1 Shared baseline

- Resource capacity is four slots.
- Combat starts at `0 / 4`.
- Resource is reset to `0 / 4` when the current combat ends.
- Resource never carries to the next monster encounter.
- Overflow is discarded.

### 3.2 Basic generation

Default rule:

- A successful basic-attack action generates `+1` resource.
- Generation is action based, not hit based.
- A multi-hit basic attack still generates only `+1` by default.
- An action that successfully connects but deals `0` HP damage because a shield absorbed it still counts as successful for resource generation.
- A true miss or immunity does not generate resource.

Jobs may add to or replace this baseline through explicit job rules.

### 3.3 Generator skills

- Generator skills perform their normal combat effect and then grant their configured resource amount.
- Resource gain is configured per skill and is not globally fixed to `+1`.
- Generator skills may deal damage, heal, apply buffs/debuffs, create shields, or perform other supported effects.
- Resource is granted only after the action has successfully executed.

### 3.4 Neutral skills

- Neutral skills do not change combat resource unless a job-specific passive explicitly does so.

### 3.5 Spender skills

All spender skills also have cooldowns.

Two spender modes are supported:

1. **Fixed cost**
   - Example: always consumes 2 resource.
2. **Variable cost**
   - Has `minCost` and `maxCost`.
   - Consumes as much currently available resource as possible up to `maxCost`.
   - The actual amount spent is passed into effect resolution.
   - Effects may vary by exact amount spent rather than using one forced formula.

Spender resource is deducted before the action resolves. It is not refunded if the action later fails because the attacker dies during a reaction chain.

## 4. Cooldowns

### 4.1 Semantics

`Cooldown N` means:

> After use, the skill is unavailable for the next N turns belonging to that actor.

Example for a player skill used on player turn 5 with cooldown 3:

- Turn 5: use skill
- Turn 6: unavailable
- Turn 7: unavailable
- Turn 8: unavailable
- Turn 9: available

Implementation should track a ready turn or equivalent exact expiry state rather than rely on a decrement scheme that can produce off-by-one errors.

### 4.2 Additional cooldown rules

- Player skill cooldowns advance only on player turns.
- Monster skill cooldowns advance only on monster turns.
- Cooldowns continue to advance while stunned.
- Cooldowns continue to advance while silenced.
- All combat skill cooldowns reset when combat ends.

## 5. Hit and Reaction Pipeline

### 5.1 Default hit behavior

- There is no persistent Accuracy stat.
- There is no persistent Evasion stat.
- Normal attacks and skills hit by default.
- `MISS` only occurs when a specific skill, buff, passive, or monster mechanic explicitly creates a miss/evasion outcome.

Supported resolution outcomes should include at least:

- `HIT`
- `MISS`
- `BLOCKED_BY_SHIELD`
- `IMMUNE`

### 5.2 Multi-hit actions

Each direct hit is resolved independently for:

- Critical hit
- Damage
- Shield absorption
- HP damage
- On-hit effects
- Reaction checks
- Death checks

A multi-hit attack remains one action for resource and turn purposes.

### 5.3 Counterattacks

- Counter checks occur per qualifying hit.
- Multi-hit attacks may trigger multiple counters.
- Extra hits may also trigger counters.
- Counter attacks are additional reaction actions and do not replace the monster's normal turn.
- Reaction attacks cannot themselves trigger another counter.
- This prevents infinite counter chains.

Example:

`Hit 1 -> enemy counter -> Hit 2 -> enemy counter -> Hit 3 -> enemy counter -> player action ends -> monster normal turn`

### 5.4 Death interrupts the chain

Death has higher priority than all remaining unresolved hit-chain work.

If the target reaches 0 HP:

- Remaining hits are canceled.
- Remaining extra hits are canceled.
- Pending counters from the dead actor are canceled.
- The dead actor does not counter the killing blow.

If the attacker dies during a counter:

- Remaining hits and extra hits from the original action are canceled.

## 6. Critical Hits

### 6.1 Player critical hits

Default player values:

- Critical chance: 5%
- Critical damage: 150%

Rules:

- Basic attacks may crit.
- Offensive active skills may crit.
- Each hit in a multi-hit action rolls crit independently.
- Crits do not increase combat-resource generation.
- Crit chance and crit damage may be modified by equipment, jobs, buffs, or debuffs.

### 6.2 Monster critical hits

- Monsters do not have random crits by default.
- Monster skills may explicitly be configured as crit-capable or guaranteed crits.

## 7. Direct Damage Formula

Tower Chronicles will use percentage-based defense reduction rather than flat subtraction.

### 7.1 Damage order

Direct damage resolves in this conceptual order:

1. Base attack value
2. Attack-stat buffs/debuffs
3. Action/skill multiplier
4. Outgoing-damage modifiers
5. Defense penetration
6. Percentage defense reduction formula
7. Critical multiplier
8. Incoming-damage modifiers
9. Shield absorption
10. HP damage

### 7.2 Defense formula

Use a tunable constant:

`damageAfterDefense = preDefenseDamage * DEFENSE_SCALE / (DEFENSE_SCALE + effectiveDefense)`

Initial value:

`DEFENSE_SCALE = 100`

Examples:

- Defense 0 -> 100% damage
- Defense 50 -> about 66.7%
- Defense 100 -> 50%
- Defense 200 -> about 33.3%
- Defense 300 -> 25%

Minimum direct HP damage after applicable calculations remains at least 1 when the hit reaches HP.

### 7.3 Defense penetration

- No permanent equipment Defense Penetration stat is added.
- Skills, passives, or effects may explicitly grant percentage defense penetration.
- `effectiveDefense = defense * (1 - penetrationRate)`
- Penetration is capped at 100%.
- Effective defense cannot go below 0.

### 7.4 No true damage

- There is no separate fixed/true-damage type.
- All direct attack damage uses the standard pipeline.
- A skill that functionally ignores defense may use 100% defense penetration.

## 8. Buff and Debuff Math

### 8.1 Same calculation group

Modifiers in the same group add together.

Examples:

- Attack +20% and Attack +30% = Attack +50%
- Attack +30% and Attack -15% = Attack +15%

Groups include at least:

- Attack
- Defense
- Outgoing damage
- Incoming damage
- Healing done/received

### 8.2 Different groups

Different calculation groups apply in their own calculation stages and therefore multiply across stages.

Example:

- Attack +30%
- Outgoing damage +20%

These are not merged into +50%; they modify different stages.

### 8.3 Reapplying the same effect

Tower Chronicles uses **duration extension only** for repeated applications of the same effect ID.

- No stack-count multiplication.
- No refresh-to-original-duration behavior.
- `remainingDuration += newDuration`
- Effect magnitude does not increase when duration is extended.

Different effect IDs may coexist and combine under their relevant calculation groups.

## 9. Status Effects

### 9.1 Supported control effects

V1 includes:

- `STUN`
- `SILENCE`
- `ROOT`

`DISARM` is explicitly excluded.

### 9.2 Stun

- The affected actor loses the entire normal turn.
- Player cannot basic attack, use active skills, use healing potion, or flee.
- Monster takes no normal action.
- Cooldowns still advance.
- Resource is retained.
- Turn-end damage, healing, overheal decay, and duration updates still occur.
- Stun cancels a monster's currently prepared/charged attack.

### 9.3 Silence

Player:

- Locks all three active-skill slots.
- Basic attack remains available.
- Healing potion remains available.
- Flee remains available unless rooted.

Monster:

- Cannot choose a new active skill or new prepared attack.
- Falls back to basic attack.
- An already prepared attack is not canceled by Silence and still fires on its scheduled monster turn.

### 9.4 Root

- Prevents fleeing.
- Does not block basic attacks, active skills, or potions.
- Future movement mechanics may explicitly opt into Root interactions.

### 9.5 Immunities

- Immunity is defined per effect and per monster, not solely by monster rank.
- Bosses are not globally immune to all control.
- Example capabilities:
  - `IMMUNE_TO_STUN`
  - `IMMUNE_TO_SILENCE`
- A monster may be immune to one control effect but vulnerable to another.

## 10. Shields

### 10.1 Shield lifetime

- Shields have no turn duration.
- Shields persist for the entire current combat unless fully depleted.
- All remaining shield is removed when combat ends.

### 10.2 Shield stacking

- New shield amounts add to the existing shield amount.
- Maximum total shield = 300% of the actor's maximum HP.
- Excess shield generation beyond the cap is discarded.

Example with max HP 1,000:

- Shield cap = 3,000
- Current shield 2,700 + new shield 800 -> 3,000

### 10.3 Damage absorption

- Direct damage consumes shield before HP.
- If shield fully absorbs the direct hit, HP damage is 0.
- If incoming direct damage exceeds shield, the shield becomes 0 and overflow reaches HP.

### 10.4 Shield and attached debuffs

For an attack that deals direct damage and carries an on-hit debuff:

- If shield absorbs the entire direct hit and HP damage is 0, the attached debuff is not applied.
- If any HP damage penetrates, the attached debuff may apply.

A direct non-damaging debuff is not blocked by shield.

### 10.5 Damage-over-time bypass

Damage-over-time effects ignore shield entirely and damage HP directly.

## 11. Damage Over Time and Regeneration

### 11.1 Turn-end timing

Effects tied to an actor resolve at the end of that actor's turn.

Player effects use player-turn timing. Monster effects use monster-turn timing.

### 11.2 Turn-end order

At turn end:

1. Damage over time
2. Death/revival check
3. If alive, regeneration/healing over time
4. Player overheal decay when applicable
5. Effect-duration reduction/removal
6. Turn transition

If damage over time reduces HP to 0, regeneration does not occur afterward.

### 11.3 Damage over time

- Poison, Bleed, Burn, and similar effects bypass shield.
- Different effect IDs may coexist.
- Reapplying the same effect ID extends duration only; damage magnitude does not stack.

### 11.4 Regeneration

- Regeneration affects HP only.
- It does not restore shield.
- It uses the normal healing rules described below.

## 12. Healing and Overheal

### 12.1 Healing criticals

- Skill-based healing may critically heal.
- Healing crit chance/damage can be modified through supported combat effects.
- Healing potions do not critically heal.

### 12.2 Healing modifiers

Healing can be increased or reduced through buffs/debuffs using the normal modifier-group rules.

### 12.3 Overheal

- Healing may raise current HP above maximum HP.
- Overheal is real HP for damage-taking purposes.
- Overheal is not converted into shield.

At the end of each player turn:

- Determine `excess = max(0, currentHp - maxHp)`.
- Remove 25% of the excess.
- Never reduce HP below max HP through this decay.

When combat ends:

- Any HP above max HP is removed.

## 13. Cleanse and Dispel

There is no Cleanse Potion.

The engine supports skill-based:

- `CLEANSE`: remove player debuffs
- `DISPEL`: remove monster buffs

Rules:

- Skills may remove a configured number of effects.
- Skills may target effect tags/categories.
- Removal is automatic by priority rather than manual UI selection.
- Combat resource, cooldown state, and shield are not normal cleanse/dispel targets.

Default cleanse priority:

`Stun > Silence > Damage-over-time > Stat reduction > Root > Other`

Tag-filtered cleansing first restricts the eligible set, then uses priority inside that set.

## 14. Healing Potion and Revival Potion

### 14.1 Healing potion

- Using one healing potion consumes the player's normal action.
- The monster receives its normal turn afterward.
- Cannot be used while stunned.
- Can be used while silenced.
- Can be used while rooted.
- No combat cooldown.
- Consumes actual inventory quantity.
- Maximum healing-potion uses per expedition: 5.
- The 5-use limit persists across all combats within that expedition.
- The usage counter resets when the expedition ends and a new expedition begins.
- Healing potions may overheal but do not critically heal.

### 14.2 Revival potion

- Revival potion is not a normal player action.
- It is offered only as a death interrupt.
- Declining revival ends the combat as a loss and ends the expedition.

## 15. Death and Revival

### 15.1 Death interruption

When an actor reaches 0 HP:

- Current unresolved action-chain work belonging to that actor is canceled as applicable.
- Remaining multi-hits are canceled.
- Remaining extra hits are canceled.
- Pending counters by the dead actor are canceled.
- A killed target never counters the killing hit.

### 15.2 Player revival

If the player uses a revival potion:

Maintain:

- Current combat
- Enemy HP
- Enemy combat state
- Player combat resource
- Player skill cooldowns
- Player beneficial buffs

Remove/reset:

- All player debuffs
- Poison/Bleed/Burn and other harmful effects
- Stun/Silence/Root
- Player shield -> 0

The revival HP amount remains a configurable game value.

### 15.3 Resume point after revival

The interrupted action chain does not resume.

- If the player died during the player's action because of a reaction/counter, revival continues to the monster's normal turn.
- If the player died during the monster's normal action, revival continues to the next player turn.
- If the player died from player-turn-end damage over time, revival continues to the monster turn.

## 16. Monster Actions and AI

### 16.1 Monster action types

Monster actions are classified as:

- `BASIC_ATTACK`
- `ACTIVE_SKILL`
- `PREPARED_ATTACK`
- `REACTION`

### 16.2 Prepared attacks

A prepared attack uses two monster turns:

1. Preparation/telegraph turn
2. Discharge on the next monster turn

Rules:

- Strong boss skills should use this mechanic frequently enough to create counterplay.
- Silence does not cancel an attack that is already prepared.
- Stun cancels a currently prepared attack.
- Killing the monster also cancels it.
- If a prepared attack is canceled by Stun, the stunned turn is lost; the monster chooses a new action on its following normal turn.

There is no generic physical-vs-spell classification in the combat engine.

### 16.3 AI decision order

Conceptual monster-turn flow:

1. Turn-start state processing
2. If stunned: skip normal action
3. If a prepared attack exists: discharge it unless already canceled
4. If silenced: basic attack
5. Evaluate forced patterns
6. Build eligible normal-action candidates from conditions and cooldowns
7. Choose among candidates by weight
8. Fallback to basic attack if none are available
9. Resolve the action
10. Resolve turn-end effects

### 16.4 Conditions

AI skill conditions may include:

- Monster HP ratio
- Player HP ratio
- Monster turn number
- Player shield presence/amount
- Presence/absence of specific effects
- Prior action
- Skill-use count
- Boss phase
- Combat-event flags

### 16.5 Forced patterns and weighted behavior

- Forced patterns override normal weighted choice when their conditions are met.
- Normal eligible skills use weighted selection.
- Basic attack may participate as a weighted fallback/default action.
- Optional `cannotRepeat`/repeat-limit data may prevent undesirable same-skill repetition when cooldown alone is insufficient.

## 17. Boss Phases

### 17.1 Phase triggers

Boss phase transitions may use:

- HP thresholds
- Monster turn counts
- Specific combat events
- AND / OR combinations of supported conditions

Examples of event triggers:

- Shield broken for the first time
- Player used revival
- Boss was stunned for the first time
- A prepared attack was interrupted
- Player reached 4 resource
- A specific skill was used N times
- A future summon/part was destroyed

### 17.2 Phase progression

- Phase progression is one-way.
- A boss never returns to an earlier phase because HP was healed.
- One-shot transition triggers are consumed after firing.
- Existing skill cooldowns do not reset on phase transition.

### 17.3 Phase effects

A phase may alter:

- Available skill set
- Skill weights
- Forced patterns
- Reaction behavior
- Prepared-attack frequency
- Effect immunities
- Attack/defense modifiers
- AI conditions
- Presentation hooks/dialogue

## 18. Combat Start and End Lifecycle

### 18.1 Expedition-scoped state that persists across combats

- Current player HP, capped to max HP at combat transition
- Equipment
- Job
- Healing-potion inventory quantity
- Revival-potion inventory quantity
- Healing-potion expedition usage count (0-5)
- Loot/items acquired
- Floor/progression
- Expedition event history

### 18.2 Combat-scoped state reset for each new monster

- Four-slot combat resource -> 0
- Shield -> 0
- Player combat buffs/debuffs
- Monster buffs/debuffs
- Stun/Silence/Root
- Poison/Bleed/Burn/Regeneration
- Reaction-preparation state
- Prepared attacks
- Extra-hit reservations
- All combat skill cooldowns
- Boss phase -> initial phase
- Boss/monster turn counter -> initial value
- One-shot combat flags
- Per-combat skill/action counters

### 18.3 Combat victory cleanup

When monster HP reaches 0:

1. Stop unresolved hit/reaction chain
2. Record victory and rewards/drop results
3. Remove player overheal above max HP
4. Clear shield
5. Reset combat resource
6. Clear combat buffs/debuffs and periodic effects
7. Clear reaction/prepared state
8. Reset combat cooldowns
9. Dispose monster AI/runtime state
10. Continue expedition flow

### 18.4 Combat defeat

- Player death opens revival decision when an applicable revival potion is available.
- Declining revival or having none available ends the combat as a loss and ends the expedition.

## 19. Event-Queue Architecture

### 19.1 Why this architecture

The existing combat engine already has turn state, effects, reactions, job hooks, monster AI, and combat events. The redesign should preserve those useful concepts while preventing `combat.ts` from becoming a single growing chain of special cases.

Action resolution should be broken into explicit stages and event entries.

### 19.2 Conceptual event flow

A skill action may emit work such as:

`ACTION_START`
-> `RESOURCE_SPEND`
-> `DIRECT_HIT`
-> `DAMAGE_RESOLUTION`
-> `DEATH_CHECK`
-> `ON_HIT_EFFECTS`
-> `REACTION_CHECK`
-> next `DIRECT_HIT`
-> `RESOURCE_GAIN`
-> `ACTION_END`
-> `TURN_END`

Not every event name must become a public type exactly as written; these names define required resolution boundaries.

### 19.3 Required engine units

The refactor should create or preserve clear units with one responsibility each:

- **Turn Engine**
  - Owns player/monster turn transitions and actor-turn counters.
- **Action Resolver**
  - Validates and starts basic attacks, skills, potions, and flee attempts.
- **Resource Engine**
  - Owns 0-4 resource state, generation, fixed spending, variable spending, and overflow.
- **Hit Resolver**
  - Owns hit outcome, per-hit crit, multi-hit progression, and extra-hit scheduling.
- **Damage Resolver**
  - Owns attack modifiers, penetration, defense formula, crit multiplier, and incoming modifiers.
- **Shield Resolver**
  - Owns shield gain, 300%-max-HP cap, absorption, and combat cleanup.
- **Effect Engine**
  - Owns buffs/debuffs, duration extension, periodic effects, cleanse/dispel priority, and immunity checks.
- **Reaction Engine**
  - Owns counter/extra-hit reactions and ensures reaction attacks cannot recursively generate counter chains.
- **Death Resolver**
  - Owns action-chain cancellation, death interrupt, revival state mutation, and resume point.
- **Monster AI**
  - Owns conditions, forced patterns, weighted choices, prepared attacks, and boss phase state.
- **Battle Lifecycle**
  - Owns combat initialization, victory cleanup, defeat cleanup, and expedition/combat state boundaries.

### 19.4 Queue cancellation rules

The queue must support explicit cancellation of unresolved work.

Examples:

- Target death cancels future hits, extra hits, and target counters.
- Attacker death cancels remaining hits and extra hits from its current action.
- Stun canceling a prepared attack removes that prepared discharge.
- Combat victory cancels all remaining combat action work before cleanup.

## 20. Data Model Direction

The implementation plan should evolve the current job and monster definitions rather than replace them wholesale.

Skill definitions need enough metadata to express:

- Skill category: Generator / Neutral / Spender
- Cooldown
- Resource gain or cost
- Fixed or variable spender behavior
- Hit count
- Damage multiplier(s)
- Defense penetration
- Effect applications
- Shield generation
- Healing
- Cleanse/dispel behavior
- Conditional branches based on actual resource spent

Monster definitions need enough metadata to express:

- Action type
- Cooldown/ready timing
- Conditions
- Weight
- Forced-pattern priority
- Prepared attacks
- Reaction rules
- Cannot-repeat/repeat limits
- Effect immunities
- Phase restrictions and phase transitions

## 21. UI Contract

This spec is primarily engine architecture, but the engine must expose enough state for the existing battle UI to render deterministically.

Required visible state includes:

- Current HP / max HP / overheal
- Current shield / shield cap
- Four combat-resource slots
- Three active-skill cooldown states
- Skill unusable reasons where needed (resource, cooldown, silence, etc.)
- Player and monster status effects
- Prepared monster attack/telegraph state
- Boss phase when relevant to UI
- Combat-event output for damage numbers, crits, shields, misses, immunity, counters, and healing

The existing four HUD status pips must no longer be used as a fake status-effect count when the new resource UI is implemented; the four-circle display is reserved for the real four-slot combat resource.

## 22. Testing Requirements

Implementation should be test-driven and add focused unit/integration coverage for at least:

### Turn and cooldown

- Strict alternating normal turns
- Cooldown N blocks exactly N future same-actor turns
- Cooldowns advance through Stun and Silence
- Combat-end cooldown reset

### Resource

- Basic attack grants +1 once per action
- Multi-hit basic still grants only +1
- Generator skill-specific gain
- Overflow discarded at 4
- Fixed spender pre-spend
- Variable spender exact amount spent
- No refund after death during reaction
- Combat-end resource reset

### Hits, counters, and death

- Multi-hit per-hit crit resolution
- Counter per qualifying hit
- Extra hits trigger counters
- Reaction attacks do not recursively trigger counters
- Killing blow prevents counter
- Attacker death cancels remaining hit chain

### Shield

- Additive shields
- 300%-max-HP cap
- Direct-damage absorption and overflow
- On-hit debuff blocked when shield absorbs 100% of direct hit
- Periodic damage bypasses shield
- Combat-end shield reset

### Effects

- Same effect extends duration without magnitude stacking
- Stun turn skip with cooldown progress
- Silence locks player skills only
- Silence forces monster basic attack unless prepared attack already exists
- Stun cancels prepared attack
- Root blocks flee
- Per-effect immunity
- Cleanse/dispel priority

### Periodic and healing

- DOT -> death check -> regen order
- DOT bypasses shield
- Healing crit behavior for skills
- Healing potion does not crit
- Overheal allowed
- 25% excess decay at player turn end
- Overheal removed at combat end

### Death/revival

- Current chain discarded on player death
- Revival retains resource/cooldowns/buffs
- Revival clears player debuffs and shield
- Resume point depends on death context
- Decline revival ends expedition

### Monster AI and phases

- Prepared-attack telegraph/discharge
- Forced pattern wins over weighted behavior
- Weighted candidate selection
- Phase transition via HP
- Phase transition via turn count
- Phase transition via event
- One-way phase progression
- No cooldown reset on phase transition

## 23. Explicit Non-Goals for This Engine Pass

Do not add these while implementing this design unless separately approved:

- Real-time or auto-attack combat
- Persistent Accuracy/Evasion stats
- Disarm status
- Physical-vs-spell damage taxonomy
- True/fixed damage type
- Permanent equipment defense-penetration stat
- Cleanse potion
- Job-specific skill balance numbers for all 48 jobs
- Full skill-kit design for all jobs

## 24. Implementation Principle

The implementation must preserve the player's core mental model:

> One normal action per side, predictable turn ownership, visible cooldowns, a four-slot builder-spender resource, and tactical exceptions expressed through explicit effects rather than hidden random rules.

Job skills should become data that the combat engine resolves, not new special cases added to the central combat loop.
