import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES} from '../src/game/life/inventory';
import {selectInventory,categoryNames} from '../src/game/inventoryView';
import {InventoryItemArt,InventoryStackCount} from '../src/components/inventory/InventoryDetailSheet';

test('current inventory offers equipment, skillbooks and life categories and keeps challenge tickets in other',()=>{
 assert.deepEqual(LIFE_INVENTORY_CATEGORIES.map(c=>categoryNames[c]),['전체','장비','스킬북','재료','포션','음식','기타']);
 const life:any={materials:{herb:20},products:{challenge_ticket:5,potion:1234,attack_food:2}};
 const items=unifiedInventoryView(initialState(),life);
 assert.equal(selectInventory(items,'other')[0]?.lifeProduct,'challenge_ticket');
 assert.equal(selectInventory(items,'other')[0]?.quantity,5);
 assert.equal(selectInventory(items,'potions')[0]?.quantity,1234);
 assert.equal(selectInventory(items,'foods').length,1);
 assert.equal(selectInventory(items,'materials')[0]?.quantity,20);
 assert.equal(selectInventory(items,'all').length,items.length);
});

test('inventory slot artwork can fill its slot without changing framed detail artwork',()=>{
 const item=unifiedInventoryView(initialState(),{materials:{herb:20},products:{}} as any).find(i=>i.lifeMaterial==='herb')!;
 const slot=renderToStaticMarkup(React.createElement(InventoryItemArt,{item,slot:true} as any));
 const detail=renderToStaticMarkup(React.createElement(InventoryItemArt,{item}));
 assert.match(slot,/tc-inventory-slot-art/);
 assert.doesNotMatch(slot,/width:1em/);
 assert.match(detail,/width:1em/);
 assert.match(slot,/data-craft-art="herb"/);
});

test('inventory item slots show quantity and equipped status without a loadout panel',()=>{
 const game=initialState();
 game.equipmentItems=[{id:'compact-armor',kind:'return_corps_plate_armor',grade:'rare',enhancement:3}];
 game.equipped.armor='compact-armor';
 const html=renderToStaticMarkup(React.createElement(InventoryScreen,{game,setGame:()=>{},onEnhancement:()=>{}}));
 assert.doesNotMatch(html,/tc-loadout-stage/);
 assert.match(html,/tc-storage-grid/);
 assert.doesNotMatch(html,/tc-storage-count/);
 assert.match(html,/aria-label="[^"]*1개[^"]*희귀[^"]*장착 중/);
 assert.doesNotMatch(html,/tc-storage-impact/);
 assert.match(html,/aria-label="기타"/);
});

test('stack counts show exact grouped quantities but omit single items and equipment',()=>{
 const items=unifiedInventoryView(initialState(),{materials:{herb:200},products:{potion:3000,attack_food:1}} as any);
 const count=(id:string)=>renderToStaticMarkup(React.createElement(InventoryStackCount,{item:items.find(i=>i.lifeMaterial===id||i.lifeProduct===id)!}));
 assert.match(count('herb'),/>200</);
 assert.match(count('potion'),/>3,000</);
 assert.equal(count('attack_food'),'');
 assert.equal(renderToStaticMarkup(React.createElement(InventoryStackCount,{item:{...items[0],stack:false,quantity:1}})),'');
});
