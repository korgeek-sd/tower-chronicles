# SDD ledger — plan: docs/superpowers/plans/2026-10-14-village-war-stage-one.md
Base: b110d2a0a8fe5e3d1111dcada1fa29e953ecad2b
Execution: native implementation, fresh final reviewer only.
Pre-flight: Tasks 1→2 share events/fronts/actor state; Tasks 1/2→3 share RPC response names; Task 4 uses the same migration with isolated fixture. Interfaces aligned.
Ruling: Development occurs on separate worktree from current dirty UI checkout; no broad reset or baseline commits.
Task 1: complete — rule and SQL tests 2/2 pass; clean baseline full suite 1210/1210.
Ruling: Canonical save/gear/skill/hunting/seal changes refresh pre-start draft snapshots; post-start changes never refresh them. This avoids lazy initialization capturing gear changed after the deadline.
Ruling: Save snapshot shared lock is taken before the front row, matching update triggers and avoiding reverse-order waits. Snapshot serialization costs brief save contention.
Task 2: mutation implementation shared with Task 1; now adding dedicated empty-claim RED→GREEN coverage before declaring it complete.
Task 2: complete — rule/SQL tests 4/4 pass. Empty claims: exact single debit, same result on replay, stale defender rejection, insufficient funds and injected error rollback.
Task 2 correction: leader removal boundary test initially failed (missing rejection), then passed after final pre-mutation clock recheck.
Ruling: Task 1 shared mutator already contained claim logic; dedicated claim coverage initially passed. Boundary regression was verified RED→GREEN. Do not claim all claim code was written after its dedicated tests.
Task 3: complete — focused tests 7/7 and full suite 1217/1217 pass, production build pass. Browser 320x568/375x640/430x740: layout, duplicate click, same UUID after lost response, account switch and returning to old pending receipt all pass.
Ruling: Add pinned pg 8.16.3 as development-only driver; original lock entries retained to avoid unrelated optional dependency churn.
Task 4: PostgreSQL 17.10 real multi-connection 6 scenarios pass. A no-debit mutant failed (8 vs 7), confirming the debit assertion catches the defect; unmodified migration passed.
Ruling: Local namespace maps only uid 0. Scratch-only uid-reporting shim enables local PostgreSQL, bound to loopback with Unix sockets disabled; no shim enters repository or production.
Final review: two Important findings fixed in one pass: canonical snapshot publication races and weekly pending request rollover. Added shared try-advisory BEFORE canonical triggers, save-before-front refresh and post-wait deadline recheck. Added required expected event UUID through RPC/receipt/client recovery. Canonical profile nickname corrected.
Correction to earlier lock-order ruling: original AFTER trigger acquired front before save; final implementation acquires snapshot/save before front and canonical BEFORE triggers serialize with initial publication.
Evidence: rollover regression failed before event identity, passes after. Removing canonical guard fails actual two-client preset rejection, restored migration passes all 9 parallel scenarios. Full suite 1218/1218, build pass, 320/375/430 browser recovery pass.
Minor deferred: additional committed SQL coverage for pre-window/end-time, cross-town UUID conflict and explicit cooldown rejection; existing static UI tests do not reproduce interactive recovery. Browser verification is separate evidence, not committed UI-test coverage. Production remains disabled until phase two combat and settlement complete.
