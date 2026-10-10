import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {SkillTreeScreen} from '../src/components/skills/SkillTreeScreen';
import {SKILL_TREE_CATALOG} from '../src/components/skills/catalog';
test('skill tree shows two-column codex and real ownership as image-free codex cards',()=>{
 const game=initialState();game.learned=['sword_strike_c'];game.skillBooks={sword_strike_a:1};
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{}}));
 assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='active').length,60);assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='passive').length,20);
 for(const label of ['스킬트리','참격','SSR','보급검 베기','습득 완료','미습득','스킬북'])assert.ok(html.includes(label),label);
 assert.match(html,/습득 <b>1<\/b>/);assert.match(html,/data-status="learned"/);assert.match(html,/data-status="available"/);assert.match(html,/data-status="locked"/);assert.doesNotMatch(html,/<img|<svg/);assert.match(html,/tc-skill-codex-card/);assert.doesNotMatch(html,/<nav/);assert.match(html,/tc-skill-grade-select/);
});
test('common passive collection contains the two SSR skills and locked details remain visible',()=>{
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game:initialState(),onHome:()=>{},initialWeapon:'any',initialType:'passive'}));
 assert.match(html,/귀환자의 맹세/);assert.match(html,/여섯 번째 각인/);assert.match(html,/최대 HP/);assert.doesNotMatch(html,/undefined|NaN/);
 const css=readFileSync(new URL('../src/components/skills/skillTree.css',import.meta.url),'utf8');assert.match(css,/repeat\(2/);assert.match(css,/min-height:44px/);assert.match(css,/safe-area-inset/);
});
