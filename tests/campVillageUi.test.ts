import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync,statSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeScreen} from '../src/components/mobile/CoreScreens';
import {initialState} from '../src/game/engine/state';

test('village hub renders six interactive building facilities, equipped character and live chat host',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game,nickname:'마을 방문자',onMove:()=>{},onOpenJobs:()=>{},mailUnread:9}));
 assert.match(html,/tc-village-camp-screen/);
 assert.match(html,/aria-label="노바르 마을 시설 지도"/);
 for(const id of ['craft','skills','appearance-summon','gold-exchange','occupation','mail'])
  assert.equal((html.match(new RegExp('data-facility="'+id+'"','g'))??[]).length,1,id);
 assert.match(html,/novar-village-v2.webp/);
 assert.match(html,/class="tc-village-player"/);
 assert.match(html,/미확인 우편 9개/);
 assert.match(html,/출정하기/);
 assert.match(html,/aria-expanded="false" aria-controls="tc-camp-extra-facilities"/);
 assert.match(html,/id="tc-camp-chat-dock"/);
 assert.equal(JSON.stringify(game),before);
});

test('expanded home chat returns keyboard focus to the remounted expansion button',()=>{
 const source=readFileSync('src/components/WorldChat.tsx','utf8');
 assert.match(source,/ref=\{entry\} className="tc-chat-inline-expand"/);
 assert.match(source,/requestAnimationFrame\(\(\)=>entry.current\?\.focus\(\)\)/);
});

test('village scene is shipped as a bounded WebP asset',()=>{
 const image=readFileSync('public/assets/backgrounds/hub/novar-village-v2.webp');
 assert.equal(image.toString('ascii',8,12),'WEBP');
 assert.ok(statSync('public/assets/backgrounds/hub/novar-village-v2.webp').size<800_000);
});

test('quiet village uses small nameplates over touch-sized controls and an uncropped square map',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{}}));
 assert.match(html,/novar-village-v2.webp/);
 assert.equal((html.match(/class="tc-village-nameplate"/g)??[]).length,6);
 const css=readFileSync('src/components/mobile/village-camp.css','utf8');
 assert.match(css,/aspect-ratio:1/);
 assert.match(css,/\.tc-village-nameplate/);
 assert.match(css,/min-height:44px/);
});

test('bank, association and collection are visible before opening all facilities',()=>{
 const html=renderToStaticMarkup(React.createElement(HomeScreen,{game:initialState(),onMove:()=>{},onOpenJobs:()=>{}}));
 const toolbar=html.match(/<nav class="tc-village-services"[^>]*>(.*?)<\/nav>/)?.[1];
 assert.ok(toolbar,'persistent services toolbar');
 for(const id of ['bank','association','cosmetics']) assert.match(toolbar,new RegExp('data-facility="'+id+'"'));
 assert.ok(html.indexOf('tc-village-services')<html.indexOf('aria-label="주요 행동"'));
});
