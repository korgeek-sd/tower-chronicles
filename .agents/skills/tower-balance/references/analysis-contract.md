# Tower Chronicles balance analysis contract

## Source authority
- Production: active SQL functions for online combat, recovery, drop and economy. Verify the latest applied migration and, if possible, active Supabase definitions.
- Offline: 'src/game/hunting/model.ts::resolveHunt', six combat stats and 'src/game/data/equipment.ts'.
- Equipment: authored grade presets are **scenarios**, not factual gear availability or median inventory.

## Scenario matrix
| Dimension | Baseline | Stress test |
| --- | --- | --- |
| Levels | 1,10,20,30,40,50,60,70,80,90,100 | 19/20,39/40,59/60,79/80,99/100 |
| Build | balanced, offense, defense, critical | unspent / 10-point crit |
| Gear | under, standard, high | starter at endgame; legendary only as theoretical ceiling |
| Opponent | recommended 1 of 5 areas | one area below and above |
| Skill order | heavy, guard, quick | altered legal preset |
| Food | none | ATK, DEF, XP; concurrent where supported |
| Potion stock | 10000 for unconstrained upper-bound | 0 or realistic limited inventory |
| Runs | independent full-HP duel | 100-vitality sequential endurance |
| RNG | fixed repeated seeds | separate exploratory seeds |

Standard gear is a hypothetical level schedule, not observed real-user median.

## Report metrics
- Win rate (=victories / attempts), death/timeout; with confidence interval where feasible (Wilson binomial interval).
- Mean and p90 battle turns; separate loss/victory distributions if very different.
- HP damage lost during battle, potions used in pre/post auto recovery, under-healed starts and remaining potions.
- XP/vitality and silver/vitality **including failures**, not just reward on win; multiply by 100 for a 100-vitality comparison with identical repeated trials.
- Expected equipment per victory by map/rarity and per attempt = win probability × rarityRate / 1,000,000.
- Geometric drop expectation: average attempts until one item = 1/p, P(>=1 by N attempts) = 1-(1-p)^N, days = expected attempts / explicit active hunts/day. Separate different equipment kind probabilities, duplicates and incomplete collections.
- Same-level same-gear build performance, including resource budget; region transition success and effective efficiency.

## Numerical quality
- >=1,000 independent trials per representative scenario when making win-rate claims. Use more for rare losses and very high win rates. Zero recorded defeats is not proof of 100% guaranteed victory.
- Use fixed paired seed sets for baseline vs candidate, and separate fresh exploration seeds afterwards; forked RNG consumption may still differ between paths.
- Compare entire distributions and p90, not only the arithmetic mean. Report worst cases, guardrails violated, and small sample sizes.
- Confirm one damage/skill-turn example by hand with the actual combat function.
- Count battle attempts and actual costs separately. Under high potion budgets, win rate is an optimistic ceiling.

## Diagnoses
1. Attack dominates all routes: it can both shorten fights and reduce potion consumption. Test defensive niches and damage thresholds.
2. Defense dominates: slow battles and few potions may make defense optimal. Check fight cap and reward efficiency.
3. HP has poor value under +1HP potion recovery: compare extra survival vs marginal crafting cost.
4. Abrupt transition: map unlock milestone assumes equipment statistically unavailable at that point. Mark unsupported equipment assumptions.
5. Dead zone: a higher map returns less XP/vitality after failed fights than the lower one. Quantify rather than automatically remove.
6. Cosmetic diversity: current monster identities vary but map-wide combat stats are shared; changing this requires online and guest parity.

## Standard report table
| Map | Player level | Build | Gear | Player HP/ATK/DEF/crit | Monster HP/ATK/DEF | Win% (sample count) | Turns avg/p90 | Potions/100 vitality | XP/vitality | Silver/vitality | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Separate VERIFIED live values from MODELED estimates from PROPOSED balancing edits. Any candidate acceptance thresholds must be stated as design assumptions until approved.
