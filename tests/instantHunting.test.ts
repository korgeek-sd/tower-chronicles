import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverVitality,initialHuntingState,resolveHunt,HUNT_MAPS} from '../src/game/hunting/model';
const fighter={hp:180,attack:18,defense:7,speed:10};
test('vitality keeps partial intervals but discards overflow at cap',()=>{
 const s=initialHuntingState(0);s.vitality=97;
 assert.equal(recoverVitality(s,650000).vitality,99);
 assert.equal(recoverVitality(s,650000).recoveredAt,600000);
 const full=recoverVitality(s,1200000);assert.equal(full.vitality,100);assert.equal(full.recoveredAt,1200000);
 assert.equal(recoverVitality({...full,vitality:99},1200001).vitality,99);
});
test('one click finishes combat, costs one vitality, keeps input immutable',()=>{
 const before=initialHuntingState(0),r=resolveHunt(before,'plains',fighter,['heavy'],0,()=>0.5);
 assert.equal(before.vitality,100);assert.equal(r.state.vitality,99);
 assert.equal(r.result.outcome,'victory');assert.equal(r.result.monsterHp,0);
 assert.ok(r.result.turns.length>0);assert.ok(r.result.silver>0);assert.ok(r.result.turns.some(t=>t.lines.some(l=>l.includes('강타'))));
});
test('empty vitality, active clock reversal and invalid map cannot grant hunting rewards',()=>{
 assert.throws(()=>resolveHunt({...initialHuntingState(0),vitality:0},'plains',fighter,[],0),/활력/);
 assert.throws(()=>resolveHunt(initialHuntingState(0),'bad' as any,fighter,[],0),/지역/);
 assert.equal(recoverVitality({...initialHuntingState(1000),vitality:1},0).vitality,1);
});
test('defeat pays nothing and consumes vitality',()=>{
 const r=resolveHunt(initialHuntingState(0),'mine',{hp:1,attack:1,defense:0,speed:1},[],0,()=>0.5);
 assert.equal(r.result.outcome,'defeat');assert.equal(r.result.silver,0);assert.equal(r.result.exp,0);assert.equal(r.result.materialCount,0);assert.equal(r.state.vitality,99);
 assert.equal(HUNT_MAPS.length,5);
});

test('six combat stats apply critical damage and percentage penetration',()=>{
 const base={hp:1000,attack:100,defense:0,critChance:1,critDamage:2,armorPenetration:1};
 const r=resolveHunt(initialHuntingState(0),'mine',base,['heavy'],0,()=>0);
 assert.equal(r.result.turns[0].monsterHp,0);
 assert.ok(r.result.turns[0].lines[0].includes('360 피해'));
 assert.deepEqual(Object.keys(r.result.player).sort(),['hp','attack','defense','critChance','critDamage','armorPenetration'].sort());
});
test('skill cooldowns wait without basic attacks and invalid skills do not attack',()=>{
 const r=resolveHunt(initialHuntingState(0),'mine',{...fighter,hp:1000},['heavy'],0,()=>1);
 assert.equal(r.result.turns[1].monsterHp,r.result.turns[0].monsterHp);
 assert.ok(r.result.turns[1].lines[0].includes('대기'));
 const empty=resolveHunt(initialHuntingState(0),'plains',fighter,['unknown'],0,()=>0);
 assert.equal(empty.result.monsterHp,90);assert.equal(empty.result.outcome,'defeat');
});
test('guest HP, food and potions persist once per hunt without mutating input',()=>{
 const before={...initialHuntingState(0),currentHp:1,potions:300,foodTurns:{attack_food:2,defense_food:1,experience_food:1}};
 const r=resolveHunt(before,'plains',fighter,['heavy','quick'],0,()=>1);
 assert.equal(r.result.startHp,180);assert.equal(r.result.player.attack,19.8);
 assert.equal(r.result.exp,110);assert.equal(r.state.currentHp,180);
 assert.equal(r.state.potions,300-r.result.potionsUsed!);
 assert.equal(r.state.foodTurns?.attack_food,1);assert.equal(r.state.foodTurns?.defense_food,0);
 assert.equal(before.currentHp,1);assert.equal(before.potions,300);
});
test('invalid combat values normalize and guard acts before monster damage',()=>{
 const r=resolveHunt({...initialHuntingState(0),currentHp:50},'plains',{hp:100,attack:10,defense:0,critChance:2,critDamage:0,armorPenetration:-1},['guard','heavy'],0,()=>0);
 assert.equal(r.result.player.critChance,1);assert.equal(r.result.player.critDamage,1);assert.equal(r.result.player.armorPenetration,0);
 assert.equal(r.result.turns[0].playerHp,44);assert.equal(r.result.turns[0].monsterHp,90);
});
