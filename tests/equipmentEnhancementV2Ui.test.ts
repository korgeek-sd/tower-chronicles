import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/enhancement/EnhancementScreen.tsx',import.meta.url),'utf8');
const presentation=readFileSync(new URL('../src/components/enhancement/presentation.ts',import.meta.url),'utf8');
const economy=readFileSync(new URL('../src/online/economy.ts',import.meta.url),'utf8');

test('V2 ENHANCE UI 01: enhancement screen lists equipmentItems rather than legacy items',()=>{
 assert.match(screen,/activeGame\.equipmentItems/);
 assert.doesNotMatch(screen,/game\.items\.slice/);
 assert.match(screen,/equipmentItemName/);
});

test('V2 ENHANCE UI 02: preview and confirmation show Enhancement Stone cost and exact four outcomes',()=>{
 assert.match(presentation,/equipmentEnhancementQuote/);
 assert.match(screen,/강화석/);
 assert.match(screen,/stoneCost/);
 for(const label of ['성공','유지','하락','파괴'])assert.ok(screen.includes(label));
});

test('V2 ENHANCE UI 03: server result controls game-feel and destroyed selection clears naturally',()=>{
 assert.match(screen,/enhanceOnlineEquipment/);
 assert.match(screen,/playResult\(result\.outcome,currentLevel/);
 assert.match(screen,/feel\.play\('enhancement\.result',\{outcome:mapped\}\)/);
 assert.match(screen,/equipmentItems\.some/);
});

test('V2 ENHANCE UI 04: new server errors have Korean mappings',()=>{
 for(const key of ['ENHANCE_STONE_SHORTAGE','ENHANCE_MAX_LEVEL','ENHANCE_STARTER_PROTECTED','ENHANCE_EXPEDITION_BLOCKED'])assert.match(economy,new RegExp(key));
});
