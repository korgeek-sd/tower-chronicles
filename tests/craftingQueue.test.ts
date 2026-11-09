import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState,CraftQueueJob} from '../src/online/villageLife';

const state:VillageLifeState={location:'city',vitality:50,materials:{herb:100,pepper:100,potato:100,wheat:100,stone:100},products:{potion:0,attack_food:0,defense_food:0,experience_food:0,challenge_ticket:0,vitality_potion:0},lifeMasteries:{herb:100,farm:100,ticket:100},craftCarry:{},towns:WORLD_TOWNS,serverNow:1000,nextResetAt:999999};
const jobs:CraftQueueJob[]=[
 {id:'1',item:'potion',count:1,quantity:1000,startsAt:0,endsAt:1000,durationSeconds:180,status:'complete'},
 {id:'2',item:'attack_food',count:1,quantity:1,startsAt:1000,endsAt:301000,durationSeconds:300,status:'crafting'},
 {id:'3',item:'challenge_ticket',count:1,quantity:1,startsAt:301000,endsAt:1501000,durationSeconds:1200,status:'waiting'}
];
const props={state,busy:false,count:1,recipe:'potion' as const,queue:jobs,now:2000,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onClaim:()=>{},onCancel:()=>{}};
test('three-slot crafting queue shows ready/manual claim, progress, waiting and full state',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,props));
 assert.match(html,/aria-label="제작 대기열"/);
 assert.match(html,/3\s*\/\s*3/);
 assert.match(html,/수령/);
 assert.match(html,/제작 중/);
 assert.match(html,/대기 중/);
 assert.match(html,/제작 대기열이 가득 찼습니다/);
 assert.match(html,/tc-craft-queue-card/);
});
test('empty queue renders three available slots and duration without changing recipe',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftScreen,{...props,queue:[]}));
 assert.match(html,/0\s*\/\s*3/);
 assert.equal((html.match(/빈 슬롯/g)||[]).length,3);
 assert.match(html,/제작 시간/);
 assert.match(html,/03:00/);
});
test('timed queue is backed by private server state and manual claim, not local storage',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261109140000_village_crafting_queue.sql',import.meta.url),'utf8');
 for(const word of ['private.village_craft_queue','enqueue_village_craft','claim_village_craft','cancel_village_craft','get_village_craft_queue','CRAFT_QUEUE_REQUIRED','status=\'CLAIMED\'','status=\'CANCELLED\''])assert.ok(sql.includes(word),word);
 assert.match(sql,/vitality=vitality-p_count/);
 assert.match(sql,/vitality=least\(1000,vitality\+j.vitality_cost\)/);
});
