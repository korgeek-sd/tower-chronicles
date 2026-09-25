import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {EVENT_CATALOG} from '../src/game/events/catalog.ts';
import {eligible} from '../src/game/events/selector.ts';
import {openEvent,resolveEvent} from '../src/game/events/service.ts';
import {APP_VERSION} from '../src/storage/repository.ts';
import type {GameState,Tower} from '../src/game/types.ts';

const towers:Tower[]=['ore','leather','gem','kaleon'];
const gatherId=(tower:Tower)=>'resource_gather_'+tower;
const run=(tower:Tower,floor=3)=>{
 const s=initialState();
 s.tickets[tower][floor-1]=1;
 return enter(s,tower,floor);
};
const resolveAuthored=(tower:Tower,id:string,roll:number,choice:string)=>{
 const s=run(tower),d=EVENT_CATALOG.find(event=>event.id===id);
 assert.ok(d,id);
 openEvent(s,d,()=>roll);
 const instance=s.expedition!.events.pendingEvent!.instanceId;
 return resolveEvent(s,instance,choice);
};

test('RELEASE 0.1.47: metadata and authored exploration catalog are aligned',()=>{
 assert.equal(APP_VERSION,'0.1.47');
 assert.equal(EVENT_CATALOG.filter(event=>event.id.startsWith('resource_gather_')).length,4);
});

test('EVENT OVERHAUL 01: every ordinary reward interaction has a failure risk and a safe skip',()=>{
 const ordinary=EVENT_CATALOG.filter(event=>!['STRONGHOLD','BOSS'].includes(event.type));
 for(const event of ordinary){
  const skip=event.choices.find(choice=>choice.styleVariant==='SKIP');
  assert.ok(skip,event.id+' missing safe skip');
  assert.deepEqual(skip!.effects,[],event.id+' skip must stay consequence-free');
  for(const choice of event.choices.filter(choice=>choice.styleVariant!=='SKIP')){
   assert.ok(choice.outcomes?.length,event.id+'/'+choice.id+' must roll outcomes');
   const risky=choice.outcomes!.some(outcome=>outcome.effects.some(effect=>effect.kind==='TAKE_DAMAGE'||effect.kind==='APPLY_EFFECT'));
   assert.equal(risky,true,event.id+'/'+choice.id+' must include a harmful outcome');
  }
 }
});

test('EVENT OVERHAUL 02: resource gathering uses one mechanic with tower-specific presentation',()=>{
 const expected:Record<Tower,string>={
  ore:'노출된 광맥',
  leather:'사냥감 저장소',
  gem:'고밀도 수정 군집',
  kaleon:'녹빛 약초 재배대',
 };
 for(const tower of towers){
  const event=EVENT_CATALOG.find(entry=>entry.id===gatherId(tower));
  assert.ok(event,tower);
  assert.equal(event!.title,expected[tower]);
  assert.deepEqual(event!.towerIds,[tower]);
  assert.equal(eligible(run(tower),event!),true);
  for(const other of towers.filter(value=>value!==tower))assert.equal(eligible(run(other),event!),false);
 }
});

test('EVENT OVERHAUL 03: gathering has deterministic great/success/failure bands',()=>{
 for(const tower of towers){
  const great=resolveAuthored(tower,gatherId(tower),.10,'gather');
  assert.equal(great.expedition!.events.pendingEvent!.outcomeId,'great');
  assert.equal(great.expedition!.loot.materials[tower][0],5);
  assert.equal(great.expedition!.loot.silver,15);

  const success=resolveAuthored(tower,gatherId(tower),.50,'gather');
  assert.equal(success.expedition!.events.pendingEvent!.outcomeId,'success');
  assert.equal(success.expedition!.loot.materials[tower][0],3);
  assert.equal(success.expedition!.loot.silver,0);

  const failure=resolveAuthored(tower,gatherId(tower),.90,'gather');
  assert.equal(failure.expedition!.events.pendingEvent!.outcomeId,'failure');
  assert.equal(failure.expedition!.loot.materials[tower][0],0);
 }
});

test('EVENT OVERHAUL 04: each tower failure applies its authored risk',()=>{
 const ore=run('ore'),oreHp=ore.expedition!.hp;
 const oreEvent=EVENT_CATALOG.find(event=>event.id===gatherId('ore'))!;
 openEvent(ore,oreEvent,()=>.9);
 const oreFailed=resolveEvent(ore,ore.expedition!.events.pendingEvent!.instanceId,'gather');
 assert.equal(oreFailed.expedition!.hp,oreHp-14);

 const expectedEffects:Partial<Record<Tower,string>>={
  leather:'fang_wound',
  gem:'crystal_fracture',
  kaleon:'kaleon_blight',
 };
 for(const tower of ['leather','gem','kaleon'] as const){
  const failed=resolveAuthored(tower,gatherId(tower),.9,'gather');
  const effect=failed.expedition!.playerEffects.find(active=>active.effectId===expectedEffects[tower]);
  assert.ok(effect,tower);
  assert.equal(effect!.scope,'EXPEDITION');
 }
});

test('EVENT OVERHAUL 05: skipping a resource site is a true no-op',()=>{
 for(const tower of towers){
  const s=run(tower),before=structuredClone(s.expedition!.loot),hp=s.expedition!.hp,effects=structuredClone(s.expedition!.playerEffects);
  const d=EVENT_CATALOG.find(event=>event.id===gatherId(tower))!;
  openEvent(s,d,()=>.9);
  const n=resolveEvent(s,s.expedition!.events.pendingEvent!.instanceId,'skip');
  assert.deepEqual(n.expedition!.loot,before);
  assert.equal(n.expedition!.hp,hp);
  assert.deepEqual(n.expedition!.playerEffects,effects);
  assert.equal(n.expedition!.events.pendingEvent!.outcomeId,null);
 }
});

test('EVENT OVERHAUL 06: former free events now expose three-result risk bands',()=>{
 for(const id of ['common_rest','common_cache','common_risk','common_remedy']){
  const event=EVENT_CATALOG.find(entry=>entry.id===id)!;
  const action=event.choices.find(choice=>choice.styleVariant!=='SKIP')!;
  assert.deepEqual(action.outcomes!.map(outcome=>outcome.id),['great','success','failure']);
  assert.ok(action.outcomes!.every(outcome=>outcome.resultText.length>0));
 }
});
