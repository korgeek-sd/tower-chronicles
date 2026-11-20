---
name: game-economy-review
description: Review Tower Chronicles changes to trading, inventory, saves, or rewards for ownership, quantity conservation, and retry correctness before release.
---

# Game economy change review

Read the target commit diff and its parent. Identify client entry points, public RPCs, internal helpers, grants and triggers touched by the change. Check the deployed function definitions when deployment verification is requested.

For each transfer, track the account and quantity in escrow, storage, inventory, mail and currency balances. Distinguish pending inventory from spendable inventory. Follow both sides of partial fills, cancellation, expiry, individual claims and claim-all through their actual callers. Verify row ownership, lock order, atomicity and retry behavior.

Use existing automated tests or isolated fixture transactions with rollback. A useful fixture starts with seven listed boxes, fills two, and returns five. Verify balances before and after collection and after retry. Keep test orders separate from live players' orders.

Report findings with commit, file and function references. Separate observed behavior from code inspection and list untested paths. Report only changes supported by evidence.
