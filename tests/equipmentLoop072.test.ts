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

test('EQUIPMENT LOOP 02: inventory has no enhancement actions',()=>{const inventory=read('src/components/inventory/InventoryScreen.tsx');assert.doesNotMatch(inventory,/>강화<\/button>|enhancementAction=/);});

test('EQUIPMENT LOOP 03: retired enhancement screen cannot run in the active app',()=>{assert.doesNotMatch(read('src/main.tsx'),/<EnhancementScreen/);});

test('EQUIPMENT LOOP 04: skill tree is accessible from the camp and routed to its grid screen',()=>{
 const core=read('src/components/mobile/CoreScreens.tsx'),main=read('src/main.tsx');
 assert.match(core,/\|'skills'/);
 assert.match(main,/<SkillTreeScreen game=\{game\}/);
 assert.match(main,/page==='skills'/);
 const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function TowersScreen'));
 assert.doesNotMatch(home,/title:'전투 스킬'/);
 assert.match(home,/title:'스킬트리'/);
 assert.match(home,/onMove\('skills'\)/);
});
