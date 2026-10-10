import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WORLD_TOWNS,canTravel} from '../src/components/world/worldMap';
import {WorldMapScreen} from '../src/components/world/WorldMapScreen';
test('world has ten specialty towns and one central city with connected travel',()=>{
 assert.equal(WORLD_TOWNS.length,11);
 assert.equal(WORLD_TOWNS.filter(t=>t.kind==='herb').length,5);
 assert.equal(WORLD_TOWNS.filter(t=>t.kind==='farm').length,5);
 for(const town of WORLD_TOWNS){const seen=new Set(['city']);while(true){const before=seen.size;for(const t of WORLD_TOWNS)if([...seen].some(id=>canTravel(id,t.id)))seen.add(t.id);if(seen.size===before)break;}assert.ok(seen.has(town.id));}
 assert.equal(canTravel('city','city'),false);assert.equal(canTravel('city','herb-1'),true);
});
test('map exposes owners, preview disclosure, selected town details and travel button',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{}}));
 assert.equal((html.match(/data-town-id=/g)??[]).length,11);
 for(const text of ['마을 이동','예시 데이터','노바르','붉은달','세율','30,000','이동하기','현재 위치'])assert.ok(html.includes(text),text);
 assert.match(html,/aria-pressed="true"/);assert.match(html,/disabled=""/);
});

test('region board separates central city from ten specialty cards and exposes resource filters',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{}}));
 assert.match(html,/tc-region-city/);assert.match(html,/tc-region-grid/);
 assert.equal((html.match(/class="tc-region-card /g)??[]).length,10);
 assert.match(html,/aria-label="자원별 마을"/);assert.match(html,/모든 생활 자원/);
 for(const a of WORLD_TOWNS)for(const b of WORLD_TOWNS)assert.equal(canTravel(a.id,b.id),a.id!==b.id);
});
