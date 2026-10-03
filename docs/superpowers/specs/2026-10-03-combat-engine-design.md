# Tower Chronicles Combat Engine Design

Date: 2026-10-03  
Status: Approved design for implementation planning  
Scope: Core turn-based combat engine. Job-specific skill kits and final balance numbers are intentionally deferred until this engine is implemented.

## 1. Goal

Tower Chronicles keeps a strict alternating-turn model:

`Player turn -> one player action -> Monster turn -> one monster action -> Player turn`

The engine must support 48+ jobs, multi-hit actions, reactions, shields, status effects, boss phases, and a four-slot builder-spender resource without hard-coding individual job behavior into the central combat loop.

The selected architecture is an **action pipeline with an event queue**. Existing turn, effect, job, reaction, combat-event, and monster-AI concepts should be reused where practical while action resolution is split into small, testable units.

## 2. Core Combat Model

### 2.1 Turn ownership

- Combat is fully turn based.
- A normal player turn grants exactly one action.
- A normal monster turn grants exactly one action.
- Player actions are: basic attack, active skill 1, active skill 2, active skill 3, healing potion, or flee attempt.
- Reactions, counters, extra hits, passive follow-ups, and queued effects do not create a new normal turn.
- A counter does not consume the monster's normal turn.

### 2.2 Player action kit

Every job has:

- One basic attack
- Exactly three active skills

Each active skill is one of:

- `GENERATOR`
- `NEUTRAL`
- `SPENDER`

The engine does not force a fixed mix. Jobs may use any combination of the three categories.

## 3. Four-Slot Combat Resource

### 3.1 Baseline

- Capacity: 4.
- Every combat starts at `0 / 4`.
- Resource resets to `0 / 4` when that combat ends.
- Resource never carries to the next monster.
- Overflow is discarded.

### 3.2 Basic attack generation

Default rule:

- A successful basic-attack action grants `+1` resource.
- Generation is action based, not hit based.
- A multi-hit basic attack still grants only `+1` by default.
- If at least one hit resolves as a successful hit, including a hit fully absorbed by shield, the basic-attack action counts as successful.
- If every hit resolves as `MISS` or `IMMUNE`, the action grants no resource.
- Jobs may explicitly add to or replace this baseline.

### 3.3 Generator skills

- A Generator performs its normal combat effects and then grants its configured resource amount.
- Gain is configured per skill and may be `+1`, `+2`, etc., up to the four-slot cap.
- Generators may damage, heal, buff, debuff, create shields, or perform other supported effects.
- For an offensive Generator, at least one hit must resolve successfully for its normal resource grant unless that skill explicitly defines a different success rule.
- For a non-offensive Generator, successful execution of its configured effect is sufficient.
- Resource is granted after successful execution, not before.

### 3.4 Neutral skills

- Neutral skills do not alter combat resource unless a specific passive or effect explicitly does so.

### 3.5 Spender skills

All Spenders also have cooldowns.

Supported modes:

1. **Fixed cost** — consumes a fixed amount.
2. **Variable cost** — has `minCost` and `maxCost`, consumes as much currently available resource as possible up to `maxCost`, and passes the actual amount spent into effect resolution.

Variable Spenders may define different effects for 2/3/4 resource rather than being forced into one formula.

Spender resource is deducted before the skill resolves. It is never refunded because the attacker later dies during a reaction chain.

## 4. Cooldowns

`Cooldown N` means the skill is unavailable for the next N turns belonging to that actor.

Example: player uses a cooldown-3 skill on player turn 5.

- Turn 5: use
- Turn 6: unavailable
- Turn 7: unavailable
- Turn 8: unavailable
- Turn 9: available

Implementation should track an exact ready turn or equivalent expiry state to avoid off-by-one behavior.

Additional rules:

- Player cooldowns advance only on player turns.
- Monster cooldowns advance only on monster turns.
- Cooldowns continue to advance while stunned.
- Cooldowns continue to advance while silenced.
- All combat cooldowns reset when combat ends.

## 5. Hit Outcomes and Multi-Hit Resolution

### 5.1 Accuracy/evasion policy

- No persistent Accuracy stat.
- No persistent Evasion stat.
- Normal attacks and skills hit by default.
- `MISS` occurs only when an explicit skill, buff, passive, or monster mechanic creates it.

Supported hit outcomes include at least:

- `HIT`
- `MISS`
- `BLOCKED_BY_SHIELD`
- `IMMUNE`

### 5.2 Per-hit resolution

Each direct hit independently resolves:

