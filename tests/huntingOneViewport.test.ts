import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {HUNT_MAPS,initialHuntingState,resolveHunt} from '../src/game/hunting/model';

const css=readFileSync(new URL('../src/components/hunting/hunting.css',import.meta.url),'utf8');
const streamCss=readFileSync(new URL('../src/components/hunting/combat-stream.css',import.meta.url),'utf8');
const v2Css=readFileSync(new URL('../src/components/hunting/hunting-result-v2.css',import.meta.url),'utf8');
const screenSource=readFileSync(new URL('../src/components/hunting/HuntingScreen.tsx',import.meta.url),'utf8');

test('hunting results explicitly switch to a distinct single-screen layout while region selection is unchanged',()=>{
 assert.match(screenSource,/data-view=\{view\}/);
 assert.match(screenSource,/view==='result'&&<HuntingVitality/);
 assert.match(screenSource,/view==='regions'&&<button type="button" className="tc-hunt-preview-toggle"/);
 assert.match(css,/\.tc-main\.tc-hunt-main > \.tc-hunt\[data-view="result"\]\s*\{[^}]*height:100%;[^}]*overflow:hidden/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] > \.tc-hunt-vitality\s*\{\s*display:none/);
});

test('result grid shows banner, equal combatants, rewards, short history and fixed action row',()=>{
 assert.match(v2Css,/\.tc-hunt-result-v2 \.tc-hunt-result-fighters\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(v2Css,/\.tc-hunt-result-v2 \.tc-hunt-reward-grid\{display:grid;grid-template-columns:repeat\(3/);
 assert.match(v2Css,/\.tc-hunt-result-v2 \.tc-hunt-stream-preview\{[\s\S]*?align-content:start/);
 assert.match(v2Css,/\.tc-hunt-result-v2 \.tc-hunt-repeat-dock\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
 assert.match(v2Css,/\.tc-hunt-stream-dialog\[open\]/);
 assert.match(streamCss,/\.tc-hunt-stream-feed\{[^}]*min-height:0;overflow-y:auto/);
});

test('short and narrow viewport overrides shrink chrome without removing HP, MP or the hunt action',()=>{
 assert.match(css,/@media \(max-width:380px\)/);
 assert.match(css,/@media \(max-height:640px\)/);
 assert.match(css,/@media \(max-height:520px\)/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-hp \[role=progressbar\],[\s\S]*?height:8px/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-mp \[role=progressbar\]/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-repeat-dock > \.tc-hunt-next\s*\{[^}]*height:42px/);
});

test('every hunting map still offers two sprite frames, HP/MP, rewards, history and next-hunt control',()=>{
 const game=initialState();
 for(const map of HUNT_MAPS){
  const hunting=resolveHunt(initialHuntingState(0),map.id,{hp:600,attack:40,defense:25},['heavy'],0,()=>.7).state;
  const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game,hunting,now:0,busy:false,onHunt:()=>{},onSettings:()=>{},previewAppearance:false}));
  assert.match(html,/data-view="regions"/);
  assert.match(html,/class="tc-hunt-result-page tc-hunt-result-v2"/);
  const page=html.split('<section class="tc-hunt-result-page tc-hunt-result-v2"')[1]?.split('</section>')[0]??'';
  assert.match(page,/class="tc-hunt-fighter tc-hunt-panel player"/);
  assert.match(page,/class="tc-hunt-fighter tc-hunt-panel enemy/);
  assert.match(page,/전투 승리|전투 패배/);
  assert.match(page,/획득 보상/);
  assert.match(page,/전체 기록 보기/);
  assert.match(page,/사냥터 변경/);
  assert.equal((page.match(/class="tc-hunt-art"/g)??[]).length,2);
  assert.equal((page.match(/aria-label="[^"]+ HP"/g)??[]).length,2);
  assert.equal((page.match(/aria-label="[^"]+ MP"/g)??[]).length,2);
  assert.match(page,/tc-hunt-stream tc-hunt-panel/);
  assert.doesNotMatch(page,/전투 기록 보기|스킬 보기/);
  assert.match(page,/tc-hunt-repeat-dock/);
  assert.match(page,/다음 전투/);
 }
});
