import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {SkillTreeScreen,nextSkillSelection} from '../src/components/skills/SkillTreeScreen';
import {SKILL_TREE_CATALOG} from '../src/components/skills/catalog';
test('skill tree shows two-column codex and real ownership as image-free codex cards',()=>{
 const game=initialState();game.learned=['sword_strike_c'];game.skillBooks={sword_strike_a:1};
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{}}));
 assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='active').length,60);assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='passive').length,20);
 for(const label of ['스킬트리','참격','SSR','보급검 베기','스킬북 1권','스킬북 0권'])assert.ok(html.includes(label),label);
 assert.match(html,/습득 <b>1<\/b>/);assert.match(html,/data-status="learned"/);assert.match(html,/data-status="available"/);assert.match(html,/data-status="locked"/);assert.doesNotMatch(html,/<img|<svg/);assert.match(html,/tc-skill-codex-card/);assert.doesNotMatch(html,/<nav/);assert.match(html,/tc-skill-grade-select/);assert.doesNotMatch(html,/class="tc-skill-tree-detail"|class="tc-skill-actions"/);assert.match(html,/aria-expanded="false"/);
});
test('common passive collection contains the two SSR skills and locked details remain visible',()=>{
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game:initialState(),onHome:()=>{},initialWeapon:'any',initialType:'passive'}));
 assert.match(html,/귀환자의 맹세/);assert.match(html,/여섯 번째 각인/);assert.match(html,/최대 HP/);assert.doesNotMatch(html,/undefined|NaN/);
 const css=readFileSync(new URL('../src/components/skills/skillTree.css',import.meta.url),'utf8');assert.match(css,/repeat\(2/);assert.match(css,/min-height:44px/);assert.match(css,/safe-area-inset/);
});
test('catalog learning requires a book and active online action, with pending and learned guards',()=>{
 const game=initialState();game.skillBooks.sword_strike_c=2;
 const render=(extra:Record<string,unknown>)=>renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},initialSkillId:'sword_strike_c',...extra}));
 assert.match(render({onLearn:()=>{}}),/class="tc-skill-learn"[^>]*>습득 · 스킬북 1권/);
 assert.doesNotMatch(render({onLearn:()=>{}}),/class="tc-skill-learn" disabled/);
 assert.match(render({onLearn:()=>{},busy:true}),/class="tc-skill-learn" disabled/);
 assert.match(render({loginRequired:true}),/로그인 후 습득/);
 game.learned.push('sword_strike_c');assert.doesNotMatch(render({onLearn:()=>{}}),/class="tc-skill-learn"/);
});
test('enhance and learn actions stay outside the scrollable detail in a nonshrinking bottom bar',()=>{
 const game=initialState();game.learned.push('sword_strike_c');game.skillBooks.sword_strike_c=10;game.market.gold=10000;
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},initialSkillId:'sword_strike_c',onEnhance:()=>{}}));
 assert.match(html,/<\/section><footer class="tc-skill-actions"/);
 const footer=html.slice(html.indexOf('<footer class="tc-skill-actions"'));
 assert.match(footer,/스킬북 2권/);assert.match(footer,/500 골드/);assert.match(footer,/class="tc-skill-enhance"/);
 const css=readFileSync(new URL('../src/components/skills/skillTree.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-skill-actions\{[^}]*flex-shrink:0/);
 assert.match(css,/\.tc-skill-codex-grid\{[^}]*overflow:auto/);
 assert.match(css,/\.tc-skill-tree-detail\{[^}]*flex-shrink:1;min-height:0/);
});
test('learned skills show enhancement cost, next effect and +3 resource guards',()=>{
 const game=initialState();game.learned.push('sword_strike_c');game.skillBooks.sword_strike_c=10;game.market.gold=10000;
 const render=(extra:Record<string,unknown>)=>renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},initialSkillId:'sword_strike_c',onEnhance:()=>{},...extra}));
 assert.match(render({}),/강화 \+1/);assert.match(render({}),/스킬북 2권/);assert.match(render({}),/500 골드/);assert.match(render({}),/78.75%/);
 assert.doesNotMatch(render({}),/class="tc-skill-enhance" disabled/);
 game.market.gold=0;assert.match(render({}),/class="tc-skill-enhance" disabled/);
 game.market.gold=10000;game.skillBooks.sword_strike_c=1;assert.match(render({}),/class="tc-skill-enhance" disabled/);
 game.skillBooks.sword_strike_c=10;game.skillEnhancements={sword_strike_c:3};assert.match(render({}),/최대 강화 \+3/);assert.match(render({}),/86.25%/);assert.match(render({}),/class="tc-skill-enhance" disabled/);
 assert.match(render({busy:true}),/class="tc-skill-enhance" disabled/);
});

test('tapping the active skill again closes both details and enhancement, and tapping a different skill switches selection',()=>{
 const first=nextSkillSelection(null,'sword_strike_c');assert.equal(first,'sword_strike_c');
 const switched=nextSkillSelection(first,'sword_strike_b');assert.equal(switched,'sword_strike_b');
 assert.equal(nextSkillSelection(switched,'sword_strike_b'),null);
 assert.equal(nextSkillSelection(null,'sword_strike_b'),'sword_strike_b');
 const code=readFileSync(new URL('../src/components/skills/SkillTreeScreen.tsx',import.meta.url),'utf8');
 assert.match(code,/onClick=\{\(\)=>setSelection\(current=>nextSkillSelection\(current,s.id\)\)\}/);
 const css=readFileSync(new URL('../src/components/skills/skillTree.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-skill-tree \.tc-skill-tree-tabs button[^}]*height:24px;min-height:24px/);
 assert.match(css,/\.tc-skill-tree \.tc-skill-tree-families button[^}]*height:24px;min-height:24px/);
});

test('skill cards keep compact intrinsic-height rows aligned to the top, including short viewports',()=>{
 const css=readFileSync(new URL('../src/components/skills/skillTree.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-skill-codex-grid\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:none;grid-auto-rows:minmax\(88px,max-content\);align-content:start/);
 assert.match(css,/\.tc-skill-codex-grid\{gap:4px;grid-auto-rows:minmax\(78px,max-content\)\}/);
 assert.match(css,/\.tc-skill-codex-grid\{grid-auto-rows:minmax\(70px,max-content\)\}/);
 assert.doesNotMatch(css,/grid-template-rows:repeat\(3,minmax\(44px,1fr\)\)/);
 assert.match(css,/\.tc-skill-codex-grid\{overflow:auto\}/);
});

test('skill list shows exact owned skillbook counts instead of material availability text',()=>{
 const game=initialState();game.skillBooks={sword_strike_c:7,sword_strike_b:2};
 const render=()=>renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{}}));
 const html=render();
 assert.match(html,/보급검 베기 · C · 습득 가능 · 스킬북 7권/);
 assert.match(html,/강철 베기 · B · 습득 가능 · 스킬북 2권/);
 assert.match(html,/스킬북 0권/);
 assert.doesNotMatch(html,/습득 재료 보유/);
 game.learned=['sword_strike_c'];
 const learnedHtml=render();
 assert.match(learnedHtml,/보급검 베기 · C · 습득 완료 · 스킬북 7권/);
 assert.match(learnedHtml,/습득 · 스킬북 7권/);
});
