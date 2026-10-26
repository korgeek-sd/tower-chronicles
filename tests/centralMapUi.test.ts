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
