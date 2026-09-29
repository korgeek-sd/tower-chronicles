import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {reconcileOnlineCombatState,type OnlineCombatState} from '../src/online/economy.ts';

function active(){return enter(initialState(),'ore',1);}
function snapshot(state:ReturnType<typeof active>,over:Partial<OnlineCombatState>):OnlineCombatState{
 const e=state.expedition!;
 return {encounterIndex:1,monsterId:e.monster.definitionId??'goblin_miner',playerHp:e.hp,monsterHp:e.monster.currentHp,monsterMaxHp:e.monster.hp,phase:'PLAYER_TURN',actionNonce:1,...over};
}

test('ONLINE BATTLE VFX 0.1.89 01: authoritative damage creates client combat events only when requested',()=>{
 const state=active(),before=state.expedition!.monster.currentHp;
 const passive=reconcileOnlineCombatState(state,snapshot(state,{monsterHp:before-9,damage:9}));
 assert.equal(passive.combatEvents?.length??0,0);
 const visual=reconcileOnlineCombatState(state,snapshot(state,{monsterHp:before-9,damage:9}),{emitCombatEvents:true});
 const event=visual.combatEvents?.at(-1);
 assert.equal(event?.attacker,'player');
 assert.equal(event?.target,'monster');
 assert.equal(event?.hpDamage,9);
 assert.equal(visual.combatEventSequence,event?.id);
});

test('ONLINE BATTLE VFX 0.1.89 02: retaliation and shield absorption are represented for the renderer',()=>{
 const state=active(),hp=state.expedition!.hp;
 const next=reconcileOnlineCombatState(state,snapshot(state,{playerHp:hp-7,retaliation:7,playerAbsorbed:3}),{emitCombatEvents:true});
 const event=next.combatEvents?.at(-1);
 assert.equal(event?.target,'player');
 assert.equal(event?.hpDamage,7);
 assert.equal(event?.absorbedByShield,3);
 assert.equal(event?.incomingDamage,10);
});

test('ONLINE BATTLE VFX 0.1.89 03: online reconciliation remains bounded and save-compatible telemetry shape',()=>{
 const state=active();
 for(let i=0;i<50;i++){
  const next=reconcileOnlineCombatState(state,snapshot(state,{damage:1}),{emitCombatEvents:true});
  state.combatEvents=next.combatEvents;state.combatEventSequence=next.combatEventSequence;
 }
 assert.ok((state.combatEvents?.length??0)<=40);
 assert.ok((state.combatEventSequence??0)>=50);
});

test('ONLINE BATTLE VFX 0.1.89 04: terminal online actions render state before advancing or settling',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/reconcileOnlineCombatState\(stateRef\.current,result,\{emitCombatEvents:true\}\)/);
 assert.match(main,/flushSync\(\(\)=>setGame\(candidate\)\)/);
 assert.match(main,/const showImpact=\(\)=>new Promise<void>/);
 assert.match(main,/phase==='DEFEATED'\)\{await showImpact\(\)/);
});

test('ONLINE BATTLE VFX 0.1.89 05: fallback HP deltas no longer depend on local expedition time',()=>{
 const presentation=readFileSync(new URL('../src/components/battle/presentation.ts',import.meta.url),'utf8');
 assert.doesNotMatch(presentation,/current\.time<=previous\.time/);
});