- Hit outcome
- Critical roll
- Damage
- Shield absorption
- HP damage
- Death check
- On-hit effects
- Reaction checks

A multi-hit attack is still one normal action for turn and baseline resource purposes.

## 6. Counters, Extra Hits, and Death Priority

### 6.1 Counter rules

- Counter checks occur per qualifying hit.
- Multi-hit attacks may trigger multiple counters.
- Extra hits may also trigger counters.
- Counters are reaction actions and never replace the monster's normal turn.
- A reaction attack cannot itself trigger another counter.
- This prevents counter-to-counter recursion.

Example:

`Hit 1 -> counter -> Hit 2 -> counter -> Hit 3 -> counter -> player action ends -> monster normal turn`

### 6.2 Killing blow and chain cancellation

Death has higher priority than unresolved hit-chain work.

If the target reaches 0 HP:

- Remaining hits are canceled.
- Remaining extra hits are canceled.
- Pending counters from the dead actor are canceled.
- The dead actor does not counter the killing blow.

If the attacker dies during a counter:

- Remaining hits and extra hits from the original action are canceled.

## 7. Critical Hits

### 7.1 Player

Defaults:

- Critical chance: 5%
- Critical damage: 150%

Rules:

- Basic attacks may crit.
- Offensive active skills may crit.
- Multi-hit actions roll crit per hit.
- Crits do not increase resource generation.
- Equipment, jobs, buffs, and debuffs may modify crit chance/damage.

### 7.2 Monsters

- Monsters do not have random crits by default.
- A monster skill may explicitly allow crits or be configured as a guaranteed crit.

## 8. Direct Damage Formula

Tower Chronicles uses percentage-based defense reduction rather than flat subtraction.

### 8.1 Calculation order

1. Base attack value
2. Attack-stat buffs/debuffs
3. Action/skill multiplier
4. Outgoing-damage modifiers
5. Defense penetration
6. Percentage defense reduction
7. Critical multiplier
8. Incoming-damage modifiers
9. Shield absorption
10. HP damage

### 8.2 Defense formula

`damageAfterDefense = preDefenseDamage * DEFENSE_SCALE / (DEFENSE_SCALE + effectiveDefense)`

Initial tuning value:

`DEFENSE_SCALE = 100`

Examples:

- Defense 0 -> 100% damage
- Defense 50 -> about 66.7%
- Defense 100 -> 50%
- Defense 200 -> about 33.3%
- Defense 300 -> 25%

When a direct hit reaches HP, minimum direct HP damage remains at least 1 after applicable calculations.

### 8.3 Defense penetration

- No permanent equipment Defense Penetration stat.
- Skills, passives, and effects may explicitly provide percentage penetration.
- `effectiveDefense = defense * (1 - penetrationRate)`
- Penetration is capped at 100%.
- Effective defense cannot go below 0.

### 8.4 No true damage

- No separate true/fixed-damage type.
- All direct attack damage uses the standard pipeline.
- A skill that functionally ignores defense may use 100% defense penetration.

## 9. Buff and Debuff Math

### 9.1 Same group

Modifiers in the same calculation group add together.

Examples:

- Attack +20% and Attack +30% -> Attack +50%
- Attack +30% and Attack -15% -> Attack +15%

Groups include at least:

- Attack
- Defense
- Outgoing damage
- Incoming damage
- Healing done/received

### 9.2 Different groups

Different calculation groups apply at their own stages and therefore multiply across stages. Attack +30% and outgoing damage +20% are not combined into one +50% modifier.

### 9.3 Reapplying the same effect

Repeated application of the same effect ID uses **duration extension only**:

- No magnitude stacking.
- No refresh-to-original-duration behavior.
- `remainingDuration += newDuration`.
- Effect magnitude remains unchanged.

Different effect IDs may coexist and combine under their relevant calculation groups.

## 10. Control Status Effects

V1 includes:

- `STUN`
- `SILENCE`
- `ROOT`

`DISARM` is excluded.

### 10.1 Stun

- The affected actor loses the entire normal turn.
- Player cannot basic attack, use active skills, use healing potion, or flee.
- Monster takes no normal action.
- Cooldowns still advance.
- Player resource is retained.
- Turn-end periodic damage/healing, overheal decay, and duration updates still occur.
- Stun cancels a monster's currently prepared attack.

### 10.2 Silence

Player:

- Locks all three active skill slots.
- Basic attack remains available.
- Healing potion remains available.
- Flee remains available unless rooted.

Monster:

- Cannot choose a new active skill or new prepared attack.
- Falls back to basic attack.
- An already prepared attack is not canceled and still discharges on schedule.

