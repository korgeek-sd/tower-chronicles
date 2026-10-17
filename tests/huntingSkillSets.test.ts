import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as conditions from '../src/game/hunting/skillConditions';
test('each numbered slot accepts at most one condition',()=>{
 assert.equal(conditions.validSkillConditions([{kind:'hp_lte',value:50},{kind:'shield_absent'}]),false);
});
test('three independent sets retain blanks and migrate the current loadout to set one',()=>{
 assert.equal(typeof conditions.readSkillSets,'function');
 const sets=conditions.readSkillSets({skills:['heavy','quick'],skillSetup:{slots:['heavy',null,'quick',null,null,null],conditions:{heavy:[{kind:'hp_lte',value:50},{kind:'shield_absent'}]}}});
 assert.equal(sets.length,3);assert.deepEqual(sets[0].setup.slots,['heavy',null,'quick',null,null,null]);assert.equal(sets[0].setup.conditions.heavy.length,1);
 sets[1].setup.slots[0]='guard';assert.equal(sets[2].setup.slots[0],null);assert.equal(sets[0].setup.slots[0],'heavy');
});
