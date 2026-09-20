import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CampBagShell} from '../src/components/camp-bag/CampBagShell';
import {initialState} from '../src/game/engine/state';
import {BOTTOM_NAV_ITEMS} from '../src/components/mobile/navigation';

test('camp bag chrome preserves all six destinations and real currency',()=>{
 const game=initialState();game.silver=123456;game.market.gold=789;
 const html=renderToStaticMarkup(React.createElement(CampBagShell,{game,currentPage:'inventory',onNavigate:()=>{},saved:'자동 저장됨',storageError:'',children:null}));
 assert.equal(BOTTOM_NAV_ITEMS.length,6);
 for(const entry of BOTTOM_NAV_ITEMS)assert.ok(html.includes(entry.label));
 assert.match(html,/Silver 123,456/);assert.match(html,/Gold 789/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.doesNotMatch(html,/mobile-screen-fit/);
});

test('only home and inventory bypass the legacy pager',()=>{
 const source=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(page==='home'\|\|page==='inventory'\)return <CampBagShell/);
 assert.equal((source.match(/<InventoryScreen /g)||[]).length,1);
 assert.ok(source.indexOf('<CampBagShell')<source.indexOf('<MobileScreenPager'));
 for(const page of ['towers','floor','battle'])assert.ok(source.includes(`page==='${page}'`));
});

test('camp shell has a legacy viewport fallback and isolated header reset',()=>{
 const css=readFileSync(new URL('../src/components/camp-bag/camp-bag.css',import.meta.url),'utf8');
 assert.match(css,/height:100vh;height:100dvh/);
 assert.match(css,/\.app\.camp-bag-mode>\.camp-header\{[^}]*margin:0;border:0;border-image:none/);
});
