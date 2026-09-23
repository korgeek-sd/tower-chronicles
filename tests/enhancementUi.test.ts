import test from 'node:test';
import assert from 'node:assert/strict';
import type {EnhancementLevel,Item} from '../src/game/types.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enhancementAttemptView,enhancementPreviewRows} from '../src/components/enhancement/presentation.ts';

const gear=(id:string,kind:string,enhancement:EnhancementLevel=0,tier=1):Item=>({id,kind,tier,enhancement});

test('ENHANCE UI 01: numeric equipment preview shows deterministic current and next contributions',()=>{
  const rows=enhancementPreviewRows(gear('armor','armor',1));
  assert.deepEqual(rows.map(row=>row.label),['최대 HP 기여','방어 기여']);
  assert.deepEqual(rows.map(row=>[row.current,row.next]),[['60.5','66'],['7.7','8.4']]);
});

test('ENHANCE UI 02: accessory preview exposes the confirmed passive progression',()=>{
  assert.deepEqual(enhancementPreviewRows(gear('v','vampire',2)),[{label:'흡혈',current:'10%',next:'11%'}]);
  assert.deepEqual(enhancementPreviewRows(gear('u','unyielding',2)),[{label:'피해 감소',current:'34%',next:'36%'}]);
  assert.deepEqual(enhancementPreviewRows(gear('b','berserker',2)),[{label:'공격력 증가',current:'46%',next:'50%'}]);
});

test('ENHANCE UI 03: quote view exposes material stock, cost and attempt eligibility',()=>{
  const s=initialState();s.items.push(gear('target','sword',1));s.silver=999;s.materials.ore[0]=99;
  const view=enhancementAttemptView(s,s.items.at(-1)!);
  assert.equal(view.quote?.target,2);
  assert.equal(view.quote?.silverCost,250);
  assert.equal(view.quote?.materialCost,8);
  assert.equal(view.materialName,'T1 철광석');
  assert.equal(view.materialOwned,99);
  assert.equal(view.canAttempt,true);
});

test('ENHANCE UI 04: insufficient resources and active expedition disable the attempt with a reason',()=>{
  const s=initialState();s.items.push(gear('target','sword',0));s.silver=0;s.materials.ore[0]=99;
  let view=enhancementAttemptView(s,s.items.at(-1)!);
  assert.equal(view.canAttempt,false);assert.match(view.reason,/Silver/);
  s.silver=999;s.materials.ore[0]=0;view=enhancementAttemptView(s,s.items.at(-1)!);
  assert.equal(view.canAttempt,false);assert.match(view.reason,/재료/);
  s.materials.ore[0]=99;s.expedition={} as never;view=enhancementAttemptView(s,s.items.at(-1)!);
  assert.equal(view.canAttempt,false);assert.match(view.reason,/원정/);
});

test('ENHANCE UI 05: starter and +3 gear render non-attempt states without fake probabilities',()=>{
  const s=initialState();
  const starter=s.items[0],max=gear('max','sword',3);s.items.push(max);
  assert.equal(enhancementAttemptView(s,starter).quote,null);
  assert.match(enhancementAttemptView(s,starter).reason,/지급용/);
  assert.equal(enhancementAttemptView(s,max).quote,null);
  assert.match(enhancementAttemptView(s,max).reason,/최대/);
  assert.deepEqual(enhancementPreviewRows(max),[]);
});
