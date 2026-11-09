import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {craftingMaterialSource,craftingSupplyNeed,recommendedCraftSupplyTown} from '../src/game/life/craftSupply';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {LifeScreen} from '../src/components/world/LifeScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
import type {VillageLifeState,LifeTown} from '../src/online/villageLife';

const towns:LifeTown[]=WORLD_TOWNS.map(t=>({...t,herbCapacity:1000,farmCapacity:1000,herbRemaining:t.id==='herb-2'?800:100,farmRemaining:t.id==='farm-2'?700:100,tax:3}));
const state:VillageLifeState={location:'city',vitality:100,materials:{herb:0,pepper:0,potato:0,wheat:0,stone:0},products:{potion:0,attack_food:0,defense_food:0,experience_food:0,challenge_ticket:0,vitality_potion:0},lifeMasteries:{herb:100,farm:100,ticket:100},craftCarry:{},towns,serverNow:1000,nextResetAt:999999};
const props={state,busy:false,count:10,recipe:'potion' as const,onRecipe:()=>{},onCount:()=>{},onCraft:()=>{},onFindMaterials:()=>{},onOpenInventory:()=>{},onTravel:()=>{}};
const render=(changes:Partial<typeof props>={})=>renderToStaticMarkup(React.createElement(CraftScreen,{...props,...changes}));
const mainButton=(html:string)=>{
 const result=html.match(/<button[^>]*class="[^"]*tc-craft-main[^"]*"[^>]*>/);
 assert.ok(result,'Main crafting button missing');return result[0];
};

test('all existing recipes route to their real resource; dismantling is never mistaken for farming',()=>{
 assert.equal(craftingMaterialSource('herb'),'herb');
 for(const material of ['pepper','potato','wheat'] as const)assert.equal(craftingMaterialSource(material),'farm');
 assert.equal(craftingMaterialSource('stone'),'dismantle');
 for(const [item,source] of [['potion','herb'],['attack_food','farm'],['defense_food','farm'],['experience_food','farm'],['challenge_ticket','dismantle']] as const){
  const need=craftingSupplyNeed(state,item,10);
  assert.equal(need.source,source);assert.equal(need.required,100);assert.equal(need.missing,100);
 }
 assert.equal(craftingSupplyNeed({...state,materials:{...state.materials,herb:63}},'potion',10).missing,37);
});
test('shortcuts prefer a stocked current town, then select a real stocked location and stop if exhausted',()=>{
 assert.equal(recommendedCraftSupplyTown(state,'herb')?.id,'city');
 const noCity={...state,towns:towns.map(t=>t.id==='city'?{...t,herbRemaining:0,farmRemaining:0}:t)};
 assert.equal(recommendedCraftSupplyTown(noCity,'herb')?.id,'herb-2');
 assert.equal(recommendedCraftSupplyTown(noCity,'farm')?.id,'farm-2');
 assert.equal(recommendedCraftSupplyTown({...state,towns:towns.map(t=>({...t,herbRemaining:0}))},'herb'),null);
});
test('missing ingredients keep one primary action enabled when the actual acquisition route is attached',()=>{
 const herb=render(),btn=mainButton(herb);
 assert.match(herb,/약초 채집하러 가기/);assert.doesNotMatch(btn,/disabled/);
 assert.match(herb,/부족 100/);
 assert.match(render({...props,recipe:'defense_food'}),/농사하러 가기/);
 assert.match(render({...props,recipe:'challenge_ticket'}),/장비 분해하러 가기/);
 assert.match(mainButton(render({...props,onFindMaterials:undefined})),/disabled/);
 assert.match(render({...props,queue:[{id:'a',item:'potion',count:1,quantity:1000,startsAt:0,endsAt:0,durationSeconds:180,status:'complete'},{id:'b',item:'potion',count:1,quantity:1000,startsAt:0,endsAt:0,durationSeconds:180,status:'complete'},{id:'c',item:'potion',count:1,quantity:1000,startsAt:0,endsAt:0,durationSeconds:180,status:'complete'}]}),/제작 대기열 확인/);
});
test('production screen shows live target without promising a specific random crop and exposes return to crafting',()=>{
 const herb=renderToStaticMarkup(React.createElement(LifeScreen,{state,busy:false,count:10,now:1000,onCount:()=>{},onGather:()=>{},onBack:()=>{},onRefresh:()=>{},target:{product:'potion',material:'herb',required:100},onReturnCraft:()=>{}}));
 assert.match(herb,/data-target-material="herb"/);
 assert.match(herb,/약초 0 \/ 100/);
 assert.match(herb,/부족 100개/);
 assert.match(herb,/제작 공방으로 돌아가기/);
 const farm=renderToStaticMarkup(React.createElement(LifeScreen,{state,busy:false,count:3,now:1000,onCount:()=>{},onGather:()=>{},onBack:()=>{},onRefresh:()=>{},target:{product:'defense_food',material:'potato',required:30},onReturnCraft:()=>{}}));
 assert.match(farm,/data-target-material="potato"/);
 assert.match(farm,/고추·감자·밀은 무작위 수확/);
 assert.match(farm,/data-gather-scene="farm"/);
 const complete=renderToStaticMarkup(React.createElement(LifeScreen,{state:{...state,materials:{...state.materials,potato:35}},busy:false,count:3,now:1000,onCount:()=>{},onGather:()=>{},onBack:()=>{},onRefresh:()=>{},target:{product:'defense_food',material:'potato',required:30},onReturnCraft:()=>{}}));
 assert.match(complete,/재료 확보/);
});
test('draft return, distinct gather count and inventory destinations remain wired to the actual app router',()=>{
 const world=readFileSync(new URL('../src/components/world/WorldPage.tsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const inventory=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
 assert.match(world,/count:gatherCount/);
 assert.match(world,/count=\{gatherCount\}/);
 assert.match(world,/onCount=\{setGatherCount\}/);
 assert.match(world,/setSupplyGoal\(\{product:item,material:need.material,required:need.required\}\)/);
 assert.match(world,/sessionStorage.setItem\(draftKey/);
 assert.match(world,/sessionStorage.removeItem\(draftKey\)/);
 assert.match(world,/onReturnCraft=\{supplyGoal\?returnToCraft:undefined\}/);
 assert.match(world,/openCraftInventory\('equipment'\)/);
 assert.match(main,/initialCategory=\{inventoryShortcutCategory\?\?'all'\}/);
 assert.match(inventory,/제작 복귀/);
});
