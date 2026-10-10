---
name: tower-balance
description: Use when balancing Tower Chronicles player stats, level growth, skill rotations, hunting monsters, XP/silver rewards, vitality/potions, equipment tiers, drops or progression. Always run reproducible seeded analyses and distinguish live server values from hypotheses. Never deploy numeric changes from analysis alone.
---

# Tower Chronicles Balance — dedicated agent skill

## Mission
Design and validate numerical balance for this mobile, instant-result hunting RPG. The deliverable is a reproducible comparison of player builds, gear assumptions, monsters, combat turns, survival, recovery resources and rewards — **not** an assertion based on one average. This analysis skill NEVER silently edits production game numbers or database records.

## Read the actual game rules first
1. Read 'AGENTS.md' and this skill.
2. Read 'src/game/hunting/model.ts' (levels, point allocation, battle order, cooldowns, damage formula, vitality, recovery), 'src/game/hunting/encounters.ts', 'src/game/hunting/equipmentDrops.ts', 'src/game/data/equipment.ts', 'src/game/data/config.ts', and 'src/components/hunting/HuntingPage.tsx'.
3. Read the **latest** SQL implementations of public.hunt_once, private.combat_equipment_stats, private.hunting_damage, private.refresh_hunting_state and the stat allocation RPCs from 'supabase/migrations/'. Later migrations replace earlier definitions. When possible check the live functions through Supabase; don't mistake an old migration for production.
4. Examine 'tests/huntingStatAllocation.test.ts', 'tests/huntingProgression.test.ts', 'tests/huntingSilver.test.ts', 'tests/huntingEquipmentDrops.test.ts' and relevant PGlite tests.
5. Record game commit SHA and label each claim **verified live / modeled estimate / unverified / design proposal**.

## Required modules
1. **Level 1–100 player power**: currently 1 assignable point per level from Lv2; Lv100=99 points; HP +12 per point, ATK +1, DEF +2, critical +2 percentage points, max 10 critical points, 60% stat-allocation critical ceiling. Do NOT invent automatic passive stat growth. Validate XP thresholds and unspent points.
2. **Build comparisons**: balanced, all-round offense, survival/defense, critical build; maintain identical gear and levels for fair comparisons. Include low-level starter and high-level unspent-point edge cases.
3. **Equipment range**: starter, undergeared, standard (explicit *assumption*, not measured median) and optimistic. Derive the seven-slot fixed stats from actual catalog, and never assume unimplemented enhancement bonuses or realistic high rarity without evidence.
4. **Monsters and regions**: plains 1–19, forest 20–39, mine 40–59, fortress 60–79, ruins 80–100; monster art/identity and live map-wide stats are different. Individual monster variations are only proposed unless server and guest engine implement them.
5. **Battle physics**: use actual 'resolveHunt' for offline trials. Respect skill order heavy/guard/quick, 3/4/2-turn cooldowns, guard at 50% HP, 100-turn cap, crit chance/damage, penetration, defense formula, death. Compare with **server SQL** before claiming production parity.
6. **Potion, food, vitality and crafting economy**: 100 vitality, recovery 1 point per 5 min, potion +1 HP, pre- and post-battle auto use, HP1 safety, well 30s cooldown, foods 30 hunts (10% ATK/DEF/XP); consider 100 continuous fights, limited stock, action points, 1000 potions per base crafting action. A 288/day regeneration rate is theoretical, not guaranteed consumption.
7. **XP, silver and loot**: XP and silver per vitality including defeats, gear drop by grade in millionths **per victory**, uniform equipment kind, duplicate value, and expected acquisition dates using explicit wins and hunts/day. Higher region must not silently have lower *absolute* common rarity probability.
8. **Regression and optimization**: monotone XP thresholds, point caps, ability/build dominance checks, transition cliffs, probability sanity, known seeds and sample size; compare baseline and candidates without changing the source game.

## Simulator
The persistent runner imports existing TypeScript gameplay functions. Its seeded experiments are repeatable and **read-only**. Candidate JSON temporarily overrides local battle values and restores them in a finally block; production server, saves, and in-game monster balance are untouched.

    npm run balance:hunting -- --runs 1000 --levels 1,20,40,60,80,100 --maps recommended --format table
    npm run balance:hunting -- --mode endurance --runs 200 --levels 20,40,60,80,100 --potions 1000 --format csv
    npm run balance:hunting -- --candidate scripts/balance/candidate.example.json --runs 2000 --levels 20,40 --maps forest,mine --format json

Options: --runs, --seed, --levels, --builds, --gears, --maps, --mode (duel or endurance), --potions, --food, --candidate, --format (table/json/csv).
Direct runner: node --import ./tests/register.mjs scripts/balance/huntingBalance.ts.

**Interpretation constraints:** The runner uses guest-core resolveHunt with authored fixed gear profiles; it is NOT a replay of server inventory, live seal bonuses, market trades or real-player distributions. There is no production SQL mutation. Its duel mode resets before each fight, endurance mode carries HP and potions across 100 vitality. Candidate simulation is hypothetical until the client and live SQL both agree.

## Procedure
1. **Capture baseline** at levels 1/10/20/30/40/50/60/70/80/90/100 and 19→20, 39→40, 59→60, 79→80 boundaries. Include the four builds and three gear tiers. Run duel and 100-fight endurance separately.
2. **Name the goals** as product hypotheses until the user confirms them: desired win rate, average/p90 fight turns, potions per 100 vitality, XP/silver per vitality, viable build differences, and gear supply. No universal win-rate target is assumed.
3. **Test sensitivities**: zero potion, constrained potion, various equipment tiers, attack/defense food, alternative maps, no stat spending and critical cap. Verify that failure returns no XP/silver, and identify unsafe assumptions.
4. **Tune a separate candidate** by changing a coherent subset of monster HP/ATK/DEF at a time. Run candidate and baseline on the exact same ordered seed set. Inspect differences, bad RNG outcomes, and transition cliffs before proposing.
5. **Verify compatibility**: representative simulated combat traces should agree with latest SQL combat behavior. If game code/SQL is being changed, run unit tests, PGlite server tests, typecheck and build; failures block production acceptance.
6. **Report** a table with version/SHA, level, four builds, gear assumptions, map, monster HP/ATK/DEF, win rate, number of trials, mean/p90 turns, potions/100 vitality, XP and silver/vitality, expected gear probabilities/days, tradeoffs, and unresolved risks. Keep candidate numbers visibly separate from implemented values.

## Mandatory safeguards
- No stat build should dominate win rate, XP/vitality AND potion efficiency in all scenarios. Specialized builds need meaningful, situational upsides.
- Do not remove the reward advantage of harder hunting areas accidentally. Compare **net efficiency** after defeats and consumables, not advertised XP alone.
- Don't infer '30 days to legendary' without success rate, rarity per victory, and active hunts/day. Include 50th/90th percentile delay where useful.
- Never label client-only predictions as production data.
- A request for **analysis only** is not permission to update Supabase, commit new monster stats or deploy numerical changes.
- If the user explicitly requests production implementation, update both guest and server rules, add regression tests, then commit and verify CI and Pages/Supabase deployment.

## Skill assets
- Runnable tool: 'scripts/balance/huntingBalance.ts'
- Example hypothetical monster changes: 'scripts/balance/candidate.example.json'
- Automated checks: 'tests/huntingBalanceTool.test.ts'
- Scenario/metric reference: 'references/analysis-contract.md'
- Method references: https://github.com/Yuki001/game-dev-skills/tree/main/skills/game-balance-analysis ; https://github.com/nitzangames/headless-game-balance ; https://github.com/NVlabs/Skill2Env
