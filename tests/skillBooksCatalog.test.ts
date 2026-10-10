import test from 'node:test';import assert from 'node:assert/strict';
import {SKILL_BOOKS,skillBookFor} from '../src/game/skills/books';
import {bookName} from '../src/game/engine/loot';
import {initialState} from '../src/game/engine/state';
import {inventoryView} from '../src/game/inventoryView';
test('80 skill books map one to one to the new skill catalog and inventory names',()=>{
 assert.equal(SKILL_BOOKS.length,80);assert.equal(new Set(SKILL_BOOKS.map(b=>b.itemId)).size,80);
 for(const b of SKILL_BOOKS){assert.equal(b.itemId,'skillbook:'+b.skillId);assert.equal(bookName(b.skillId),b.name);assert.equal(skillBookFor(b.skillId)?.grade,b.grade);}
 assert.equal(skillBookFor('made_up'),null);
 const state=initialState();state.skillBooks.sword_strike_ssr=10;
 assert.ok(inventoryView(state).some(i=>i.name==='종언의 참격 스킬북'&&i.quantity===10&&i.facts?.includes('SSR 등급')));
});
