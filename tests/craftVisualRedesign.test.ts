import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState,CraftQueueJob} from '../src/online/villageLife';

const state:VillageLifeState={location:'city',vitality:60,materials:{herb:12,pepper:99,potato:90,wheat:100,stone:100},products:{potion:10460,attack_food:0,defense_food:0,experience_food:0,challenge_ticket:0},lifeMasteries:{herb:244,farm:0,ticket:0},craftCarry:{},towns:WORLD_TOWNS,serverNow:1000,nextResetAt:999999};
const queue:CraftQueueJob[]=[{id:'one',item:'attack_food',count:10,quantity:10,startsAt:1000,endsAt:3001000,durationSeconds:3000,status:'crafting'}];
const props={state,busy:false,count:1,recipe:'potion' as const,queue,now:2200,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onClaim:()=>{},onCancel:()=>{}};

test('forge redesign groups product details and crafting controls in one content panel beside full-height recipe rail',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/class="[^"]*tc-forge-craft/);
 assert.match(html,/class="tc-forge-shell"/);
 assert.match(html,/<aside[^>]*aria-label="제작 도안 목록"/);
 assert.match(html,/<div class="tc-forge-workspace">/);
 assert.match(html,/<section[^>]*aria-label="제작 작업대"/);
 assert.match(html,/<footer class="tc-craft-footer">/);
 assert.ok(html.indexOf('tc-forge-workspace')<html.indexOf('tc-craft-footer'));
 assert.ok(html.indexOf('tc-craft-footer')<html.indexOf('tc-craft-queue'));
 assert.match(html,/예상 완성품 미리보기/);
 assert.match(html,/재료 확보/);
 assert.match(html,/기본 생산/);
 assert.match(html,/숙련 보너스/);
 assert.match(html,/보유 10,460개/);
 assert.match(html,/제작 시간/);
 assert.match(html,/03:00/);
 assert.match(html,/aria-label="제작 횟수 감소"/);
 assert.match(html,/aria-label="제작 횟수 증가"/);
});
test('forge redesign keeps existing 3-slot queue action buttons and no invented silver crafting cost',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/제작 대기열/);
 assert.match(html,/1\s*\/\s*3/);
 assert.match(html,/취소/);
 assert.equal((html.match(/빈 슬롯/g)||[]).length,2);
 assert.match(html,/제작 비용/);
 assert.match(html,/활력/);
 assert.doesNotMatch(html,/1,000\s*S/);
});
test('forge visual CSS covers golden product panel, full-width main action, three job slots and compact mobile layout',()=>{
 const css=readFileSync(new URL('../src/components/world/forge-craft.css',import.meta.url),'utf8');
 const world=readFileSync(new URL('../src/components/world/WorldPage.tsx',import.meta.url),'utf8');
 for(const selector of ['.tc-forge-craft','.tc-forge-shell','.tc-forge-workspace','.tc-craft-result','.tc-craft-main','.tc-craft-queue-card','.tc-craft-hero','@media'])assert.ok(css.includes(selector),selector);
 assert.ok(world.includes('tc-craft-hero'));
 assert.ok(css.includes('grid-template-columns'));
 assert.ok(css.includes('min-height:44px')||css.includes('min-height: 44px'));
});

test('forge material display overrides the legacy column selector and selected arrow stays centered',()=>{
 const css=readFileSync(new URL('../src/components/world/forge-craft.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-forge-craft \.tc-craft-material>\.tc-craft-material-row\s*\{[^}]*flex-direction\s*:\s*row/s);
 assert.match(css,/\.tc-forge-craft \.tc-item-tabs button\.active:after\s*\{[^}]*top\s*:\s*50%/s);
 const arrow=css.slice(css.indexOf('.tc-forge-craft .tc-item-tabs button.active:after'),css.indexOf('.tc-forge-craft .tc-forge-workspace'));
 assert.doesNotMatch(arrow,/inset:auto/);
});
