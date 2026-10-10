import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {SkillTreeScreen} from '../src/components/skills/SkillTreeScreen';
import {SKILL_TREE_CATALOG} from '../src/game/skills/catalog';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('learn and enhance share a row with a direct book trade button',()=>{
 const game=initialState(),skill=SKILL_TREE_CATALOG.find(s=>s.id==='sword_strike_c')!;
 const render=()=>renderToStaticMarkup(React.createElement(SkillTreeScreen,{game,onHome:()=>{},onMarket:()=>{},initialSkillId:skill.id,onLearn:()=>{},onEnhance:()=>{}}));
 const before=render();
 assert.match(before,/<div class="tc-skill-action-buttons">/);
 assert.match(before,/class="tc-skill-learn"[^>]*>습득 · 스킬북 1권<\/button><button class="tc-skill-market"/);
 assert.match(before,/aria-label="보급검 베기 스킬북 거래소">거래소<\/button>/);
 game.learned.push(skill.id);game.skillBooks[skill.id]=10;game.market.gold=5000;
 assert.match(render(),/class="tc-skill-enhance"[^>]*>강화 \+1<\/button><button class="tc-skill-market"/);
 game.skillEnhancements={[skill.id]:3};
 assert.match(render(),/최대 강화 \+3/);
 assert.match(render(),/class="tc-skill-market"[^>]*>거래소<\/button>/);
});
test('direct skillbook order page returns to original skill after trading',()=>{
 const main=read('src/main.tsx'),page=read('src/components/skills/SkillBooksPage.tsx'),tree=read('src/components/skills/SkillTreeScreen.tsx');
 assert.ok(main.includes("setMarketIntent({itemId:'skillbook:'+skillId,skillId})"));
 assert.ok(main.includes('onMarket={openMarketFromSkill}'));
 assert.ok(main.includes('onReturnToSkill={returnToSkill}'));
 assert.ok(main.includes('initialSkillId={skillReturnId}'));
 assert.ok(page.includes('initialWeapon={initialSkill?.weapon}'));
 assert.ok(page.includes('initialType={initialSkill?.type}'));
 assert.ok(tree.includes('[family,setFamily]=useState<string|null>(SKILL_TREE_CATALOG.find'));
 for(const path of ['src/components/market/MarketScreen.tsx','src/components/market/ServerMarketScreen.tsx']){
  const screen=read(path);
  assert.ok(screen.includes('setSelected(intent.itemId)'));
  assert.ok(screen.includes("setCategory(intent.skillId?'skillbooks':'all')"));
  assert.ok(screen.includes('returnSkillId&&onReturnToSkill?onReturnToSkill(returnSkillId)'));
  assert.ok(screen.includes('‹ 스킬트리'));
 }
 assert.ok(read('src/components/skills/skillTree.css').includes('.tc-skill-action-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
});
