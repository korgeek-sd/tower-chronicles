# Daily and weekly quests

Quests use successful server action receipts. Counting starts at the rollout timestamp in `private.quest_config`; earlier actions do not count. Receipt retention must remain at least the current Seoul calendar week.

Daily: three distinct tasks selected from hunting wins 30, crafting actions 10, gathering actions 30, filled item purchase orders 3, and association donations 3. Assignment order is fixed for each user/date by a private salted hash. Batched life actions count their action count, not output quantity. Purchase fills for the same buy order count once. Defeats, order placement, item consumption and replayed action receipts do not advance progress.

Weekly: hunting wins 300, crafting actions 50, gathering actions 150, completed individual daily quests 10, and completion of the other four weekly quests. Daily completion is measured from receipts whether or not the reward was claimed or the quest screen was visited.

| Reward type | Daily quantity | Weekly quantity |
| --- | ---: | ---: |
| Bound vitality potion (+100 vitality) | 1 | 3 |
| Appearance summon ticket | 5 | 15 |
| HP potion | 100 | 300 |
| Random food | 3 | 10 |
| Random C/B/A catalog skillbook | 1 | 3 |
| Tradable challenge ticket | 3 | 10 |

Each claim randomly chooses uniformly from unused reward types in its own period. Daily and weekly reward pools are independent. Food/book draws may repeat within a reward bundle. Reward results are persisted atomically with grants; the assignment identity `(user, period, day, quest)` is the idempotency key. Repeating a claimed quest returns the recorded reward and current cloud record without granting again. Unclaimed expired quests cannot be claimed.

Daily resets at 00:00 Asia/Seoul; weekly at Monday 00:00. Explicit day keys prevent a delayed click from claiming the next period. Progress and rewards are private and only available through lease-validated RPCs. The client stores an unresolved claim identity to recover after reload or network failure.

Appearance tickets are held in a private wallet and reconciled into `cosmetics.summonTickets`; they are shown only in the summon screen. Summoning itself remains a separate feature. Challenge tickets mirror the available market asset balance into life products so crafting, rewards, war debits, escrow and refunds operate on the same units. Product mutations and market mutations acquire the existing outer market advisory lock before session/row locks.

UI: each row has one action. In progress: 바로가기. Complete: 보상받기. Claimed: disabled 수령 완료. The reward guide remains removed. Active quest screens refresh every 30 seconds and on focus.

Verification: `tests/questsSql.test.ts`, `tests/questUi.test.ts`, market catalog and unified inventory tests, plus the full suite and production build.
