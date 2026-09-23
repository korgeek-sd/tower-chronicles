import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,equip,stats} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {previewEquipment,configureSkillSlot} from '../src/game/equipmentView.ts';

test('equipment preview matches an actual equipment change without altering the save',()=>{
  const s=initialState();s.items.push({id:'crafted',kind:'sword',tier:1,enhancement:0});
  const before=JSON.stringify(s),preview=previewEquipment(s,'crafted')!;
  assert.equal(preview.before.attack,13.5);assert.equal(preview.after.attack,18);
  assert.deepEqual(preview.after,stats(equip(s,'crafted')));assert.equal(preview.blockedReason,null);
  assert.equal(JSON.stringify(s),before);
});
test('equipment preview explains mastery and expedition locks and keeps armor in its own slot',()=>{
  const s=initialState();s.items.push({id:'armor',kind:'armor',tier:2,enhancement:0});
  const preview=previewEquipment(s,'armor')!;assert.match(preview.blockedReason!,/숙련/);assert.equal(preview.after.hp,290);assert.equal(preview.after.attack,13.5);
  const active=enter(s,'ore',1);assert.match(previewEquipment(active,'armor')!.blockedReason!,/원정/);
  assert.equal(previewEquipment(s,'missing'),null);
});
test('accessory comparisons preserve base stats and do not invent a stat benefit',()=>{
  const s=initialState();s.items.push({id:'accessory',kind:'vampire',tier:1,enhancement:0});
  const p=previewEquipment(s,'accessory')!;assert.deepEqual(p.before,p.after);
});
test('manual skill configuration rejects duplicates, unknown skills and expedition changes',()=>{
  const s=initialState();const updated=configureSkillSlot(s,0,null);assert.equal(updated.skills[0],null);assert.equal(s.skills[0],'heavy');
  assert.strictEqual(configureSkillSlot(s,0,'guard'),s);assert.strictEqual(configureSkillSlot(s,0,'missing'),s);assert.strictEqual(configureSkillSlot(s,0,'execute'),s);
  assert.strictEqual(configureSkillSlot(s,3,'heavy'),s);
  const active=enter(s,'ore',1);assert.strictEqual(configureSkillSlot(active,0,null),active);
  assert.equal(configureSkillSlot(updated,0,'heavy').skills[0],'heavy');
});
