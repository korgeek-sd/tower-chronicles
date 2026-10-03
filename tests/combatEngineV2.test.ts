import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BattleScene} from '../src/components/battle/BattleScene.tsx';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack,useBattlePotion,resolveMonsterTurn} from '../src/game/engine/combat.ts';
import {combatRuntime} from '../src/game/engine/battleLifecycle.ts';
import {applyEffect} from '../src/game/engine/effects.ts';
import {createRepository,SAVE_KEY} from '../src/storage/repository.ts';

test('victory clears combat resource shield buffs and cooldowns but preserves expedition potion count',()=>{
 let s=enter(initialState(),'ore',1),e=s.expedition!;e.monster.currentHp=1;
 combatRuntime(e).healingPotionUses=4;e.jobRuntime.resource!.value=3;e.cooldowns['turn:guard']=2;
 applyEffect(e,'player','test_shield','player',1);applyEffect(e,'player','guard','player',1);
 s=basicAttack(s,()=>.99);e=s.expedition!;
 assert.equal(e.jobRuntime.resource!.value,0);assert.deepEqual(e.cooldowns,{});assert.deepEqual(e.playerEffects,[]);
 assert.equal(combatRuntime(e).healingPotionUses,4);
});
test('old v23 save is normalized safely at load without resetting HP or inventory',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.hp=71;
 delete (e as any).skillReadyTurns;delete (e as any).healingPotionUses;delete (e as any).combatQueue;
 const raw=JSON.stringify(s),repo=createRepository({getItem:k=>k===SAVE_KEY?raw:null,setItem:()=>{}}),loaded=repo.load();
 assert.deepEqual(combatRuntime(loaded.expedition!).skillReadyTurns,{player:{},monster:{}});
 assert.equal(loaded.expedition!.hp,71);assert.deepEqual(loaded.expedition!.bag,e.bag);
});
test('HUD uses four actual resource pips and no artificial effect count',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.jobRuntime.resource!.value=2;applyEffect(e,'player','guard','player',1);
 const html=renderToStaticMarkup(React.createElement(BattleScene,{expedition:e,combatEvents:[],playerMaxHp:180,appearanceId:'default'}));
 assert.match(html,/전투 자원 2 \/ 4/);
 assert.equal((html.match(/class="active"/g)??[]).length,2);
});

import {normalizeCombatSave} from '../src/storage/repository.ts';
import {requestReturn} from '../src/game/engine/expedition.ts';
test('legacy production stacks normalize magnitude and retain application history',()=>{
 const s=enter(initialState(),'ore',1);applyEffect(s.expedition!,'player','fang_wound','monster',0);s.expedition!.playerEffects[0].stackCount=3;
 normalizeCombatSave(s);assert.equal(s.expedition!.playerEffects[0].stackCount,1);assert.equal(s.expedition!.monsterRuntime!.effectApplications!['player:fang_wound'],3);
});
test('alternate return respects root and runs periodic turn completion',()=>{
 const s=enter(initialState(),'ore',1);applyEffect(s.expedition!,'player','root','monster',0);assert.equal(requestReturn(s),s);
 const t=enter(initialState(),'ore',1);applyEffect(t.expedition!,'player','poison','monster',0);assert.equal(requestReturn(t).expedition!.hp,t.expedition!.hp-5);
});

import {applyHealing} from '../src/game/engine/healing.ts';
import {shieldTotal} from '../src/game/engine/effects.ts';
test('saturated shield and healing events remain valid saved states',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;
 for(let i=0;i<30;i++)applyEffect(e,'player','test_shield','player',0);
 applyEffect(e,'player','iron_core_shield','player',0);assert.equal(shieldTotal(e,'player'),540);
 assert.equal(e.playerEffects.some(x=>x.currentShield===0),false);
 applyHealing(s,'player',20,{canCrit:true,rng:()=>0});createRepository({getItem:()=>null,setItem:()=>{}}).save(s);
});
test('stunned player periodic death settles the returned state',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.phase='MONSTER_TURN';e.hp=4;e.bag.revival=0;e.monster.attack=0;
 applyEffect(e,'player','stun','monster',0);applyEffect(e,'player','poison','monster',0);
 const next=resolveMonsterTurn(s,()=>.99);assert.equal(next.expedition,null);assert.equal(next.lastExpedition!.outcome,'dead');
});
