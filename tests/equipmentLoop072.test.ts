import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('EQUIPMENT LOOP 01: legacy equipment screen is not part of active routing',()=>{
 const main=read('src/main.tsx'),core=read('src/components/mobile/CoreScreens.tsx');
 assert.doesNotMatch(main,/EquipmentScreen|page==='equipment'/);
 assert.doesNotMatch(core,/export function EquipmentScreen|\|'equipment'/);
 assert.match(core,/id:'inventory',glyph:'equipment',name:'장비 확인',action:\(\)=>onMove\('inventory'\)/);
});

test('EQUIPMENT LOOP 02: inventory has no enhancement actions',()=>{const inventory=read('src/components/inventory/InventoryScreen.tsx');assert.doesNotMatch(inventory,/>강화<\/button>|enhancementAction=/);});

test('EQUIPMENT LOOP 03: retired enhancement screen cannot run in the active app',()=>{assert.doesNotMatch(read('src/main.tsx'),/<EnhancementScreen/);});

test('EQUIPMENT LOOP 04: new permanent-class screen replaces the legacy skillbook entry',()=>{
 const core=read('src/components/mobile/CoreScreens.tsx'),main=read('src/main.tsx');
 assert.match(core,/\|'skills'/);
 assert.match(main,/<ClassProfessionScreen key=/);
 assert.match(main,/page==='skills'/);
 const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function SkillsScreen'));
 assert.doesNotMatch(home,/title:'전투 스킬'/);
 assert.match(home,/id:'skills',glyph:'jobs',name:'직업'/);
 assert.match(home,/onMove\('skills'\)/);
});
