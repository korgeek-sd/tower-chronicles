import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_NORMAL_POOL,IRON_T1_FLOORS,IRON_T1_MONSTER_BY_ID} from '../src/game/data/ironSpire.ts';
import {graphicFor} from '../src/game/data/graphics.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';

test('Iron Vein exposes one canonical 15-monster pool on every floor',()=>{
  assert.equal(IRON_NORMAL_POOL.length,15);
  assert.equal(new Set(IRON_NORMAL_POOL).size,15);
  for(let floor=1;floor<=10;floor++)assert.deepEqual(IRON_T1_FLOORS[floor].normalPool,IRON_NORMAL_POOL);
  for(const id of IRON_NORMAL_POOL){
    const content=IRON_T1_MONSTER_BY_ID[id];
    assert.ok(content);
    assert.ok(graphicFor('ore',{name:content.displayName}));
    const definition=monsterDefinitionById(id);
    assert.ok(definition);
    assert.deepEqual(validateMonsterDefinition(definition!),[]);
  }
});

test('Iron normal skills have unique ids and deterministic fallback definitions',()=>{
  const ids=IRON_NORMAL_POOL.flatMap(id=>monsterDefinitionById(id)!.skills??[]).map(skill=>skill.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const id of IRON_NORMAL_POOL)assert.ok(monsterDefinitionById(id));
});
