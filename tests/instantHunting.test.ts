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
 assert.equal(HUNT_MAPS.length,3);
});
