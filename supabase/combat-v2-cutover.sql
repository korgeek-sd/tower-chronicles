-- Upgrade existing encounters before a V2 response can be restored by a client.
with converted as (
 select (private.combat_v2_initialize(c)).* from private.online_combat_states c
 where c.engine_runtime->>'version' is distinct from '2'
)
update private.online_combat_states c set
 engine_runtime=n.engine_runtime,job_resource=n.job_resource,cooldowns=n.cooldowns,
 monster_cooldowns=n.monster_cooldowns,player_effects=n.player_effects,monster_effects=n.monster_effects,
 player_shield=n.player_shield,monster_shield=n.monster_shield,state_version=c.state_version+1
from converted n where c.user_id=n.user_id and c.run_id=n.run_id;
