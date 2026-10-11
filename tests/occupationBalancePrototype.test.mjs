import test from 'node:test';
import assert from 'node:assert/strict';
import {
 RULES,FIXTURES,seededRng,damage,duel,simulateCapture,throughput,benchmark,
 expectedSplitStonesPerWin,expectedWeeklyTickets
} from '../scripts/balance/occupationBalance.mjs';

test('PvP prototype uses the existing physical damage formula',()=>{
 assert.equal(damage(43,50,1.8),51);
 assert.equal(damage(0,999,1),1);
 assert.equal(damage(40,100,1,.5),26);
});
test('identical seed and input yield identical capture results',()=>{
 const s=FIXTURES.level80Standard;
 assert.deepEqual(simulateCapture(s,s,{seed:1234}),simulateCapture(s,s,{seed:1234}));
});
test('defender HP carries after attacker loses',()=>{
 const attacker={hp:80,attack:10,defense:0,critChance:0,critDamage:1.5,armorPenetration:0};
 const defender={hp:500,attack:70,defense:10,critChance:0,critDamage:1.5,armorPenetration:0};
 const first=duel(attacker,defender,defender.hp,seededRng(1));
 assert.equal(first.attackerWon,false);
 assert.ok(first.defenderHp>0&&first.defenderHp<defender.hp);
 const second=duel(attacker,defender,first.defenderHp,seededRng(2));
 assert.ok(second.defenderHp<first.defenderHp);
});
test('uncontested capture clears 5 fronts x 5 defenders',()=>{
 assert.equal(RULES.fronts*RULES.defendersPerFront,25);
 const result=simulateCapture(FIXTURES.level80Standard,FIXTURES.level80Standard);
 assert.equal(result.captured,true);
 assert.equal(result.defendersKilled,25);
 assert.ok(result.attempts>=25);
});
test('additional participants improve the uncontested mathematical lower bound',()=>{
 assert.equal(throughput(45,1),1325);
 assert.equal(throughput(45,5),245);
 assert.ok(throughput(45,10)<throughput(45,5));
});
test('Monte Carlo report remains reproducible',()=>{
 assert.deepEqual(benchmark({trials:10,seed:4}),benchmark({trials:10,seed:4}));
});
test('ticket production expectation uses production drop and split-stone rules',()=>{
 assert.equal(expectedSplitStonesPerWin('plains'),.019);
 assert.ok(Math.abs(expectedSplitStonesPerWin('ruins')-.04134)<1e-10);
 assert.ok(Math.abs(expectedWeeklyTickets('ruins',{members:5,winsPerDay:100})-14.469)<1e-9);
 assert.ok(Math.abs(expectedWeeklyTickets('ruins',{members:5,winsPerDay:100,recipeYield:10})-144.69)<1e-9);
});
