import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES} from '../src/game/life/inventory';
import {selectInventory,categoryNames} from '../src/game/inventoryView';

test('current inventory offers the six requested categories and keeps challenge tickets in other',()=>{
 assert.deepEqual(LIFE_INVENTORY_CATEGORIES.map(c=>categoryNames[c]),['전체','장비','재료','포션','음식','기타']);
 const life:any={materials:{herb:20},products:{challenge_ticket:5,potion:1234,attack_food:2}};
 const items=unifiedInventoryView(initialState(),life);
 assert.equal(selectInventory(items,'other')[0]?.lifeProduct,'challenge_ticket');
 assert.equal(selectInventory(items,'other')[0]?.quantity,5);
 assert.equal(selectInventory(items,'potions')[0]?.quantity,1234);
 assert.equal(selectInventory(items,'foods').length,1);
 assert.equal(selectInventory(items,'materials')[0]?.quantity,20);
 assert.equal(selectInventory(items,'all').length,items.length);
});

test('inventory keeps its loadout layout while item slots show quantity and accessible equipment status',()=>{
 const game=initialState();
 game.equipmentItems=[{id:'compact-armor',kind:'return_corps_plate_armor',grade:'rare',enhancement:3}];
 game.equipped.armor='compact-armor';
 const html=renderToStaticMarkup(React.createElement(InventoryScreen,{game,setGame:()=>{},onEnhancement:()=>{}}));
 assert.match(html,/tc-loadout-stage/);
 assert.match(html,/tc-storage-grid/);
 assert.match(html,/tc-storage-count[^>]*>1/);
 assert.match(html,/aria-label="[^"]*1개[^"]*희귀[^"]*강화 \+3[^"]*장착 중/);
 assert.doesNotMatch(html,/tc-storage-impact/);
 assert.match(html,/aria-label="기타"/);
});
