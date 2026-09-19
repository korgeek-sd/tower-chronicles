import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {applyEffect} from '../src/game/engine/effects';
import {COMMON_EVENTS,PRODUCTION_EVENT_CATALOG} from '../src/game/events/catalog';
import {LEATHER_EVENTS} from '../src/game/events/content/leather';
import {validateEventCatalog} from '../src/game/events/catalogValidation';
import {eligible} from '../src/game/events/selector';
import {openEvent,resolveEvent} from '../src/game/events/service';
import {createRepository,SAVE_KEY} from '../src/storage/repository';
import type {GameState,Tower} from '../src/game/types';

const run=(tower:Tower='leather',floor=1)=>{const state=initialState();state.tickets[tower][floor-1]=1;return enter(state,tower,floor);};
const definition=(id:string)=>LEATHER_EVENTS.find(event=>event.id===id)!;
const open=(state:GameState,id:string,roll=.1)=>{openEvent(state,definition(id),()=>roll);return state;};
const choose=(state:GameState,choiceId:string)=>resolveEvent(state,state.expedition!.events.pendingEvent!.instanceId,choiceId);
const reload=(state:GameState)=>{const map=new Map([[SAVE_KEY,JSON.stringify(state)]]),repository=createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)});repository.save(state);return repository.load();};

test('LEATHER EVENT 01: production catalog validates with common + ore + kaleon + leather events',()=>{
  assert.equal(COMMON_EVENTS.length,6);
  assert.equal(LEATHER_EVENTS.length,5);
  assert.equal(PRODUCTION_EVENT_CATALOG.length,21);
  assert.equal(new Set(PRODUCTION_EVENT_CATALOG.map(event=>event.id)).size,21);
  assert.deepEqual(validateEventCatalog(PRODUCTION_EVENT_CATALOG),[]);
});

test('LEATHER EVENT 02: Leather authored events are eligible only inside the leather tower',()=>{
  const leather=run('leather');
  for(const event of LEATHER_EVENTS){
    assert.deepEqual(event.towerIds,['leather']);
    assert.equal(eligible(leather,event),event.conditions?.some(condition=>condition.kind==='PLAYER_HP_BELOW')?false:true);
    for(const tower of ['ore','gem','kaleon'] as const)assert.equal(eligible(run(tower),event),false);
  }
});

test('LEATHER EVENT 03: blood trail offers deterministic safe harvest and persisted risk outcomes',()=>{
  const safe=open(run(),'leather_blood_trail');
  const safeResult=choose(safe,'careful_follow');
  assert.equal(safeResult.expedition!.loot.materials.leather[0],3);

  for(const [roll,outcome] of [[.1,'rich_kill_site'],[.9,'ambushed']] as const){
    const state=open(run(),'leather_blood_trail',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const resolved=choose(state,'deep_track');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='rich_kill_site'){
      assert.equal(resolved.expedition!.loot.materials.leather[0],6);
      assert.equal(resolved.expedition!.loot.silver,15);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(12,Math.floor(maxHp*.15)));
    }
  }
});

test('LEATHER EVENT 04: abandoned camp heals and clears poison/predator_wound without creating a battle turn',()=>{
  const state=run();
  const maxHp=stats(state,state.expedition!.equipment).hp;
  state.expedition!.hp=Math.floor(maxHp*.5);
  applyEffect(state.expedition!,'player','poison','monster',0);
  applyEffect(state.expedition!,'player','predator_wound','monster',0);
  open(state,'leather_abandoned_camp');
  const beforeTurn=state.expedition!.monsterTurn;
  const resolved=choose(state,'rest_at_camp');
  assert.ok(resolved.expedition!.hp>state.expedition!.hp);
  assert.equal(resolved.expedition!.monsterTurn,beforeTurn);
  assert.equal(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='poison'),false);
  assert.equal(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='predator_wound'),false);
});

test('LEATHER EVENT 05: ritual altar offers deterministic safe skip and persisted risk outcomes with ritual_brand',()=>{
  const safe=open(run(),'leather_ritual_altar');
  const safeResult=choose(safe,'skip');
  assert.deepEqual(safeResult.expedition!.loot,safe.expedition!.loot);

  for(const [roll,outcome] of [[.1,'blessed_hide'],[.9,'pack_wrath']] as const){
    const state=open(run(),'leather_ritual_altar',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const resolved=choose(state,'offer_tribute');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='blessed_hide'){
      assert.equal(resolved.expedition!.loot.materials.leather[0],5);
      assert.equal(resolved.expedition!.loot.silver,20);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(15,Math.floor(maxHp*.18)));
      assert.ok(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='ritual_brand' && effect.scope==='EXPEDITION'));
    }
  }
});

test('LEATHER EVENT 06: alpha den gives one expedition-scoped attack_up or defense_up effect',()=>{
  for(const [choice,effectId] of [['embrace_ferocity','attack_up'],['learn_caution','defense_up']] as const){
    const state=open(run(),'leather_alpha_den');
    const resolved=choose(state,choice);
    const effect=resolved.expedition!.playerEffects.find(active=>active.effectId===effectId);
    assert.ok(effect);
    assert.equal(effect.scope,'EXPEDITION');
  }
});

test('LEATHER EVENT 07: scavenger cache gives deterministic potion and persisted risk outcomes',()=>{
  const safe=open(run(),'leather_scavenger_cache');
  const lesserBefore=safe.expedition!.bag.healing_lesser;
  const safeResult=choose(safe,'safe_take');
  assert.equal(safeResult.expedition!.bag.healing_lesser,lesserBefore+1);

  for(const [roll,outcome] of [[.1,'concentrated_hide'],[.9,'toxic_gas']] as const){
    const state=open(run(),'leather_scavenger_cache',roll);
    const beforeHp=state.expedition!.hp;
    const maxHp=stats(state,state.expedition!.equipment).hp;
    const standardBefore=state.expedition!.bag.healing_standard;
    const resolved=choose(state,'deep_search');
    assert.equal(resolved.expedition!.events.pendingEvent!.outcomeId,outcome);
    if(outcome==='concentrated_hide'){
      assert.equal(resolved.expedition!.loot.materials.leather[0],4);
      assert.equal(resolved.expedition!.bag.healing_standard,standardBefore+1);
    }else{
      assert.equal(resolved.expedition!.hp,beforeHp-Math.max(12,Math.floor(maxHp*.15)));
      assert.ok(resolved.expedition!.playerEffects.some(effect=>effect.effectId==='poison' && effect.scope==='EXPEDITION'));
    }
  }
});

test('LEATHER EVENT 08: risk outcomes use the persisted random ticket after reload',()=>{
  for(const [eventId,choiceId] of [['leather_blood_trail','deep_track'],['leather_ritual_altar','offer_tribute'],['leather_scavenger_cache','deep_search']] as const){
    for(const roll of [.1,.9]){
      const state=open(run(),eventId,roll);
      const resolved=choose(state,choiceId);
      const restored=choose(reload(state),choiceId);
      assert.deepEqual(restored,resolved);
    }
  }
});