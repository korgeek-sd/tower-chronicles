import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const inventory=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/inventory/InventoryDetailSheet.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('INVENTORY UI 0.1.81 01: quartermaster loadout keeps seven live equipment slots',()=>{
 assert.match(inventory,/NOVAR QUARTERMASTER \/ LOADOUT/);
 assert.match(inventory,/equippedCount/);
 assert.match(inventory,/원정 장비/);
 assert.match(inventory,/Object\.keys\(SLOTS\)/);
 assert.match(inventory,/tc-equip-slot/);
});

test('INVENTORY UI 0.1.81 02: storage grid exposes grade enhancement and comparison state',()=>{
 assert.match(inventory,/tc-storage-item/);
 assert.match(inventory,/grade-/);
 assert.match(inventory,/tc-storage-enhance/);
 assert.match(inventory,/equipmentStatComparison/);
 assert.match(inventory,/aria-pressed=\{selected===i\.key\}/);
});

test('INVENTORY UI 0.1.81 03: equipment detail has before-after comparison and enhancement shortcut',()=>{
 assert.match(detail,/tc-stat-compare-head/);
 assert.match(detail,/현재/);
 assert.match(detail,/장착 후/);
 assert.match(detail,/enhancementAction/);
 assert.match(inventory,/onEnhancement/);
});

test('INVENTORY UI 0.1.81 04: narrow phone rules protect controls without external UI assets',()=>{
 const section=css.slice(css.indexOf('/* v0.1.81 — QUARTERMASTER LOADOUT'));
 assert.match(section,/@media\(max-width:380px\)/);
 assert.match(section,/\.tc-inventory-v081 \.tc-storage-categories button\{height:40px;min-height:40px\}/);
 assert.match(section,/\.tc-item-record \.tc-item-modal-actions\{grid-auto-rows:44px\}/);
 assert.match(section,/@media\(max-width:340px\)/);
 assert.equal(/url\s*\(/i.test(section),false);
});
