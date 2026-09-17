import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {applyEffect} from '../src/game/engine/effects';
import {createRepository,SAVE_KEY} from '../src/storage/repository';
import {COMMON_EVENTS,PRODUCTION_EVENT_CATALOG} from '../src/game/events/catalog';
import {KALEON_EVENTS} from '../src/game/events/content/kaleon';
import {validateEventCatalog} from '../src/game/events/catalogValidation';
import {eligible} from '../src/game/events/selector';
import {openEvent,resolveEvent} from '../src/game/events/service';
import type {GameState,Tower} from '../src/game/types';

const run=(tower:Tower='kaleon',floor=1)=>{const state=initialState();state.tickets[tower][floor-1]=1;return enter(state,tower,floor);};
const definition=(id:string)=>KALEON_EVENTS.find(event=>event.id===id)!;
const open=(state:GameState,id:string,roll=.1)=>{openEvent(state,definition(id),()=>roll);return state;};
const choose=(state:GameState,choiceId:string)=>resolveEvent(state,state.expedition!.events.pendingEvent!.instanceId,choiceId);
const reload=(state:GameState)=>{const map=new Map([[SAVE_KEY,JSON.stringify(state)]]),repository=createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)});repository.save(state);return repository.load();};

test('KALEON EVENT 01: production catalog validates with common + ore + kaleon events',()=>{
  assert.equal(COMMON_EVENTS.length,6);
  assert.equal(KALEON_EVENTS.length,5);
  assert.equal(PRODUCTION_EVENT_CATALOG.length,16);
  assert.equal(new Set(PRODUCTION_EVENT_CATALOG.map(event=>event.id)).size,16);
  assert.deepEqual(validateEventCatalog(PRODUCTION_EVENT_CATALOG),[]);
});

test('KALEON EVENT 02: Kaleon authored events are eligible only inside the kaleon tower',()=>{
  const kaleon=run('kaleon');
  for(const event of KALEON_EVENTS){
    assert.deepEqual(event.towerIds,['kaleon']);
    assert.equal(eligible(kaleon,event),event.conditions?.some(condition=>condition.kind==='PLAYER_HP_BELOW')?false:true);
    for(const tower of ['ore','leather','gem'] as const)assert.equal(eligible(run(tower),event),false);
  }
});

test('KALEON EVENT 03: verdant herb garden offers deterministic safe harvest and persisted risk outcomes',()=>{
  const safe=open(run(),'kaleon_verdant_herb_garden');
  const safeResult=choose(safe,'careful_harvest');
  assert.equal(safeResult.expedition!.loot.materials.kaleon[0],3);

  for(const [roll,outcome] of [[.1,'bountiful_garden'],[.9,'toxic_sap']] as const){
    const state=open(run(),'kaleon_verdant_herb_garden',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const resolved=choose(state,'deep_harvest');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='bountiful_garden'){
      assert.equal(resolved.expedition!.loot.materials.kaleon[0],6);
      assert.equal(resolved.expedition!.loot.silver,12);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(10,Math.floor(maxHp*.12)));
    }
  }
});

test('KALEON EVENT 04: abandoned infirmary heals and clears poison/green_incense without creating a battle turn',()=>{
  const state=run();
  const maxHp=stats(state,state.expedition!.equipment).hp;
  state.expedition!.hp=Math.floor(maxHp*.5);
  applyEffect(state.expedition!,'player','poison','monster',0);
  applyEffect(state.expedition!,'player','green_incense','monster',0);
  open(state,'kaleon_abandoned_infirmary');
  const beforeTurn=state.expedition!.monsterTurn;
  const resolved=choose(state,'rest_and_treat');
  assert.ok(resolved.expedition!.hp>state.expedition!.hp);
  assert.equal(resolved.expedition!.monsterTurn,beforeTurn);
  assert.equal(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='poison'),false);
  assert.equal(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='green_incense'),false);
});

test('KALEON EVENT 05: atonement bed offers deterministic safe skip and persisted risk outcomes with transferred_pain',()=>{
  const safe=open(run(),'kaleon_atonement_bed');
  const safeResult=choose(safe,'skip');
  assert.deepEqual(safeResult.expedition!.loot,safe.expedition!.loot);

  for(const [roll,outcome] of [[.1,'atonement_success'],[.9,'pain_transferred']] as const){
    const state=open(run(),'kaleon_atonement_bed',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const resolved=choose(state,'lie_down');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='atonement_success'){
      assert.equal(resolved.expedition!.loot.materials.kaleon[0],5);
      assert.equal(resolved.expedition!.loot.silver,20);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(15,Math.floor(maxHp*.18)));
      assert.ok(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='transferred_pain' && effect.scope==='EXPEDITION'));
    }
  }
});

test('KALEON EVENT 06: confessional gives one expedition-scoped attack_up or defense_up effect',()=>{
  for(const [choice,effectId] of [['confess','attack_up'],['remain_silent','defense_up']] as const){
    const state=open(run(),'kaleon_confessional');
    const resolved=choose(state,choice);
    const effect=resolved.expedition!.playerEffects.find(active=>active.effectId===effectId);
    assert.ok(effect);
    assert.equal(effect.scope,'EXPEDITION');
  }
});

test('KALEON EVENT 07: anointing store gives deterministic potion and persisted risk outcomes',()=>{
  const safe=open(run(),'kaleon_anointing_store');
  const lesserBefore=safe.expedition!.bag.healing_lesser;
  const safeResult=choose(safe,'safe_salvage');
  assert.equal(safeResult.expedition!.bag.healing_lesser,lesserBefore+1);

  for(const [roll,outcome] of [[.1,'rich_extract'],[.9,'corrupted_anointing']] as const){
    const state=open(run(),'kaleon_anointing_store',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const standardBefore=state.expedition!.bag.healing_standard;
    const resolved=choose(state,'deep_investigate');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='rich_extract'){
      assert.equal(resolved.expedition!.loot.materials.kaleon[0],4);
      assert.equal(resolved.expedition!.bag.healing_standard,standardBefore+1);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(12,Math.floor(maxHp*.15)));
      assert.ok(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='green_incense' && effect.scope==='EXPEDITION'));
    }
  }
});

test('KALEON EVENT 08: risk outcomes use the persisted random ticket after reload',()=>{
  for(const [eventId,choiceId] of [['kaleon_verdant_herb_garden','deep_harvest'],['kaleon_atonement_bed','lie_down'],['kaleon_anointing_store','deep_investigate']] as const){
    for(const roll of [.1,.9]){
      const state=open(run(),eventId,roll);
      const resolved=choose(state,choiceId);
      const restored=choose(reload(state),choiceId);
      assert.deepEqual(restored,resolved);
    }
  }
});
