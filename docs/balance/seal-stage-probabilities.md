# Seal stage probabilities — 2026-10-28

User-approved replacement of fixed 76/20/4 percent with the basic Lineage M table:
https://probability.plaync.com/lineagem/view?probCategoryId=683568e3068cf65296bc535e

Baseline: `d7773f7742a553210a2a0fc98f21274fd48b4b96`. Live functions were inspected before editing: both RPCs used the same unparameterized 76/20/4 draw.

The source table row is the next target stage: current level 0 uses row 1, current level 29 uses row 30. This makes the final roll +1 at 100%; no result can exceed level 30. The current server-locked level determines each roll, including every action in a batch. Combat and guardian seals share the same table but retain independent progress.

Only base probabilities change. Keep 300 Gold per roll, 3,000 Gold per reset, 20 rolls per cycle, reward bonuses, existing progress and receipts. No probability reroll, guaranteed +3 follow-up, or special-option mechanic is added. Existing receipts replay their original result without a new debit or draw.

Implementation: display probabilities in `src/game/seal.ts`; SQL basis-point table and both updated RPCs in `20261028084402_seal_stage_probabilities.sql`. The original RPC bodies are retained with only the level argument added to the draw. New private helpers cannot be called by anon/authenticated/service_role, and existing public RPC privileges are preserved.

Validation: 30-row SQL/client equality; seeded SQL draws (10,000 per stage); exact boundary inputs through both real RPC bodies in an isolated PGlite fixture; debit/replay/20-roll/level-30/insufficient-gold/rollback checks. No real player action is used for verification.

Modeled estimate, not production telemetry: 100,000 cycles from level 0 with at most 20 rolls and no additional mechanics. LCG seed 28102026, update `(Math.imul(seed,1664525)+1013904223)>>>0`, uniform draw `seed/4294967296`. Independent run starts with the same seed for each ruleset.

| Rules | Mean final level | Level 30 within 20 rolls |
| --- | ---: | ---: |
| Prior fixed rates | 25.54295 | 5.826% |
| Stage-dependent base table | 24.20355 | 0.401% |

The lower late-stage +2/+3 rates reduce completion probability. This change follows the requested table without compensating changes to costs, limits, or rewards.
