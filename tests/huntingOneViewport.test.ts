import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {HUNT_MAPS,initialHuntingState,resolveHunt} from '../src/game/hunting/model';

const css=readFileSync(new URL('../src/components/hunting/hunting.css',import.meta.url),'utf8');
const screenSource=readFileSync(new URL('../src/components/hunting/HuntingScreen.tsx',import.meta.url),'utf8');

test('hunting results explicitly switch to a distinct single-screen layout while region selection is unchanged',()=>{
 assert.match(screenSource,/data-view=\{view\}/);
 assert.match(screenSource,/view==='result'&&<span className="tc-hunt-result-vitality"/);
 assert.match(screenSource,/view==='regions'&&<button type="button" className="tc-hunt-preview-toggle"/);
 assert.match(css,/\.tc-main\.tc-hunt-main > \.tc-hunt\[data-view="result"\]\s*\{[^}]*height:100%;[^}]*overflow:hidden/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] > \.tc-hunt-vitality\s*\{\s*display:none/);
});

test('result grid gives both full-width fighter rows the same flexible height above rewards, history and next battle',()=>{
 const re=/\.tc-hunt\[data-view="result"\] > \.tc-hunt-result-page\s*\{([^}]*)\}/;
 const match=css.match(re);
 assert.ok(match);
 assert.match(match[1],/display:grid/);
 assert.match(match[1],/grid-template-rows:minmax\(0,1fr\) minmax\(0,1fr\) auto auto/);
 assert.match(match[1],/grid-template-columns:minmax\(0,1fr\) minmax\(80px,90px\)/);
 assert.match(match[1],/overflow:hidden/);
 const cards=css.match(/\.tc-hunt\[data-view="result"\] \.tc-hunt-result-page > \.tc-hunt-fighter,[\s\S]*?\{([^}]*)\}/);
 assert.ok(cards);
 assert.match(cards[1],/grid-column:1 \/ -1/);
 assert.match(cards[1],/height:100%/);
 assert.match(cards[1],/max-height:100%/);
 assert.match(cards[1],/min-height:0/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-records-button\s*\{[^}]*grid-column:2/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-repeat-dock\s*\{[^}]*grid-column:1 \/ -1/);
 assert.match(css,/\.tc-hunt\[data-view="result"\] \.tc-hunt-repeat-dock\s*\{[^}]*display:grid/);
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
  assert.match(html,/class="tc-hunt-result-page"/);
  const page=html.split('<section class="tc-hunt-result-page"')[1]?.split('</section>')[0]??'';
  assert.match(page,/class="tc-hunt-fighter tc-hunt-panel player"/);
  assert.match(page,/class="tc-hunt-fighter tc-hunt-panel enemy/);
  assert.equal((page.match(/class="tc-hunt-art"/g)??[]).length,2);
  assert.equal((page.match(/aria-label="[^"]+ HP"/g)??[]).length,2);
  assert.equal((page.match(/aria-label="[^"]+ MP"/g)??[]).length,2);
  assert.match(page,/tc-hunt-reward-arrived|tc-hunt-result tc-hunt-panel/);
  assert.match(page,/tc-hunt-records-button/);
  assert.match(page,/tc-hunt-repeat-dock/);
  assert.match(page,/다음 전투/);
 }
});
