import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState} from '../src/online/villageLife';

const state:VillageLifeState={location:'city',vitality:629,materials:{herb:0,pepper:0,potato:0,wheat:0,stone:0},products:{potion:85431,attack_food:0,defense_food:0,experience_food:0,challenge_ticket:0},lifeMasteries:{herb:244,farm:0,ticket:0},craftCarry:{},towns:WORLD_TOWNS,serverNow:0,nextResetAt:300000};
test('the missing-material row is a first-class, labelled part of the workbench even with no stock',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{state,busy:false,count:1,recipe:'potion',queue:[],now:0,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}}));
 assert.match(html,/<div class="tc-craft-material" data-sufficient="false">/);
 assert.match(html,/필요 재료/);
 assert.match(html,/약초/);
 assert.match(html,/부족 10개/);
 assert.match(html,/tc-craft-material-amount/);
 assert.match(html,/aria-label="생활 숙련도"/);
 assert.match(html,/244/);
 assert.match(html,/250/);
 assert.match(html,/aria-label="제작 대기열"/);
 assert.equal((html.match(/빈 슬롯/g)||[]).length,3);
});
test('workbench CSS guarantees ingredient visibility and reserves a minimum board row while staying in one viewport',()=>{
 const css=readFileSync(new URL('../src/components/world/forge-craft-layout.css',import.meta.url),'utf8');
 const component=readFileSync(new URL('../src/components/world/CraftScreen.tsx',import.meta.url),'utf8');
 assert.match(component,/import '\.\/forge-craft-layout\.css'/);
 for(const selector of ['.tc-forge-workspace','.tc-craft-board','.tc-craft-material','.tc-craft-result','.tc-craft-queue','.tc-item-tabs','.tc-craft-main'])assert.ok(css.includes(selector),selector);
 assert.match(css,/grid-template-rows:\s*minmax\(/);
 assert.match(css,/\.tc-forge-craft \.tc-craft-board\s*\{[^}]*overflow:\s*visible/s);
 assert.match(css,/\.tc-forge-craft \.tc-craft-material\s*\{[^}]*min-height:/s);
 assert.match(css,/@media\s*\(max-width:\s*450px\)/);
 assert.match(css,/@media\s*\(max-height:\s*750px\)/);
 const banner=statSync(new URL('../public/assets/ui/crafting/forge-banner.webp',import.meta.url));
 assert.ok(banner.size>1000&&banner.size<20000);
 assert.ok(css.includes('forge-banner.webp'));
});
