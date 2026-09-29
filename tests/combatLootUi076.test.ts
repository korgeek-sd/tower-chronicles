import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('COMBAT LOOT UI 01: battle exposes a persistent expedition-loot entry',()=>{
 const screen=read('src/components/battle/BattleScreen.tsx');
 assert.match(screen,/tc-ref-loot-entry/);
 assert.match(screen,/>전리품</);
 assert.match(screen,/setPanel\('loot'\)/);
 assert.match(screen,/lootTotals\(e\.loot\)/);
});

test('COMBAT LOOT UI 02: a newly acquired equipment item produces a temporary drop toast',()=>{
 const screen=read('src/components/battle/BattleScreen.tsx');
 assert.match(screen,/seenEquipmentIds/);
 assert.match(screen,/dropToast/);
 assert.match(screen,/tc-equipment-drop-toast/);
 assert.match(screen,/특템 획득/);
 assert.match(screen,/안전 귀환 시 보관함 확정/);
});

test('COMBAT LOOT UI 03: loot panel clearly marks expedition loot as temporary',()=>{
 const screen=read('src/components/battle/BattleScreen.tsx');
 assert.match(screen,/panel==='loot'/);
 assert.match(screen,/원정 전리품/);
 assert.match(screen,/안전 귀환 전 임시 보관/);
 assert.match(screen,/아직 내 재산이 아닙니다/);
});

test('COMBAT LOOT UI 04: loot panel summarizes Silver materials equipment and enhancement stones',()=>{
 const screen=read('src/components/battle/BattleScreen.tsx');
 assert.match(screen,/lootSummary\.materials/);
 assert.match(screen,/lootSummary\.equipment/);
 assert.match(screen,/enhancementStones/);
 assert.match(screen,/e\.loot\.silver\.toLocaleString\(\)/);
 assert.match(screen,/강화석/);
});

test('COMBAT LOOT UI 05: equipment loot cards show deterministic grade, name and enhancement',()=>{
 const screen=read('src/components/battle/BattleScreen.tsx');
 assert.match(screen,/EQUIPMENT_GRADE_NAMES/);
 assert.match(screen,/EQUIPMENT_DEFINITIONS/);
 assert.match(screen,/tc-loot-equipment-card/);
 assert.match(screen,/item\.enhancement/);
});

test('COMBAT LOOT UI 06: battle loot UI remains overlay-based and bounded to one screen',()=>{
 const css=read('src/mobile-game.css');
 assert.match(css,/\.tc-ref-loot-entry\{[^}]*position:absolute/);
 assert.match(css,/\.tc-equipment-drop-toast\{[^}]*position:absolute/);
 assert.match(css,/\.tc-loot-panel-body\{[^}]*min-height:0[^}]*overflow:hidden/);
 assert.match(css,/\.tc-loot-equipment-list\{[^}]*min-height:0/);
});
