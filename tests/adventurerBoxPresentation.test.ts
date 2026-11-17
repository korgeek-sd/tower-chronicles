import test from 'node:test';
import assert from 'node:assert/strict';
import {boxReveal,boxStatRows} from '../src/components/inventory/boxPresentation';
import type {EquipmentItem} from '../src/game/types';
const item=(grade:EquipmentItem['grade']):EquipmentItem=>({id:grade,kind:'association_supply_iron_sword',grade,enhancement:0});
test('opening does not predict a grade before a receipt arrives',()=>{
 assert.equal(boxReveal([]),null);
});
test('batch reveal uses the highest actual reward without mutating receipt order',()=>{
 const rewards=[item('rare'),item('legendary'),item('common')];
 assert.equal(boxReveal(rewards)?.grade,'legendary');
 assert.equal(boxReveal(rewards)!.duration,5000);
 assert.deepEqual(rewards.map(i=>i.grade),['rare','legendary','common']);
 assert.equal(boxReveal(rewards,true)?.duration,0);
});
test('result stats come from real equipment and exclude fictional level requirements',()=>{
 const rows=boxStatRows(item('common'));
 assert.ok(rows.some(row=>row.label==='공격력'&&row.value==='+10'));
 assert.ok(rows.some(row=>row.label==='방어력'&&row.value==='+4'));
 assert.ok(!rows.some(row=>row.label.includes('레벨')));
});

test('opening has a substantial wind-up, a suspense hold, and a separate reveal beat',()=>{
 const common=boxReveal([item('common')])!,legendary=boxReveal([item('legendary')])!;
 assert.equal(common.duration,2600);
 assert.ok(legendary.duration>common.duration);
 for(const grade of ['common','uncommon','rare','heroic','legendary'] as const){
  const reveal=boxReveal([item(grade)])!;
  assert.ok(reveal.chargeAt>=650);
  assert.ok(reveal.holdAt>reveal.chargeAt);
  assert.ok(reveal.burstAt-reveal.holdAt>=350);
  assert.ok(reveal.duration-reveal.burstAt>=450);
 }
});
