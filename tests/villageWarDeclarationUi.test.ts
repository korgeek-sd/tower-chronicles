import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {WorldMapScreen} from '../src/components/world/WorldMapScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageWarState} from '../src/online/villageWar';

const war:VillageWarState={
 cycleKey:'2026-10-12',phase:'BIDDING',bidClosesAt:'2026-10-16T13:00:00Z',
 battleStartsAt:'2026-10-17T13:00:00Z',myAssociationId:'guild-one',
 myRole:'LEADER',tickets:120,guildTickets:120,declarations:[{townId:'herb-1',associationId:'guild-two',associationName:'붉은달'}],
};

test('world map preserves all 11 towns and central city while showing declaration entry',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},towns:undefined,war,onDeclareWar:()=>{}}));
 assert.equal((html.match(/data-town-id=/g)??[]).length,11);
 assert.match(html,/노바르/);assert.match(html,/달그늘/);
 assert.match(html,/선전포고/);assert.match(html,/100장/);
 assert.match(html,/공용 도전권/);
});
test('non-leaders can see declaration status without active declaration control',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},war:{...war,myRole:'MEMBER'},onDeclareWar:()=>{}}));
 assert.match(html,/길드장만 선전포고 가능/);
 assert.doesNotMatch(html,/data-action="declare-war"/);
});
test('server phase disables declaration entry outside bidding',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},war:{...war,phase:'BATTLE'},onDeclareWar:()=>{}}));
 assert.match(html,/선전포고 기간이 아닙니다/);
 assert.doesNotMatch(html,/data-action="declare-war"/);
});
test('client declaration is never shown as completed based on preview owners',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},war,onDeclareWar:()=>{}}));
 assert.equal(WORLD_TOWNS.length,11);
 assert.match(html,/0개 길드/);
});

test('war declaration uses shared tickets and ignores the leader private ticket count',()=>{
 const html=renderToStaticMarkup(React.createElement(WorldMapScreen,{currentId:'city',onTravel:()=>{},war:{...war,tickets:500,guildTickets:15},onDeclareWar:()=>{}}));
 assert.match(html,/공용 도전권이 100장보다 부족합니다/);
 assert.doesNotMatch(html,/data-action="declare-war" disabled=""/);
 assert.match(html,/공용 도전권 <b>15장<\/b>/);
});
