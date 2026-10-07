import test from 'node:test';
import assert from 'node:assert/strict';
import {enter} from '../src/game/engine/expedition';
import {initialState} from '../src/game/engine/state';
import {createMonsterRuntime,monsterDefinitionById,chooseMonsterAction} from '../src/game/engine/monsterAi';
import {resolveMonsterTurn} from '../src/game/engine/combat';
import {applyEffect} from '../src/game/engine/effects';
function state(id:string){const s=enter(initialState(),'ore',1);const e=s.expedition!;e.monster={definitionId:id,name:id,hp:1000,currentHp:1000,attack:10,defense:0,speed:1,skillPower:1};e.monsterRuntime=createMonsterRuntime(e.monster);e.phase='MONSTER_TURN';return s;}
test('iron rat uses two hits and bat charges before dealing damage',()=>{
 let s=state('cave_rat');s=resolveMonsterTurn(s);assert.equal(s.combatEvents!.filter(x=>x.kind==='DIRECT_DAMAGE').length,2);
 s=state('mine_bat');const hp=s.expedition!.hp;s=resolveMonsterTurn(s);assert.equal(s.expedition!.hp,hp);assert.equal(s.expedition!.monsterRuntime!.preparedActionId,'bat_dive');
});
test('carrier shield scales with HP and overseer prioritizes attack preparation',()=>{
 let s=state('goblin_carrier');s=resolveMonsterTurn(s);assert.equal(s.expedition!.monsterEffects[0].currentShield,150);
 s=state('goblin_overseer');s=resolveMonsterTurn(s);assert.equal(s.expedition!.monsterEffects[0].effectId,'iron_attack_20');
});
test('miner attacks normally while dust is on cooldown then weakens attack',()=>{
 let s=state('goblin_miner');s=resolveMonsterTurn(s);assert.equal(s.expedition!.playerEffects[0].effectId,'iron_attack_down_15');assert.equal(s.expedition!.playerEffects[0].remainingDuration,2);
 const e=s.expedition!;const next=chooseMonsterAction(monsterDefinitionById('goblin_miner')!,e.monsterRuntime!,e.monster,e.hp,180,e.monsterEffects,e.playerEffects,()=>.5);assert.equal(next.skill!.id,'miner_pick');
});
