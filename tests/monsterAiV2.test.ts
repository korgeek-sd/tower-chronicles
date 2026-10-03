import {resolveActorSkill} from '../src/game/engine/monsterSkills.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseMonsterAction,createMonsterRuntime,advanceMonsterPhase,type MonsterDefinition} from '../src/game/engine/monsterAi.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {initialState} from '../src/game/engine/state.ts';
import {applyEffect,EFFECTS} from '../src/game/engine/effects.ts';
import {resolveMonsterTurn} from '../src/game/engine/combat.ts';
const monster={name:'x',hp:100,currentHp:40,attack:1,defense:0,speed:1,skillPower:1};
test('boss phase advances from HP, turns and event flags without ever regressing or resetting cooldown',()=>{
 const d:MonsterDefinition={id:'phase',name:'phase',skills:[],aiRules:[],phases:[{id:'one'},{id:'two',when:{kind:'SELF_HP_BELOW',value:.5}},{id:'three',when:{kind:'ALL',conditions:[{kind:'TURN_AT_LEAST',value:4},{kind:'EVENT_FLAG',flag:'revived'}]}}]};
 const r=createMonsterRuntime(monster);r.skillCooldowns.x=3;
 advanceMonsterPhase(d,r,monster);assert.equal(r.phaseId,'two');assert.equal(r.skillCooldowns.x,3);
 monster.currentHp=100;advanceMonsterPhase(d,r,monster);assert.equal(r.phaseId,'two');
 r.turnNumber=4;r.eventFlags={revived:true};advanceMonsterPhase(d,r,monster);assert.equal(r.phaseId,'three');
});
test('weighted candidates use injected RNG, forced rules take priority',()=>{
 const d:MonsterDefinition={id:'w',name:'w',skills:[{id:'a',name:'a',description:'',kind:'damage',cooldown:0,weight:1},{id:'b',name:'b',description:'',kind:'damage',cooldown:0,weight:3}],aiRules:[]};
 const r=createMonsterRuntime(monster);
 assert.equal(chooseMonsterAction(d,r,monster,100,100,[],[],()=>0).skill?.id,'a');
 assert.equal(chooseMonsterAction(d,r,monster,100,100,[],[],()=>.9).skill?.id,'b');
 d.aiRules=[{id:'forced',actionId:'a',priority:1,forced:true,conditions:[]}];
 assert.equal(chooseMonsterAction(d,r,monster,100,100,[],[],()=>.9).skill?.id,'a');
});
test('stun cancels prepared attack; silence allows already prepared attack and blocks new preparation',()=>{
 let s=enter(initialState(),'ore',1);const e=s.expedition!;e.monster.definitionId='test-charge';e.monsterRuntime=createMonsterRuntime(e.monster);e.monsterRuntime.preparedActionId='charge';e.phase='MONSTER_TURN';
 applyEffect(e,'monster','silence','player',0);s=resolveMonsterTurn(s);assert.match(s.logs.join('\n'),/준비 공격 발동/);
 s=enter(initialState(),'ore',1);s.expedition!.monster.definitionId='test-charge';s.expedition!.monsterRuntime=createMonsterRuntime(s.expedition!.monster);s.expedition!.monsterRuntime!.preparedActionId='charge';s.expedition!.phase='MONSTER_TURN';applyEffect(s.expedition!,'monster','stun','player',0);
 const hp=s.expedition!.hp;s=resolveMonsterTurn(s);assert.equal(s.expedition!.hp,hp);assert.equal(s.expedition!.monsterRuntime!.preparedActionId,null);
});

import {TEST_MONSTER_BASIC} from '../src/game/engine/monsterAi.ts';
test('explicit monster critical skill obeys injected RNG while ordinary monsters cannot randomly crit',()=>{
 const s=enter(initialState(),'ore',1);s.expedition!.monster.attack=10;s.expedition!.monster.currentHp=10000;s.expedition!.monster.hp=10000;
 const skill={id:'critical',name:'crit',description:'',kind:'damage' as const,cooldown:0,critical:'ALLOWED' as const};
 resolveActorSkill(s,'monster',skill,{rng:()=>0});assert.equal(s.combatEvents!.at(-1)!.critical,true);
 resolveActorSkill(s,'monster',{...skill,critical:undefined},{rng:()=>0});assert.equal(s.combatEvents!.at(-1)!.critical,false);
});

test('monster turn forwards RNG for miss and initializes immunity before first action',()=>{
 const s=enter(initialState(),'ore',1),e=s.expedition!;e.phase='MONSTER_TURN';
 EFFECTS.test_miss={id:'test_miss',name:'miss',description:'',category:'DEBUFF',behavior:'STAT_MODIFIER',tags:['STAT_DOWN'],defaultDuration:2,stackingPolicy:'REFRESH_DURATION',payload:{stat:'missChance',multiplier:1}};
 applyEffect(e,'monster','test_miss','player',0);const hp=e.hp;
 assert.equal(resolveMonsterTurn(s,()=>0).expedition!.hp,hp);
 TEST_MONSTER_BASIC.effectImmunities=['stun'];
 try {e.monster.definitionId=TEST_MONSTER_BASIC.id;e.monsterRuntime=createMonsterRuntime(e.monster);assert.equal(applyEffect(e,'monster','stun','player',0)?.immune,true);}finally{delete TEST_MONSTER_BASIC.effectImmunities;}
});

test('one-shot event advances one phase and is consumed',()=>{
 const d:MonsterDefinition={id:'once',name:'once',skills:[],phases:[{id:'one'},{id:'two',when:{kind:'EVENT_FLAG',flag:'once'}},{id:'three',when:{kind:'EVENT_FLAG',flag:'once'}}]};
 const r=createMonsterRuntime(monster);r.eventFlags={once:true};advanceMonsterPhase(d,r,monster);assert.equal(r.phaseId,'two');assert.equal(r.eventFlags.once,false);
});