### 10.3 Root

- Prevents fleeing.
- Does not block basic attack, active skills, or potions.

### 10.4 Immunity

- Immunity is defined per effect and per monster, not solely by rank.
- Bosses are not globally immune to all control.
- A monster may be immune to Stun while remaining vulnerable to Silence, or vice versa.

## 11. Shields

### 11.1 Lifetime and accumulation

- Shields have no turn duration.
- They persist for the current combat until depleted.
- New shield amounts add to the current shield amount.
- Maximum total shield is 300% of that actor's max HP.
- Excess generation is discarded.
- All remaining shield is removed when combat ends.

Example with max HP 1,000:

- Shield cap = 3,000.
- Current shield 2,700 + 800 -> 3,000.

### 11.2 Absorption

- Direct damage consumes shield before HP.
- If shield absorbs the entire direct hit, HP damage is 0.
- If direct damage exceeds shield, shield becomes 0 and overflow reaches HP.

### 11.3 Shield versus debuffs

For a direct-damage attack carrying an on-hit debuff:

- If shield absorbs the entire direct hit, the attached debuff is not applied.
- If any HP damage penetrates, the attached debuff may apply.

A non-damaging direct debuff is not blocked by shield.

Damage-over-time effects bypass shield entirely.

## 12. Periodic Damage and Regeneration

Effects resolve at the end of the affected actor's turn.

Turn-end order:

1. Damage over time
2. Death/revival check
3. If alive, regeneration/healing over time
4. Player overheal decay when applicable
5. Effect duration reduction/removal
6. Turn transition

If damage over time reduces HP to 0, regeneration does not occur afterward.

Periodic rules:

- Poison, Bleed, Burn, and similar DOT bypass shield and damage HP directly.
- Different effect IDs may coexist.
- Reapplying the same effect ID extends duration only; magnitude does not stack.
- Regeneration affects HP only and never restores shield.
- Regeneration ticks use the source's normal healing rules and may critically heal when that source is allowed to crit-heal.

## 13. Healing and Overheal

### 13.1 Healing criticals and modifiers

- Skill-based healing may critically heal.
- Regeneration sourced from a crit-capable healing effect may critically heal per tick.
- Healing crit chance/damage may be modified by supported combat effects.
- Healing potions never critically heal.
- Healing can be increased or reduced through buffs/debuffs.

### 13.2 Overheal

- Healing may raise current HP above max HP.
- Overheal is real HP for damage-taking purposes.
- Overheal is never converted to shield.

At the end of each player turn:

- `excess = max(0, currentHp - maxHp)`
- Remove 25% of `excess`.
- This decay never reduces HP below max HP.

When combat ends, any HP above max HP is removed.

## 14. Cleanse and Dispel

There is no Cleanse Potion.

The engine supports skill-based:

- `CLEANSE`: remove player debuffs
- `DISPEL`: remove monster buffs

Rules:

- Skills may remove a configured count.
- Skills may target effect tags/categories.
- Removal is automatic by priority rather than manual UI selection.
- Combat resource, cooldown state, and shield are not normal cleanse/dispel targets.

Default Cleanse priority:

`Stun > Silence > Damage-over-time > Stat reduction > Root > Other`

A tag-filtered Cleanse first restricts the eligible set, then applies priority within that set.

## 15. Healing Potion and Revival Potion

### 15.1 Healing potion

- Consumes the player's normal action.
- Monster receives its normal turn afterward.
- Cannot be used while stunned.
- Can be used while silenced.
- Can be used while rooted.
- Has no combat cooldown.
- Consumes actual inventory quantity.
- Maximum uses per expedition: 5.
- The 5-use counter persists across all combats in that expedition.
- The counter resets only when the expedition ends and a new expedition begins.
- Healing potion may overheal but never crit-heals.

### 15.2 Revival potion

- Not a normal player action.
- Offered only as a death interrupt.
- Declining revival ends combat as a loss and ends the expedition.

## 16. Death and Revival

### 16.1 Death interruption

When an actor reaches 0 HP:

- Current unresolved hit-chain work is canceled as applicable.
- Remaining multi-hits are canceled.
- Remaining extra hits are canceled.
- Pending counters by the dead actor are canceled.
- A killed target never counters the killing hit.

### 16.2 Player revival state

If the player uses a Revival Potion, maintain:

- Current combat
- Enemy HP and enemy combat state
- Player combat resource
- Player skill cooldowns
- Player beneficial buffs

Remove/reset:

- All player debuffs
- Poison/Bleed/Burn and other harmful effects
- Stun/Silence/Root
- Player shield -> 0

