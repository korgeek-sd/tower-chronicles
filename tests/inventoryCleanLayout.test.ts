import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES,inventoryTabFor} from '../src/game/life/inventory';
import {selectInventory,categoryNames} from '../src/game/inventoryView';
import {SKILL_BOOKS} from '../src/game/skills/books';
import {marketItemIdForInventory} from '../src/game/market/marketService';

test('four inventory tabs group all consumables without changing item identities or trade routes',()=>{
 assert.deepEqual(LIFE_INVENTORY_CATEGORIES.map(c=>categoryNames[c]),['전체','장비','소모품','재료']);
 const game=initialState();game.skillBooks[SKILL_BOOKS[0].skillId]=3;
 const life:any={materials:{herb:20,stone:8},products:{potion:1200,vitality_potion:2,attack_food:3,defense_food:4,experience_food:5,challenge_ticket:6}};
 const before=JSON.stringify({game,life}),items=unifiedInventoryView(game,life);
 const consumables=selectInventory(items,'consumables');
 assert.equal(consumables.length,6);
 assert.equal(selectInventory(items,'materials').length,2);
 assert.ok(!items.some(i=>i.category==='skillbooks'));
 for(const item of consumables){
  assert.equal(item.key,'life:product:'+item.lifeProduct);
  assert.equal(item.quantity,life.products[item.lifeProduct!]);
  assert.equal(marketItemIdForInventory(game,item),item.lifeProduct==='vitality_potion'?null:item.lifeProduct==='challenge_ticket'?'other:challenge_ticket':'product:life:'+item.lifeProduct);
 }
 assert.deepEqual(selectInventory(items,'consumables','활력').map(i=>i.lifeProduct),['vitality_potion']);
 assert.equal(JSON.stringify({game,life}),before);
});
test('inventory renders exactly four text tabs and retains the existing detail-sheet entry points',()=>{
 const html=renderToStaticMarkup(React.createElement(InventoryScreen,{game:initialState(),setGame:()=>{},onEnhancement:()=>{}}));
 const tabs=html.match(/<div class="tc-storage-categories"[^]*?<\/div>/)?.[0]??'';
 assert.equal((tabs.match(/<button/g)??[]).length,4);
 assert.match(tabs,/소모품/);assert.doesNotMatch(tabs,/스킬북|포션|음식|기타|<svg/);
 assert.doesNotMatch(html,/QUARTERMASTER/);
 assert.match(html,/스킬 구성/);assert.match(html,/자동 장착/);assert.match(html,/aria-pressed="false"/);
});

test('legacy inventory shortcuts resolve to a visible tab',()=>{
 for(const category of ['potions','foods','tickets','other'] as const)assert.equal(inventoryTabFor(category),'consumables');
 assert.equal(inventoryTabFor('materials'),'materials');
 assert.equal(inventoryTabFor('skillbooks'),'all');
});
