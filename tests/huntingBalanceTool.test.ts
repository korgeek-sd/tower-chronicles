import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocationForBuild,buildPlayer,gearStageForLevel,recommendedMap,seededRng,simulateBalance,balanceCsv,balanceTable} from '../scripts/balance/huntingBalance';
import {HUNT_MAPS,statPointsForLevel,usedStatPoints} from '../src/game/hunting/model';

test('balance skill and reproducible command are registered',()=>{
 const skill=readFileSync(new URL('../.agents/skills/tower-balance/SKILL.md',import.meta.url),'utf8');
 for(const phrase of ['name: tower-balance','balance:hunting','resolveHunt','server','100'])assert.ok(skill.includes(phrase),phrase);
 const guide=readFileSync(new URL('../.agents/skills/tower-balance/references/analysis-contract.md',import.meta.url),'utf8');
 assert.match(guide,/per vitality|vitality/i);
});
test('all 1–100 build allocations spend exactly the available points, crit at most 10',()=>{
 for(let level=1;level<=100;level++)for(const build of ['balanced','offense','defense','critical'] as const){
  const a=allocationForBuild(level,build);
  assert.equal(usedStatPoints(a),statPointsForLevel(level));
  assert.ok(a.crit<=10&&a.hp>=0&&a.attack>=0&&a.defense>=0);
 }
 assert.equal(buildPlayer(1,'balanced','standard').final.hp,180);
 assert.equal(buildPlayer(1,'balanced','standard').final.attack,18);
 assert.equal(buildPlayer(1,'balanced','standard').final.defense,7);
 assert.ok(buildPlayer(40,'offense','standard').final.attack>buildPlayer(40,'defense','standard').final.attack);
 assert.ok(gearStageForLevel(60,'high')>gearStageForLevel(60,'under'));
});
test('recommended map matches actual five level bands',()=>{
 const pairs=[[1,'plains'],[19,'plains'],[20,'forest'],[39,'forest'],[40,'mine'],[59,'mine'],[60,'fortress'],[79,'fortress'],[80,'ruins'],[100,'ruins']] as const;
 for(const [level,map] of pairs)assert.equal(recommendedMap(level),map);
});
test('seeded simulations reproduce outcomes and restore altered candidate monster stats',()=>{
 const a=seededRng(123),b=seededRng(123);
 assert.deepEqual([a(),a(),a()],[b(),b(),b()]);
 const current=HUNT_MAPS.find(m=>m.id==='mine')!;
 const original={hp:current.hp,attack:current.attack,defense:current.defense};
 const args={levels:[40],builds:['balanced' as const],gears:['standard' as const],maps:['mine' as const],runs:15,seed:77,potions:10000,candidate:{mine:{hp:current.hp+200,attack:current.attack+10,defense:current.defense+10}}};
 const one=simulateBalance(args),two=simulateBalance(args);
 assert.deepEqual(one,two);assert.equal(one.length,2);
 assert.deepEqual({hp:current.hp,attack:current.attack,defense:current.defense},original);
 assert.ok(one[1].meanTurns>=one[0].meanTurns);
 assert.match(balanceCsv(one),/xpPerVitality/);assert.match(balanceTable(one),/potion\/fight/);
});
test('endurance mode resolves 100 vitality and reports zero potion consumption if none are available',()=>{
 const rows=simulateBalance({levels:[1],builds:['balanced'],gears:['standard'],maps:['plains'],mode:'endurance',runs:1,seed:3,potions:0});
 assert.equal(rows[0].attempts,100);
 assert.ok(rows[0].underHealedRate>0);
 assert.equal(rows[0].potionsPerAttempt,0);
 assert.ok(rows[0].winRate>=0&&rows[0].winRate<=1);
});
