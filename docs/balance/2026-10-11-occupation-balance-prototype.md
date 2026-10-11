# Tower Chronicles — occupation war balance prototype (2026-10-11)

> **Read-only simulation, not a production occupation-war feature or validated live-Supabase result.**  
> Source inspected: repository head `3f72270b44856059da3674358765e538df30f388` before these report/script commits.  
> Reproduce: `node scripts/balance/occupationBalance.mjs` and `node --test tests/occupationBalancePrototype.test.mjs`.

## Current source and planned target are different

Production at inspection has 3 occupation fronts (LEFT/CENTER/RIGHT), public-merit bidding, Saturday 22:00–22:30 KST timed battle and manual BASIC/GUARD duels; see `src/game/occupation/rules.ts`, `src/components/occupation/OccupationScreen.tsx`, and `src/online/occupation.ts`. The new 5-front, 11-village, rostered PvP is **not implemented**. Village life has 10 resource towns and city `city`, but ownership/tax remain neutral on the actual server; `src/components/world/worldMap.ts` ownership labels are fixtures.

Hunting uses shared physical damage `max(1,floor(ATK × skill multiplier × critical multiplier ×100/(100+DEF×(1−penetration))))`, critical chance, attacker-first turns and priority-based automatic skills. Current catalog has healing, shield, damage-over-time, buffs, MP costs and passives. The prototype only models the legacy Heavy (180%, cooldown 3), Guard (HP <=50%, cooldown 4), Quick (120%, cooldown 2) skill priority, one action per fighter/turn, 100 turns cap, and full HP for each attacking challenge. Defender HP **persists between challenges**, defender MP and attackers reset (prototype contains no MP-dependent skills). **The actual 80 skill effects are absent; these results are not a true PvP balance guarantee.**

## Proposed starting rules (not deployed)

- 11 independently contestable locations; 5 fronts per location; 5 defender slots/front = 25 garrison slots.
- Attack challenge costs 1 **existing** `challenge_ticket`; attacker has 30s character cooldown.
- Sequential eligible defender on each front; residual HP persists across failed attempts; once all five fall, claimant installs frozen garrison snapshots at full HP.
- PvP starts at full MP; player character HP for hunts, potion supplies, PvE food effects and normal vitality remain separate.
- Saturday 22:00–22:30 KST; hold all five fronts continuously for five minutes, otherwise settle by owned fronts. Multi-guild tiebreaks and lane claim races require authoritative SQL locks and a dedicated decision.
- Guild leaders can assign owned character snapshots before battle; cannot edit roster or reset cumulative garrison health mid-war.
- This prototype assumes all 25 defenders are fixed and uncontested. It does **not** simulate multi-guild front changes, server queues, NPC substitutes, different class rotations, market trading, stat distribution or reconnects.

## 1,000 seeded uncontested wars per scenario (seed 20261011)

Fixture stats are **hypothetical baseline equipment** from `docs/balance/2026-10-10-hunting-balance-report.md` — not actual player inventory statistics. A PvP match starts with current defender HP and attacker's full HP. Damage respects the production physical damage formula but **not full skill behavior**.

| Attacker → defender | Average ticket attempts | Median attempts | P90 attempts | Minimum ideal capture time: 5 concurrent members |
|---|---:|---:|---:|---:|
| Lv50 standard → same | 42.35 | 42 | 45 | 4.08m |
| Lv80 standard → same | 44.76 | 45 | 47 | 4.08m |
| Lv80 standard → same with +25% garrison HP | 50.00 | 50 | 50 | 4.58m |
| Lv80 offense → Lv80 defense | 46.18 | 46 | 49 | 4.58m |
| Lv80 defense → Lv80 offense | 36.65 | 37 | 40 | 3.58m |
| Lv80 standard → Lv80 defense | 40.15 | 40 | 43 | 3.58m |
| Lv50 standard → Lv80 standard | 74.98 | 75 | 75 | 7.08m |
| Lv100 optimistic mirror | 45.75 | 46 | 48 | 4.58m |

