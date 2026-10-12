import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {MarketScreen} from '../src/components/market/MarketScreen';
test('local market uses the scoped metal skin while preserving search and grade filters',()=>{
 const html=renderToStaticMarkup(React.createElement(MarketScreen,{game:initialState(),setGame:()=>{}}));
 assert.match(html,/tc-iron-market-screen/);assert.match(html,/거래 품목 검색/);assert.match(html,/스킬북/);assert.match(html,/tc-market-v4-card/);
});
test('local and server market share the skin on list, detail and order views with labelled order inputs',()=>{
 for(const name of ['MarketScreen','ServerMarketScreen']){
  const source=readFileSync(new URL('../src/components/market/'+name+'.tsx',import.meta.url),'utf8');
  const screens=source.match(/<Screen[^>]*eyebrow="SILVER SCALE[^\n]*/g)??[];
  assert.ok(screens.length>=3);
  for(const screen of screens)assert.ok(screen.includes('className="tc-iron-market-screen"'));
  assert.match(source,/aria-label="주문 가격"/);assert.match(source,/aria-label="주문 수량"/);
 }
});
