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
 assert.ok(boxReveal(rewards)!.duration<=800);
 assert.deepEqual(rewards.map(i=>i.grade),['rare','legendary','common']);
 assert.equal(boxReveal(rewards,true)?.duration,0);
});
test('result stats come from real equipment and exclude fictional level requirements',()=>{
 const rows=boxStatRows(item('common'));
 assert.ok(rows.some(row=>row.label==='공격력'&&row.value==='+10'));
 assert.ok(rows.some(row=>row.label==='방어력'&&row.value==='+4'));
 assert.ok(!rows.some(row=>row.label.includes('레벨')));
});
