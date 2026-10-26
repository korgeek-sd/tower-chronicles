import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorldMapScreen} from '../src/components/world/WorldMapScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
const towns=WORLD_TOWNS.map(t=>({...t,owner:'실제 길드',tax:2,herbCapacity:30000,farmCapacity:30000,herbRemaining:0,farmRemaining:1234}));
test('central map has five primary destinations and uses real stock including zero',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},towns}));
 assert.match(html,/tc-territory-map/);
 assert.equal((html.match(/data-town-id=/g)??[]).length,5);
 assert.doesNotMatch(html,/기타 거점|tc-map-legacy/);
 assert.equal((html.match(/data-map-town=/g)??[]).length,5);
 assert.match(html,/실제 길드/);assert.match(html,/1,234/);assert.match(html,/소진/);
 assert.doesNotMatch(html,/4,200|6,800|자원별 마을/);
});
test('players at legacy settlements retain current location and travel controls',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'farm-5',onTravel:()=>{},onLife:()=>{},towns}));
 assert.match(html,/밀바람/);assert.match(html,/생산하기/);
 assert.match(html,/data-map-town="city"/);
});
test('map markers expose only compact names, field icons and depletion; detail owns quantities',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},towns}));
 const markers=[...html.matchAll(/<button[^>]*data-map-town="[^"]+"[\s\S]*?<\/button>/g)].map(m=>m[0]);
 assert.equal(markers.length,5);
 for(const marker of markers){assert.match(marker,/tc-map-nameplate/);assert.doesNotMatch(marker,/<small>|<strong>|tc-map-stock/);}
 assert.match(html,/tc-map-location-flag/);
 assert.match(html,/농산물 잔여량/);
});
test('current location flag shares a spaced label stack and redundant resource fact is absent',()=>{
 for(const currentId of ['city','herb-1','farm-1','herb-2','farm-2']){
  const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId,onTravel:()=>{},towns}));
  assert.match(html,/<span class="tc-map-label-stack"><em class="tc-map-location-flag">현재 위치<\/em><span class="tc-map-nameplate">/);
  assert.doesNotMatch(html,/생활 자원/);
  assert.match(html,/점령 길드/);assert.match(html,/생산물 세율/);assert.match(html,/잔여량/);
 }
});
