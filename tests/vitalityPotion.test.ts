import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {unifiedInventoryView} from '../src/game/life/inventory';import {initialState} from '../src/game/engine/state';
test('reward vitality potion is visible in potions inventory, bound and not craftable',()=>{
 const items=unifiedInventoryView(initialState(),{materials:{},products:{vitality_potion:2}} as any);
 const item=items.find(i=>i.lifeProduct==='vitality_potion');assert.ok(item);assert.equal(item.quantity,2);assert.equal(item.category,'potions');assert.match(item.description,/100/);assert.match(item.description,/거래 불가/);
 const recipe=readFileSync('src/game/life/crafting.ts','utf8').split('export const CRAFT_RECIPES')[1].split('export interface')[0];assert.ok(!recipe.includes("id:'vitality_potion'"));
});
