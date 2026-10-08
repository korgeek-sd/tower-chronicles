import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
const render=(game=initialState())=>renderToStaticMarkup(React.createElement(InventoryScreen,{game,setGame:()=>{},onEnhancement:()=>{}}));

test('empty loadout exposes all seven real slots without preview controls or invented equipment',()=>{
 const game=initialState();game.equipmentItems=[];
 const before=JSON.stringify(game),html=render(game);
 assert.doesNotMatch(html,/테스트 장비 채우기|체험 모드|체험 종료|tc-inventory-sandbox/);
 assert.match(html,/tc-loadout-renewed/);
 assert.match(html,/0\/7 장착/);
 for(const name of ['무기','투구','갑옷','장갑','장화','목걸이','반지'])assert.ok(html.includes(name),name);
 assert.equal((html.match(/class="tc-equip-slot /g)||[]).length,7);
 assert.equal(JSON.stringify(game),before);
});

test('real equipped gear keeps its identity and grade without enhancement in renewed slots',()=>{
 const game=initialState();game.equipmentItems=[{id:'real-armor',kind:'return_corps_plate_armor',grade:'heroic',enhancement:4}];game.equipped.armor='real-armor';
 const html=render(game);
 assert.match(html,/1\/7 장착/);
 assert.match(html,/tc-equip-copy/);
 assert.match(html,/영웅/);
 assert.doesNotMatch(html,/강화|\+4/);
 assert.match(html,/aria-label="갑옷 영웅 귀환대 판금갑"/);
 assert.doesNotMatch(html,/tc-equip-impact/);
});

test('inventory has no remaining sandbox code branches',()=>{
 const source=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/sandboxGame|INVENTORY_SANDBOX_EQUIPMENT|startInventorySandbox/);
});
