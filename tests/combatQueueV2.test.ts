import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {resolveCombatQueue} from '../src/game/engine/combatQueue.ts';
import {createMonsterRuntime,TEST_MONSTER_REACTIVE} from '../src/game/engine/monsterAi.ts';
import {prepareReactive} from '../src/game/engine/reactions.ts';
test('action queue cancels remaining hits on a killing blow and suppresses dead target counter',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;
 e.monster.definitionId=TEST_MONSTER_REACTIVE.id;e.monsterRuntime=createMonsterRuntime(e.monster);e.monster.currentHp=1;
 prepareReactive(e,'monster',TEST_MONSTER_REACTIVE.id,TEST_MONSTER_REACTIVE.skills![0]);
 resolveCombatQueue(s,[{kind:'DIRECT_HIT',actor:'player',multiplier:1},{kind:'DIRECT_HIT',actor:'player',multiplier:1}],()=>.99);
 assert.equal(s.combatEvents!.length,1);assert.equal(e.hp,180);assert.equal(e.reactivePrepared.monster,null);
});
test('counter death discards original attack queue even when revival is offered',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.hp=1;e.bag.revival=1;
 e.monster={...e.monster,definitionId:TEST_MONSTER_REACTIVE.id,hp:10000,currentHp:10000,attack:1000};e.monsterRuntime=createMonsterRuntime(e.monster);
 prepareReactive(e,'monster',TEST_MONSTER_REACTIVE.id,TEST_MONSTER_REACTIVE.skills![0]);
 resolveCombatQueue(s,[{kind:'DIRECT_HIT',actor:'player',multiplier:1},{kind:'DIRECT_HIT',actor:'player',multiplier:1}],()=>.99);
 assert.equal(s.combatEvents!.filter(x=>x.attacker==='player').length,1);
 assert.ok(e.pendingRevival);assert.equal(e.pendingRevival!.steps.some(x=>x.kind==='DIRECT_HITS'),false);
});
