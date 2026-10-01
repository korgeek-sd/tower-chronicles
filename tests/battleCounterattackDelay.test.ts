import test from 'node:test';
import assert from 'node:assert/strict';
import {counterattackDelay} from '../src/components/battle/battleVfxTimeline.ts';

test('counterattack waits after the last player hit and scales with battle speed',()=>{
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],1),820);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:3},{attacker:'monster',hitIndex:1}],1),976);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],2),410);
 assert.equal(counterattackDelay([{attacker:'monster',hitIndex:1}],1),0);
 assert.equal(counterattackDelay([{attacker:'player',hitIndex:1}],1),0);
});

test('player recovery uses the same gap after the last monster hit',async()=>{
 const {playerRecoveryDelay}=await import('../src/components/battle/battleVfxTimeline.ts');
 assert.equal(playerRecoveryDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],1),1520);
 assert.equal(playerRecoveryDelay([{attacker:'monster',hitIndex:2}],1),898);
 assert.equal(playerRecoveryDelay([{attacker:'player',hitIndex:1},{attacker:'monster',hitIndex:1}],2),760);
 assert.equal(playerRecoveryDelay([{attacker:'player',hitIndex:1}],1),0);
});
