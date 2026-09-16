import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {applyEffect} from '../src/game/engine/effects';
import {COMMON_EVENTS,PRODUCTION_EVENT_CATALOG} from '../src/game/events/catalog';
import {ORE_EVENTS} from '../src/game/events/content/ore';
import {validateEventCatalog} from '../src/game/events/catalogValidation';
import {eligible} from '../src/game/events/selector';
import {openEvent,resolveEvent} from '../src/game/events/service';
import type {GameState,Tower} from '../src/game/types';

const run=(tower:Tower='ore',floor=1)=>{const state=initialState();state.tickets[tower][floor-1]=1;return enter(state,tower,floor);};
const definition=(id:string)=>ORE_EVENTS.find(event=>event.id===id)!;
const open=(state:GameState,id:string,roll=.1)=>{openEvent(state,definition(id),()=>roll);return state;};
const choose=(state:GameState,choiceId:string)=>resolveEvent(state,state.expedition!.events.pendingEvent!.instanceId,choiceId);

test('ORE EVENT 01: full production catalog validates as six common plus five Iron Vein events',()=>{
 assert.equal(COMMON_EVENTS.length,6);
 assert.equal(ORE_EVENTS.length,5);
 assert.equal(PRODUCTION_EVENT_CATALOG.length,11);
 assert.equal(new Set(PRODUCTION_EVENT_CATALOG.map(event=>event.id)).size,11);
 assert.deepEqual(validateEventCatalog(PRODUCTION_EVENT_CATALOG),[]);
});

test('ORE EVENT 02: Iron Vein authored events are eligible only inside the ore tower',()=>{
 const ore=run('ore');
 const gem=run('gem');
 for(const event of ORE_EVENTS){
  assert.deepEqual(event.towerIds,['ore']);
  assert.equal(eligible(ore,event),event.conditions?.some(condition=>condition.kind==='PLAYER_HP_BELOW')?false:true);
  assert.equal(eligible(gem,event),false);
 }
});

test('ORE EVENT 03: exposed vein offers deterministic safe mining and persisted risk outcomes',()=>{
 const safe=open(run(),'ore_exposed_vein');
 const safeResult=choose(safe,'careful_mine');
 assert.equal(safeResult.expedition!.loot.materials.ore[0],3);

 for(const [roll,outcome] of [[.1,'rich_vein'],[.9,'vein_collapse']] as const){
  const state=open(run(),'ore_exposed_vein',roll);
  const beforeHp=state.expedition!.hp;
  const maxHp=stats(state,state.expedition!.equipment).hp;
  const resolved=choose(state,'deep_mine');
  assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
  if(outcome==='rich_vein'){
   assert.equal(resolved.expedition!.loot.materials.ore[0],6);
   assert.equal(resolved.expedition!.loot.silver,12);
  }else{
   assert.equal(resolved.expedition!.hp,beforeHp-Math.max(10,Math.floor(maxHp*.12)));
  }
 }
});

test('ORE EVENT 04: stranded surveyor trade is unavailable without a potion and consumes exactly one when used',()=>{
 const blocked=open(run(),'ore_stranded_surveyor');
 const blockedId=blocked.expedition!.events.pendingEvent!.instanceId;
 assert.strictEqual(resolveEvent(blocked,blockedId,'share_potion'),blocked);

 const state=run();
 state.expedition!.bag.healing_lesser=1;
 open(state,'ore_stranded_surveyor');
 const resolved=choose(state,'share_potion');
 assert.equal(resolved.expedition!.bag.healing_lesser,0);
 assert.equal(resolved.expedition!.loot.materials.ore[0],5);
 assert.equal(resolved.expedition!.loot.silver,25);
});

test('ORE EVENT 05: clear air pocket heals and clears poison without creating a battle turn',()=>{
 const state=run();
 const maxHp=stats(state,state.expedition!.equipment).hp;
 state.expedition!.hp=Math.floor(maxHp*.5);
 applyEffect(state.expedition!,'player','poison','monster',0);
 open(state,'ore_clear_air_pocket');
 const beforeTurn=state.expedition!.monsterTurn;
 const resolved=choose(state,'recover');
 assert.ok(resolved.expedition!.hp>state.expedition!.hp);
 assert.equal(resolved.expedition!.monsterTurn,beforeTurn);
 assert.equal(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='poison'),false);
});

test('ORE EVENT 06: abandoned workbench gives one expedition-scoped equipment preparation effect',()=>{
 for(const [choice,effectId] of [['sharpen','attack_up'],['reinforce','defense_up']] as const){
  const state=open(run(),'ore_reinforced_workbench');
  const resolved=choose(state,choice);
  const effect=resolved.expedition!.playerEffects.find(active=>active.effectId===effectId);
  assert.ok(effect);
  assert.equal(effect.scope,'EXPEDITION');
 }
});
