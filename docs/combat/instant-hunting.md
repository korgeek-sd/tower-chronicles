# Instant hunting combat

Current hunting uses six stats: maximum HP, attack, defense, critical chance (0–1), critical damage multiplier (at least 1), and percentage armor penetration (0–1). Legacy expedition Stats and saves remain unchanged.

Damage is `max(1, floor(attack × skill multiplier × critical multiplier × 100 / (100 + defense × (1 − penetration))))`. Critical multiplier applies only on a successful critical roll. Current equipment grants its existing attack/defense/HP/critical chance; critical damage defaults to 1.5 and penetration to 0 until equipment options grant them through the canonical server equipment calculator. Client payloads cannot directly supply combat stats to hunt_once.

Each turn the player acts, then a surviving monster attacks. Preset order selects the first eligible skill: Heavy 180%, cooldown 3; Quick 120%, cooldown 2; Guard available at HP ≤50%, cooldown 4, halves that turn's incoming attack. Cooldown starts on use; Heavy used on turn 1 is next eligible on turn 4. No eligible skill means waiting, never a basic attack. No speed stat determines turn order. A fight stops at death or 100 turns; only killing the monster while alive grants victory rewards.

Existing food effects last one hunt per remaining use: attack/defense +10%, experience +10% rounded down. Potions heal before and after combat, one HP per potion. Defeat retains at least one HP for the next hunt. One new hunt costs one vitality, even on defeat; replaying the same server receipt costs nothing and grants nothing twice.

Server hunt_once owns online RNG, HP, consumables, rewards and idempotency. The guest resolver follows the same combat rules. Regression tests compare complete server and guest turn histories at deterministic critical chance 0 and 1, alongside consumable and receipt tests.
