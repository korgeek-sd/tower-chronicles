import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('EQUIPMENT LOOP 01: legacy equipment screen is not part of active routing',()=>{
 const main=read('src/main.tsx'),core=read('src/components/mobile/CoreScreens.tsx');
 assert.doesNotMatch(main,/EquipmentScreen|page==='equipment'/);
 assert.doesNotMatch(core,/export function EquipmentScreen|\|'equipment'/);
 assert.match(core,/onMove\('inventory'\)[\s\S]*장비 확인/);
});

test('EQUIPMENT LOOP 02: inventory exposes enhancement as the next action in the V2 loop',()=>{
 const main=read('src/main.tsx'),inventory=read('src/components/inventory/InventoryScreen.tsx');
 assert.match(main,/InventoryScreen[\s\S]*onEnhancement=\{\(\)=>setPage\('enhancement'\)\}/);
 assert.match(inventory,/onEnhancement/);
 assert.match(inventory,/>강화<\/button>/);
});

test('EQUIPMENT LOOP 03: enhancement returns to storage and contains no workshop wording',()=>{
 const main=read('src/main.tsx'),screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(main,/page==='enhancement'[\s\S]*onBack=\{\(\)=>setPage\('inventory'\)\}/);
 assert.doesNotMatch(screen,/WORKSHOP|제작으로/);
 assert.match(screen,/보관함으로/);
});

test('EQUIPMENT LOOP 04: skill screen remains implemented after camp shortcut removal',()=>{
 const core=read('src/components/mobile/CoreScreens.tsx'),main=read('src/main.tsx');
 assert.match(core,/\|'skills'/);
 assert.match(core,/export function SkillsScreen/);
 assert.match(main,/page==='skills'/);
 const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function TowersScreen'));
 assert.doesNotMatch(home,/title:'전투 스킬'/);
 assert.doesNotMatch(home,/onMove\('skills'\)/);
});
