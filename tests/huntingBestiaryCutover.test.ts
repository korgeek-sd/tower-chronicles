import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,existsSync} from 'node:fs';
import {BestiaryScreen} from '../src/components/bestiary/BestiaryScreen';
import {initialState} from '../src/game/engine/state';
import {HUNT_MAPS} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';

test('current monster encyclopedia is backed by the five active hunting maps and twenty-five monsters',()=>{
 assert.equal(HUNT_MAPS.length,5);
 assert.equal(HUNT_MAPS.reduce((n,map)=>n+HUNT_MONSTERS[map.id].length,0),25);
 const html=renderToStaticMarkup(React.createElement(BestiaryScreen,{game:initialState(),onBack:()=>{}}));
 assert.match(html,/사냥 생물록/);
 assert.match(html,/외곽 평야/);
 assert.match(html,/무덤파는 들개/);
 assert.match(html,/assets\/monsters\/new\/plains/);
 assert.doesNotMatch(html,/철맥의 첨탑|붉은 송곳니의 성소|천광의 수정탑|칼레온의 녹빛 첨탑/);
});

test('player-facing encyclopedia does not import retired tower encounter catalogs',()=>{
 const source=readFileSync(new URL('../src/components/bestiary/BestiaryScreen.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/data\/bestiary|bestiaryEntriesForTower|towerIds|TOWERS|graphicFor/);
 assert.match(source,/HUNT_MONSTERS/);
});

test('retired expedition helper entry point and unused area names are absent from live source',()=>{
 assert.equal(existsSync(new URL('../src/game/engine/exploration.ts',import.meta.url)),false);
 assert.equal(existsSync(new URL('../src/components/RegionBackgrounds.tsx',import.meta.url)),false);
});