Revival HP amount remains a configurable game value.

### 16.3 Resume point

The interrupted action chain never resumes.

- Death during the player's action from a counter/reaction -> after revival, continue to the monster's normal turn.
- Death during the monster's normal action -> after revival, continue to the next player turn.
- Death from player-turn-end DOT -> after revival, continue to the monster turn.

## 17. Monster Actions and AI

### 17.1 Action types

- `BASIC_ATTACK`
- `ACTIVE_SKILL`
- `PREPARED_ATTACK`
- `REACTION`

### 17.2 Prepared attacks

A prepared attack uses two monster turns:

1. Preparation/telegraph
2. Discharge on the next monster turn

Rules:

- Strong boss skills should use telegraphs to create counterplay.
- Silence does not cancel an already prepared attack.
- Stun cancels an already prepared attack.
- Killing the monster cancels it.
- When Stun cancels preparation, that stunned monster turn is lost; a new action is chosen on the following normal monster turn.
- There is no generic physical-vs-spell taxonomy.

### 17.3 AI decision order

1. Turn-start state processing
2. If stunned: skip normal action
3. If a prepared attack exists: discharge it
4. If silenced: basic attack
5. Evaluate forced patterns
6. Build eligible normal-action candidates from conditions and cooldowns
7. Select by weight
8. Fallback to basic attack if no candidate exists
9. Resolve action
10. Resolve turn-end effects

### 17.4 Supported AI conditions

May include:

- Monster HP ratio
- Player HP ratio
- Monster turn number
- Player shield presence/amount
- Presence/absence of effects
- Prior action
- Skill-use count
- Boss phase
- Combat-event flags

### 17.5 Forced patterns and weighted behavior

- Forced patterns override normal weighted choice when eligible.
- Normal eligible skills use weighted selection.
- Basic attack may participate as a weighted fallback/default.
- Optional `cannotRepeat` or repeat-limit data may prevent undesirable repetition when cooldown alone is insufficient.

## 18. Boss Phases

### 18.1 Transition triggers

Boss phases may transition from:

- HP thresholds
- Monster turn counts
- Specific combat events
- AND / OR combinations of supported conditions

Example event triggers:

- Shield broken for the first time
- Player used revival
- Boss was stunned for the first time
- Prepared attack was interrupted
- Player reached 4 resource
- Specific skill used N times
- Future summon/part destroyed

### 18.2 Progression rules

- Phase progression is one-way.
- Healing the boss never returns it to an earlier phase.
- One-shot transition triggers are consumed after firing.
- Existing skill cooldowns do not reset on phase transition.

### 18.3 Phase effects

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

## 19. Combat Start and End Lifecycle

### 19.1 Expedition-scoped state that persists across combats

- Current player HP, capped to max HP at combat transition
- Equipment
- Job
- Healing-potion inventory
- Revival-potion inventory
- Healing-potion expedition usage count `0-5`
- Loot/items acquired
- Floor/progression
- Expedition event history

### 19.2 Combat-scoped state reset for each new monster

- Four-slot resource -> 0
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
- Monster turn counter -> initial value
- One-shot combat flags
- Per-combat skill/action counters

### 19.3 Victory cleanup

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

### 19.4 Defeat

- Player death opens the revival decision when an applicable Revival Potion is available.
- Declining revival or having none available ends combat as a loss and ends the expedition.

## 20. Event-Queue Architecture

### 20.1 Resolution model

Action resolution is represented as explicit pipeline work rather than one growing special-case function.

Conceptual flow:

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

The implementation may choose different exact event type names, but these resolution boundaries must remain explicit and independently testable.

### 20.2 Engine units

- **Turn Engine** — turn transitions and actor-turn counters.
- **Action Resolver** — validates and starts basic attacks, skills, potions, and flee attempts.
- **Resource Engine** — 0-4 resource, generation, fixed/variable spending, overflow.
- **Hit Resolver** — hit outcome, per-hit crit, multi-hit progression, extra-hit scheduling.
- **Damage Resolver** — attack modifiers, penetration, defense formula, crit multiplier, incoming modifiers.
- **Shield Resolver** — additive shield, 300%-max-HP cap, absorption, combat cleanup.
- **Effect Engine** — buffs/debuffs, duration extension, periodic effects, Cleanse/Dispel priority, immunity.
- **Reaction Engine** — counters/extra-hit reactions and prevention of recursive counter chains.
- **Death Resolver** — chain cancellation, death interrupt, revival mutation, resume point.
- **Monster AI** — conditions, forced patterns, weighted choice, prepared attacks, boss phases.
- **Battle Lifecycle** — combat initialization, victory/defeat cleanup, expedition/combat state boundaries.

