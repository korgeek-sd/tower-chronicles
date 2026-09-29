import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('ENHANCE UI 01: selected equipment summary separates grade, name and enhancement step',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-forge-title/);
 assert.match(screen,/tc-forge-grade/);
 assert.match(screen,/tc-forge-level/);
});

test('ENHANCE UI 02: stat preview explicitly labels current, success and delta values',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-forge-stat-head/);
 assert.match(screen,/>현재</);
 assert.match(screen,/>성공 시</);
 assert.match(screen,/>변화</);
 assert.match(screen,/tc-forge-stat-row/);
});

test('ENHANCE UI 03: four outcome cards remain visible with semantic classes',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 for(const cls of ['success','keep','downgrade','destroy'])assert.match(screen,new RegExp('className="'+cls+'"'));
 for(const label of ['성공','유지','하락','파괴'])assert.ok(screen.includes(label));
});

test('ENHANCE UI 04: Silver and enhancement stones show cost and owned amount before confirmation',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-forge-costs/);
 assert.match(screen,/Silver/);
 assert.match(screen,/game\.silver\.toLocaleString\(\)/);
 assert.match(screen,/view\.materialOwned\.toLocaleString\(\)/);
 assert.match(screen,/보유/);
});

test('ENHANCE UI 05: permanent-destruction warning is driven by positive destroy chance',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/q\.failDestroyRate>0&&<[\s\S]*tc-forge-confirm-danger/);
 assert.match(screen,/파괴된 장비는 복구할 수 없습니다/);
});

test('ENHANCE UI 06: mobile enhancement layout stays one-screen and prioritizes the workbench',()=>{
 const css=read('src/mobile-game.css');
 const section=css.slice(css.indexOf('/* v0.1.83 — NOVAR FORGE'));
 assert.match(section,/\.tc-forge\{[^}]*height:100%/);
 assert.match(section,/\.tc-forge-workbench\{[^}]*min-height:0/);
 assert.match(section,/\.tc-forge-costs/);
 assert.match(section,/@media\(max-width:380px\)/);
});
