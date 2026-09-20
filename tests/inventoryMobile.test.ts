import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {inventoryView} from '../src/game/inventoryView';
import {InventoryScreen} from '../src/components/inventory/InventoryScreen';
import {InventoryDetailSheet} from '../src/components/inventory/InventoryDetailSheet';

function stockedInventory(){
  const game=initialState();
  for(const tower of Object.keys(game.materials) as (keyof typeof game.materials)[]){
    game.materials[tower]=[1,1,1,1,1];
  }
  return game;
}

test('inventory renders only the standard-height mobile page of 16 slots',()=>{
  const game=stockedInventory();
  const html=renderToStaticMarkup(React.createElement(InventoryScreen,{
    game,
    setGame:()=>{},
  }));
  assert.equal((html.match(/class="inventory-slot/g)||[]).length,16);
  assert.match(html,/class="page-stepper"/);
  assert.match(html,/1 \/ 2/);
});

test('inventory detail uses the shared bottom sheet instead of a scrolling inventory sheet',()=>{
  const game=initialState();
  const item=inventoryView(game)[0];
  const html=renderToStaticMarkup(React.createElement(InventoryDetailSheet,{
    item,
    onClose:()=>{},
  }));
  assert.match(html,/class="bottom-sheet"/);
  assert.doesNotMatch(html,/inventory-sheet/);
});

test('inventory mobile layout is fixed to a four-column no-scroll content region',()=>{
  const css=readFileSync(new URL('../src/components/inventory/inventory.css',import.meta.url),'utf8');
  assert.match(css,/\.inventory-screen\{[^}]*height:100%[^}]*grid-template-rows:auto auto auto minmax\(0,1fr\) auto[^}]*overflow:hidden/);
  assert.match(css,/\.inventory-grid\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[^}]*overflow:hidden/);
  assert.match(css,/\.inventory-slot\{[^}]*min-height:44px/);
  assert.doesNotMatch(css,/overflow-y:auto/);
});

test('inventory resets paging when category, query, sorting, or filters change',()=>{
  const source=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/setPage\(0\)/);
  assert.match(source,/\[category,query,sort,filter\.tier,filter\.status\]/);
});
