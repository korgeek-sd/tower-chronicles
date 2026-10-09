import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
const render=(game=initialState())=>renderToStaticMarkup(React.createElement(InventoryScreen,{game,setGame:()=>{},onEnhancement:()=>{}}));

test('inventory devotes its body to storage without character or equipment slots',()=>{
 const game=initialState();game.equipmentItems=[];
 const html=render(game);
 assert.doesNotMatch(html,/tc-loadout-stage|tc-loadout-character|tc-equip-slot|테스트 장비 채우기/);
 assert.match(html,/tc-storage-only/);
 assert.match(html,/자동 장착/);
 assert.match(html,/tc-storage-grid/);
});

test('inventory has no remaining sandbox code branches',()=>{
 const source=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/sandboxGame|INVENTORY_SANDBOX_EQUIPMENT|startInventorySandbox/);
});