Every benchmark reached all 25 defenders within the 600-attempt *simulator* cap. That means nothing about live PvP success against healing/shields or other guilds.

### Participation sensitivity

For 45 attempts to clear 25 defenders, ideal arrival bound = `(ceil(attempts/members)-1)×30s+5s`; add an uninterrupted five-minute hold:

| Concurrent attackers | Lower bound to clear | Plus hold |
|---|---:|---:|
| 1 | 22.08 min | 27.08 min |
| 3 | 7.08 min | 12.08 min |
| 5 | 4.08 min | 9.08 min |
| 10 | 2.08 min | 7.08 min |
| 20 | 1.08 min | 6.08 min |

These are **optimistic lower bounds**. They assume perfect coordination, instant per-lane resolution, no opponents and no queue wait. 30-minute war duration is an inherited existing setting rather than a new confirmation.

## Ticket economy — critical blocker

Current `src/game/life/crafting.ts` recipe consumes 10 split stones per craft action and yields **one** challenge ticket before mastery modifiers. Split stones per dismantled equipment grade = [1, 3, 6, 10, 15]. Actual equipment drop per victorious hunt (in millionths) is documented by `src/game/hunting/equipmentDrops.ts`: plains [13000,2000,0,0,0]; forest [13000,3000,500,0,0]; mine [13000,3500,900,100,0]; fortress [13000,4000,1300,200,0]; ruins [13000,4500,1600,350,116].

Expected material is `sum(drop_millionths × split_stones_by_grade)/1,000,000`, **conditional on hunting victory and every drop being dismantled**. It does not include unmodeled ticket giveaways/trading. Current recipe assumes 0% crafting bonus; more crafting mastery increases production up to +50%.

| Hunting map | Expected stones per victory | Estimated weekly tickets, 5 members × 100 victories/day × 7d, current yield |
|---|---:|---:|
| Plains | 0.01900 | 6.65 |
| Forest | 0.02500 | 8.75 |
| Mine | 0.02990 | 10.47 |
| Fortress | 0.03480 | 12.18 |
| Ruins | 0.04134 | 14.47 |

At ruins 100 wins/day per person, the five-person guild obtains **~14.47 total tickets/week** at baseline — far fewer than the ~45 for one uncontested equal-level assault. One 45-ticket attack costs 450 stones; at 5 members × 7 days that needs ~311 winning ruins hunts **per member per day** on average, before failed hunts and retaining gear (above the theoretical regular regeneration of 288/day).

**Candidate, not implemented:** keep 10 split stones per crafting action but increase the ticket yield from 1 to **10**, or create an equivalent 1-stone-per-ticket recipe. With unchanged drop and activity assumptions, 5 members at ruins would have ~145 tickets/week, enough for about 3 uncontested 45-ticket clears, leaving room for at least some PvP exchanges. The 10× change should be retested with trading, activity distributions and paid-for/weekly allocation before deploying; alternative is 10+ weekly entry tickets per participating member.

## Proposed acceptance targets and next technical milestone

1. Build server-owned five-front state and roster snapshots, with SQL transaction locks, request ID idempotence, cooldown and ticket debit/refund.
2. Implement full PvP engine reusing the **current 80-skill catalog**, per-skill MP, shields, healing, DOT, passives and level enhancements. Detect stall/timeout and guarantee no infinite healing.
3. Cross-check guest/server deterministic combat traces across four stat builds and 3+ equipment tiers and sensitivity settings.
4. Re-run 1,000 or more seed-matched wars with varying 1/3/5/10/20-player guilds, NPC filler, queue contention, contested front resets, regeneration, defender HP progression and realistic ticket supply.
5. Only then choose exact PvP coefficients, 30-minute duration, final five-minute hold and production ticket yield; deploy as a separate reviewed schema/UI change.

**No production combat/ticket drop balance, SQL tables or deployed occupation-war behavior was changed by this report and script.**
