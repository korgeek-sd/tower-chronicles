import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {assetUrl} from '../src/game/data/graphics';
import {initialState} from '../src/game/engine/state';
import {initialHuntingState} from '../src/game/hunting/model';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';

test('grave-digging hound loads exact newly imported PNG, retaining server encounter metadata',()=>{
 const monster=HUNT_MONSTERS.plains[0];
 assert.equal(monster.name,'무덤파는 들개');
 assert.equal(monster.image,'assets/monsters/new/plains/grave_digger_hound.svg');
 assert.equal(assetUrl(monster.image),'./assets/monsters/new/plains/grave_digger_hound.png');
 assert.ok(existsSync(new URL('../public/assets/monsters/new/plains/grave_digger_hound.png',import.meta.url)));
 assert.ok(existsSync(new URL('../public/assets/characters/preview/grave_hound_job_reference.jpg',import.meta.url)));
});
test('preview link compares supplied job and actual hound in hunting screen, without changing normal class selection',()=>{
 const shared={game:initialState(),hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}};
 const preview=renderToStaticMarkup(React.createElement(HuntingScreen,{...shared,previewAppearance:true}));
 const normal=renderToStaticMarkup(React.createElement(HuntingScreen,{...shared,previewAppearance:false}));
 assert.match(preview,/외형 비교 미리보기/);
 assert.match(preview,/무덤파는 들개 · 직업 외형 비교/);
 assert.match(preview,/assets\/characters\/preview\/grave_hound_job_reference.jpg/);
 assert.match(preview,/assets\/monsters\/new\/plains\/grave_digger_hound.png/);
 assert.doesNotMatch(normal,/외형 비교 미리보기/);
 assert.doesNotMatch(normal,/assets\/characters\/preview\/grave_hound_job_reference.jpg/);
});