### 20.3 Queue cancellation

The queue must support explicit cancellation of unresolved work:

- Target death cancels future hits, extra hits, and target counters.
- Attacker death cancels remaining hits/extra hits from that action.
- Stun removes a prepared discharge.
- Combat victory cancels all remaining combat-action work before cleanup.

## 21. Data Model Direction

Evolve current job and monster definitions rather than replacing them wholesale.

Player skill data must be able to express:

- Generator / Neutral / Spender category
- Cooldown
- Resource gain or cost
- Fixed/variable spender behavior
- Hit count
- Damage multipliers
- Defense penetration
- Effect applications
- Shield generation
- Healing
- Cleanse/Dispel behavior
- Conditional branches based on actual resource spent

Monster data must be able to express:

- Action type
- Cooldown/ready timing
- Conditions
- Weight
- Forced-pattern priority
- Prepared attacks
- Reaction rules
- Repeat restrictions
- Effect immunities
- Phase restrictions/transitions

## 22. UI Contract

The engine must expose deterministic battle state for the existing UI:

- Current HP / max HP / overheal
- Current shield / shield cap
- Four combat-resource slots
- Three active-skill cooldowns
- Skill unusable reasons where needed: resource, cooldown, Silence, etc.
- Player/monster status effects
- Prepared monster attack/telegraph state
- Boss phase where relevant
- Combat events for damage numbers, crits, shield absorption, misses, immunity, counters, and healing

The existing four HUD status pips must no longer represent an artificial status-effect count once this redesign lands. The four-circle display is reserved for the real four-slot combat resource.

## 23. Testing Requirements

Implementation is test-driven and must cover at least:

### Turn/cooldown

- Strict alternating normal turns
- Cooldown N blocks exactly N future same-actor turns
- Cooldowns advance through Stun/Silence
- Combat-end cooldown reset

### Resource

- Basic attack grants +1 once per successful action
- Multi-hit basic with at least one successful hit grants only +1
- Multi-hit basic with all hits MISS/IMMUNE grants 0
- Generator skill-specific gain and success criteria
- Overflow discarded at 4
- Fixed spender pre-spend
- Variable spender exact amount spent
- No refund after death during reaction
- Combat-end reset

### Hit/reaction/death

- Multi-hit per-hit crit resolution
- Counter per qualifying hit
- Extra hits trigger counters
- Reaction attacks do not recursively trigger counters
- Killing blow prevents counter
- Attacker death cancels remaining hit chain

### Shield

- Additive shield
- 300%-max-HP cap
- Direct absorption and overflow
- On-hit debuff blocked on 100% shield absorption
- DOT bypasses shield
- Combat-end reset

### Effects

- Same effect extends duration without magnitude stacking
- Stun skips action while cooldown progresses
- Silence locks player active skills only
- Silence forces monster basic attack unless a prepared attack already exists
- Stun cancels prepared attack
- Root blocks flee
- Per-effect immunity
- Cleanse/Dispel priority

### Periodic/healing

- DOT -> death check -> regeneration order
- DOT bypasses shield
- Skill heal crits
- Crit-capable regeneration ticks
- Healing potion never crits
- Overheal allowed
- 25% excess decay at player turn end
- Overheal removed at combat end

### Death/revival

- Current chain discarded on death
- Revival retains resource/cooldowns/buffs
- Revival clears player debuffs and shield
- Resume point depends on death context
- Declining revival ends expedition

### Monster AI/phases

- Prepared telegraph/discharge
- Forced pattern overrides weighted behavior
- Weighted candidate selection
- Phase transition by HP
- Phase transition by turn count
- Phase transition by event
- One-way progression
- No cooldown reset on phase transition

## 24. Explicit Non-Goals

Do not add these in this engine pass unless separately approved:

- Real-time or auto-attack combat
- Persistent Accuracy/Evasion stats
- Disarm
- Physical-vs-spell damage taxonomy
- True/fixed damage type
- Permanent equipment Defense Penetration stat
- Cleanse Potion
- Final balance numbers for all jobs
- Full skill-kit design for all 48 jobs

## 25. Implementation Principle

The player's mental model must remain:

> One normal action per side, predictable turn ownership, visible cooldowns, a four-slot builder-spender resource, and tactical exceptions expressed through explicit effects rather than hidden random rules.

Job skills should become data that the combat engine resolves, not new special cases added to the central combat loop.
