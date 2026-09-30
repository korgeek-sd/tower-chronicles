import test from 'node:test';
import assert from 'node:assert/strict';
import {counterattackDelay} from '../src/components/battle/battleVfxTimeline.ts';

test('counterattack waits after the last player hit and scales with battle speed',()=>{
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],1),700);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:3},{attacker:'monster',hitIndex:1}],1),856);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],2),350);
 assert.equal(counterattackDelay([{attacker:'monster',hitIndex:1}],1),0);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1}],1),0);
});
