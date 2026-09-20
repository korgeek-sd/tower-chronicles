import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {MarketScreen} from '../src/components/market/MarketScreen';
import {pageSizeFor} from '../src/components/mobile/mobilePagination';

test('market browse uses mobile page sizes instead of the old 30-row page',()=>{
  assert.equal(pageSizeFor('market',640),4);
  assert.equal(pageSizeFor('market',844),5);
  assert.equal(pageSizeFor('market',932),6);
  const html=renderToStaticMarkup(React.createElement(MarketScreen,{
    game:initialState(),setGame:()=>{},
  }));
  assert.equal((html.match(/class="market-row/g)||[]).length,5);
  assert.match(html,/class="page-stepper"/);
});

test('market source separates product trade and statistics views',()=>{
  const source=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/type MarketView='browse'\|'product'\|'statistics'\|'orders'\|'trades'/);
  assert.match(source,/setView\('statistics'\)/);
  assert.match(source,/setView\('product'\)/);
});

test('market resets browse paging whenever browse filters change',()=>{
  const source=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
  assert.match(source,/setPage\(0\)/);
  assert.match(source,/\[category,query,sort,tierFilter,towerFilter,gearFilter\]/);
});

test('market mobile layout has no vertical page scrolling or legacy 30-row pagination',()=>{
  const css=readFileSync(new URL('../src/components/market/market.css',import.meta.url),'utf8');
  const source=readFileSync(new URL('../src/components/market/MarketScreen.tsx',import.meta.url),'utf8');
  assert.match(css,/\.market-screen\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.doesNotMatch(css,/overflow-y:auto/);
  assert.doesNotMatch(source,/\/30/);
  assert.doesNotMatch(source,/\*30/);
});
