import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {SkillTreeScreen} from '../src/components/skills/SkillTreeScreen';
import {GRADES} from '../src/components/skills/catalog';
import {readFileSync} from 'node:fs';

test('iron skill cards expose grade and ownership independently without skill artwork',()=>{
 const game=initialState();game.learned=['sword_strike_c'];game.skillBooks={sword_strike_b:3};
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},initialSkillId:'sword_strike_b',onLearn:()=>{},onMarket:()=>{}}));
 assert.match(html,/tc-skill-tree tc-iron-skill-tree/);
 assert.match(html,/tc-skill-codex-card" data-grade="C" data-status="learned"/);
 assert.match(html,/tc-skill-codex-card" data-grade="B" data-status="available"/);
 assert.match(html,/tc-skill-tree-detail" data-grade="B" data-status="available"/);
 assert.match(html,/미습득 · 소유 스킬북 3권/);
 assert.doesNotMatch(html,/<img|<svg/);
});
test('every existing skill grade has its own color, including the S grade',()=>{
 const css=readFileSync(new URL('../src/components/skills/iron-skill-tree.css',import.meta.url),'utf8');
 const colors=GRADES.map(grade=>{
  const rule=css.match(new RegExp('\\[data-grade='+grade+'\\]\\{--skill-rarity:([^}]+)\\}'));
  assert.ok(rule,grade+' grade needs a color');return rule[1];
 });
 assert.equal(new Set(colors).size,GRADES.length);
});
test('skill browse content scrolls independently of the learn, enhance and market bar',()=>{
 const game=initialState();game.learned=['sword_strike_c'];game.skillBooks={sword_strike_c:10};game.market.gold=10000;
 const html=renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},initialSkillId:'sword_strike_c',onEnhance:()=>{},onMarket:()=>{}}));
 assert.match(html,/<section class="tc-skill-tree-browser" aria-label="스킬 목록 및 상세">/);
 assert.match(html,/<\/div><\/section><section class="tc-skill-tree-detail"/);
 assert.match(html,/<\/section><footer class="tc-skill-actions"/);
 const footer=html.slice(html.indexOf('<footer'));
 assert.match(footer,/강화 \+1/);assert.match(footer,/거래소/);assert.match(footer,/소유 스킬북 10권/);
});
