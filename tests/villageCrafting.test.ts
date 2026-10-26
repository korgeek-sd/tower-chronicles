import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {CRAFT_RECIPES,craftLimit,craftPreview,validLifeAction,lifeMasteryBonus,lifeMasteryLevel} from '../src/game/life/crafting';
import {CraftScreen} from '../src/components/world/CraftScreen';
import {WORLD_TOWNS} from '../src/components/world/worldMap';
const state:any={location:'city',actionPoints:100,materials:{herb:100,pepper:100,potato:100,wheat:100,stone:100},products:{potion:0,attack_food:2,defense_food:0,experience_food:0,challenge_ticket:0},craftMastery:1000,lifeMasteries:{herb:1000,farm:1000,ticket:1000},craftCarry:{},foodTurns:{attack_food:0,defense_food:0,experience_food:0},towns:WORLD_TOWNS,serverNow:0,nextResetAt:1000};
test('craft limits are per specialty, AP and material; max excludes bonus',()=>{assert.equal(craftLimit(state,'potion'),10);assert.equal(craftLimit({...state,actionPoints:2},'potion'),2);assert.equal(craftLimit({...state,location:'farm-1'},'potion'),0);assert.equal(craftLimit({...state,location:'herb-1'},'challenge_ticket'),0);assert.equal(CRAFT_RECIPES.length,5);});
test('craft preview carries fractional units and applies mastery sequentially across batching',()=>{const one=craftPreview('attack_food',10,1000,0);assert.equal(one.quantity,11);assert.equal(one.carry,70);let mastery=1000,carry=0,total=0;for(let i=0;i<10;i++){const r=craftPreview('attack_food',1,mastery,carry);total+=r.quantity;carry=r.carry;mastery=r.mastery;}assert.deepEqual({quantity:total,carry,mastery},one);assert.equal(craftPreview('potion',1,5000,0).quantity,1300);assert.equal(craftPreview('potion',2,99,0).quantity,2030);});
test('pending life actions validate ids, action types and counts',()=>{const r={id:'22222222-2222-4222-8222-222222222222',town:'city',action:'craft',item:'potion',count:10};assert.equal(validLifeAction(r),true);assert.equal(validLifeAction({...r,item:'bad'}),false);assert.equal(validLifeAction({...r,count:101}),false);assert.equal(validLifeAction({...r,action:'food',item:'potion'}),false);});
test('craft UI displays one chosen recipe and authoritative products and food timers',()=>{const html=renderToStaticMarkup(React.createElement(CraftScreen,{state,busy:false,count:10,recipe:'potion',onRecipe:()=>{},onCount:()=>{},onCraft:()=>{}}));for(const s of ['회복 포션','약초','1,000','약초 숙련도','예상','떡볶이','최대'])assert.ok(html.includes(s),s);});

test('three life masteries have ten levels and capped 30% production only',()=>{
 const thresholds=[0,100,250,450,700,1000,1400,1900,2500,3200],bonuses=[0,3,7,10,13,17,20,23,27,30];
 for(let i=0;i<10;i++){assert.equal(lifeMasteryLevel(thresholds[i]),i+1);assert.equal(lifeMasteryBonus(thresholds[i]),bonuses[i]);}
 assert.equal(lifeMasteryBonus(99999),30);assert.equal(lifeMasteryBonus(99),0);
 assert.deepEqual(craftPreview('attack_food',100,3200,0),{quantity:130,carry:0,mastery:3200});
});
