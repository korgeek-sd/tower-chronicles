import test from 'node:test';
import assert from 'node:assert/strict';
import type {EnhancementLevel,GameState,Item} from '../src/game/types.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {enhanceEquipment,enhancementQuote,resolveEnhancementOutcome} from '../src/game/engine/enhancement.ts';

const gear=(id:string,kind:string,enhancement:EnhancementLevel=0,tier=1):Item=>({id,kind,tier,enhancement});
function prepared(kind='sword',enhancement:EnhancementLevel=0,tier=1){
  const s=initialState();
  const item=gear('target',kind,enhancement,tier);
  s.items.push(item);
  s.silver=100_000;
  for(const t of ['ore','leather','gem','kaleon'] as const)for(let i=0;i<5;i++)s.materials[t][i]=1000;
  return s;
}

test('ENHANCE ENGINE 01: +0 result boundaries are success 50% and keep 50%',()=>{
  assert.equal(resolveEnhancementOutcome(0,0),'SUCCESS');
  assert.equal(resolveEnhancementOutcome(0,.499999),'SUCCESS');
  assert.equal(resolveEnhancementOutcome(0,.5),'FAIL_KEEP');
  assert.equal(resolveEnhancementOutcome(0,.999999),'FAIL_KEEP');
});

test('ENHANCE ENGINE 02: +1 result boundaries include 20% downgrade and 5% destruction',()=>{
  assert.equal(resolveEnhancementOutcome(1,.349999),'SUCCESS');
  assert.equal(resolveEnhancementOutcome(1,.35),'FAIL_KEEP');
  assert.equal(resolveEnhancementOutcome(1,.749999),'FAIL_KEEP');
  assert.equal(resolveEnhancementOutcome(1,.75),'FAIL_DOWNGRADE');
  assert.equal(resolveEnhancementOutcome(1,.949999),'FAIL_DOWNGRADE');
  assert.equal(resolveEnhancementOutcome(1,.95),'FAIL_DESTROYED');
});

test('ENHANCE ENGINE 03: +2 result boundaries include 30% downgrade and 15% destruction',()=>{
  assert.equal(resolveEnhancementOutcome(2,.199999),'SUCCESS');
  assert.equal(resolveEnhancementOutcome(2,.2),'FAIL_KEEP');
  assert.equal(resolveEnhancementOutcome(2,.549999),'FAIL_KEEP');
  assert.equal(resolveEnhancementOutcome(2,.55),'FAIL_DOWNGRADE');
  assert.equal(resolveEnhancementOutcome(2,.849999),'FAIL_DOWNGRADE');
  assert.equal(resolveEnhancementOutcome(2,.85),'FAIL_DESTROYED');
});

test('ENHANCE ENGINE 04: successful enhancement consumes Silver/material once and raises exactly one level',()=>{
  const s=prepared('sword',0),q=enhancementQuote(s,'target')!;
  const beforeSilver=s.silver,beforeMat=s.materials.ore[0];
  const n=enhanceEquipment(s,'target',()=>0);
  assert.equal(n.items.find(i=>i.id==='target')?.enhancement,1);
  assert.equal(n.silver,beforeSilver-q.silverCost);
  assert.equal(n.materials.ore[0],beforeMat-q.materialCost);
  assert.equal(s.items.find(i=>i.id==='target')?.enhancement,0);
});

test('ENHANCE ENGINE 05: keep failure consumes all cost without changing the level',()=>{
  const s=prepared('sword',1),q=enhancementQuote(s,'target')!;
  const n=enhanceEquipment(s,'target',()=>.5);
  assert.equal(n.items.find(i=>i.id==='target')?.enhancement,1);
  assert.equal(n.silver,s.silver-q.silverCost);
  assert.equal(n.materials.ore[0],s.materials.ore[0]-q.materialCost);
  assert.match(n.notice,/유지/);
});

test('ENHANCE ENGINE 06: downgrade failure lowers exactly one level and consumes cost',()=>{
  const s=prepared('sword',2),q=enhancementQuote(s,'target')!;
  const n=enhanceEquipment(s,'target',()=>.6);
  assert.equal(n.items.find(i=>i.id==='target')?.enhancement,1);
  assert.equal(n.silver,s.silver-q.silverCost);
  assert.equal(n.materials.ore[0],s.materials.ore[0]-q.materialCost);
  assert.match(n.notice,/하락/);
});

test('ENHANCE ENGINE 07: destruction permanently removes equipped gear and clears its slot',()=>{
  const s=prepared('sword',2);
  s.equipped.weapon='target';
  const q=enhancementQuote(s,'target')!;
  const n=enhanceEquipment(s,'target',()=>.99);
  assert.equal(n.items.some(i=>i.id==='target'),false);
  assert.equal(n.equipped.weapon,null);
  assert.equal(n.silver,s.silver-q.silverCost);
  assert.equal(n.materials.ore[0],s.materials.ore[0]-q.materialCost);
  assert.match(n.notice,/파괴/);
});

test('ENHANCE ENGINE 08: starter, max +3 and active expedition are blocked before RNG or cost consumption',()=>{
  for(const mode of ['starter','max','expedition'] as const){
    let calls=0;
    let s:GameState;
    let id:string;
    if(mode==='starter'){s=initialState();s.silver=9999;s.materials.ore[0]=999;id='starter';}
    else {s=prepared('sword',mode==='max'?3:0);id='target';if(mode==='expedition')s=enter(s,'ore',1);}
    const before=structuredClone(s),n=enhanceEquipment(s,id,()=>{calls++;return 0;});
    assert.equal(calls,0);
    assert.equal(n.silver,before.silver);
    assert.deepEqual(n.materials,before.materials);
    assert.deepEqual(n.items,before.items);
  }
});

test('ENHANCE ENGINE 09: insufficient Silver or material blocks atomically before RNG',()=>{
  for(const resource of ['silver','material'] as const){
    const s=prepared('sword',0),q=enhancementQuote(s,'target')!;
    if(resource==='silver')s.silver=q.silverCost-1;
    else s.materials.ore[0]=q.materialCost-1;
    let calls=0;
    const before=structuredClone(s),n=enhanceEquipment(s,'target',()=>{calls++;return 0;});
    assert.equal(calls,0);
    assert.equal(n.silver,before.silver);
    assert.deepEqual(n.materials,before.materials);
    assert.equal(n.items.find(i=>i.id==='target')?.enhancement,0);
  }
});

test('ENHANCE ENGINE 10: material family follows weapon/armor/boots/accessory category and item tier',()=>{
  const cases=[
    ['sword','ore'],
    ['armor','leather'],
    ['boots','leather'],
    ['vampire','gem'],
  ] as const;
  for(const [kind,tower] of cases){
    const s=prepared(kind,1,3),q=enhancementQuote(s,'target')!;
    assert.equal(q.materialTower,tower);
    assert.equal(q.materialTier,3);
    assert.equal(q.silverCost,750);
    assert.equal(q.materialCost,24);
  }
});

test('ENHANCE ENGINE 11: invalid RNG is rejected without consuming the prepared state',()=>{
  const s=prepared('sword',0),before=structuredClone(s);
  assert.throws(()=>resolveEnhancementOutcome(0,1));
  assert.throws(()=>resolveEnhancementOutcome(0,-.1));
  assert.throws(()=>resolveEnhancementOutcome(0,NaN));
  const n=enhanceEquipment(s,'target',()=>1);
  assert.deepEqual(n,before);
});
