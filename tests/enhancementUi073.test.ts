import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('ENHANCE UI 01: selected equipment summary separates grade, name and enhancement step',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-enhance-summary/);
 assert.match(screen,/tc-enhance-grade/);
 assert.match(screen,/tc-enhance-step/);
});

test('ENHANCE UI 02: stat preview explicitly labels current and success values',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-enhance-stat-head/);
 assert.match(screen,/>현재</);
 assert.match(screen,/>성공 시</);
 assert.match(screen,/tc-enhance-stat-row/);
});

test('ENHANCE UI 03: four outcome cards remain visible with semantic classes',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 for(const cls of ['success','keep','downgrade','destroy'])assert.match(screen,new RegExp('tc-enhance-rate '+cls));
 assert.match(screen,/성공/);
 assert.match(screen,/유지/);
 assert.match(screen,/하락/);
 assert.match(screen,/파괴/);
});

test('ENHANCE UI 04: Silver and enhancement stones show cost and owned amount before confirmation',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/tc-enhance-resource/);
 assert.match(screen,/Silver/);
 assert.match(screen,/game\.silver\.toLocaleString\(\)/);
 assert.match(screen,/view\.materialOwned\.toLocaleString\(\)/);
 assert.match(screen,/소모/);
 assert.match(screen,/보유/);
});

test('ENHANCE UI 05: permanent-destruction warning only renders when destroy chance is positive',()=>{
 const screen=read('src/components/enhancement/EnhancementScreen.tsx');
 assert.match(screen,/q\.failDestroyRate>0\?<[\s\S]*tc-enhance-warning danger/);
 assert.match(screen,/장비가 영구 삭제됩니다/);
});

test('ENHANCE UI 06: mobile enhancement layout stays one-screen and prioritizes preview',()=>{
 const css=read('src/mobile-game.css');
 assert.match(css,/\.tc-enhance\{[^}]*height:100%/);
 assert.match(css,/\.tc-enhance-body\{[^}]*min-height:0/);
 assert.match(css,/\.tc-enhance-preview\{[^}]*overflow:hidden/);
 assert.match(css,/\.tc-enhance-resource-grid/);
});
