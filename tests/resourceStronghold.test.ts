import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {enter,abandonStrongholdAndReturn} from '../src/game/engine/expedition.ts';
import {createStrongholdRuntime,settleStronghold,STRONGHOLD_BALANCE} from '../src/game/events/resourceStronghold.ts';
import {openEvent,resolveEvent,expireTimedEventChoice,continueEvent} from '../src/game/events/service.ts';
import {EVENT_CATALOG} from '../src/game/events/catalog.ts';
import {createRepository,validSave,SAVE_KEY} from '../src/storage/repository.ts';

const withStronghold=(now=1_000,floor=3)=>{
 const s=initialState();
 s.tickets.ore[floor-1]=1;
 const n=enter(s,'ore',floor);
 const runtime=createStrongholdRuntime(n,now);
 assert.ok(runtime);
 n.expedition!.events.stronghold=runtime;
 return n;
};


const timedStrongholdEvent=(now=100_000)=>{
 const s=initialState();
 s.tickets.ore[2]=1;
 const n=enter(s,'ore',3);
 const definition=EVENT_CATALOG.find(event=>event.id==='resource_stronghold');
 assert.ok(definition);
 openEvent(n,definition,()=>0,null,now);
 return n;
};

const memory=()=>{
 const map=new Map<string,string>();
 return {map,repo:createRepository({getItem:key=>map.get(key)??null,setItem:(key,value)=>void map.set(key,value)})};
};

test('STRONGHOLD 01: 3F+ creates one 15-minute ACTIVE runtime with immutable reward snapshot',()=>{
 const s=withStronghold();
 const r=s.expedition!.events.stronghold!;
 assert.equal(r.status,'ACTIVE');
 assert.equal(r.ownerUserId,s.market.ownerId);
 assert.equal(r.tower,'ore');
 assert.equal(r.floor,3);
 assert.equal(r.captureEndsAt-r.captureStartedAt,STRONGHOLD_BALANCE.captureMs);
 assert.equal(r.reward.tower,'ore');
 assert.ok(r.reward.materialAmount>0);
 assert.equal(r.contestedByUserId,null);
 assert.equal(r.deletedAt,null);
});

test('STRONGHOLD 02: abandoning deletes the stronghold and immediately safe-returns only current expedition loot',()=>{
 const s=withStronghold(10_000);
 const reward=s.expedition!.events.stronghold!.reward.materialAmount;
 s.expedition!.loot.materials.ore[0]=4;
 s.expedition!.loot.silver=37;
 const n=abandonStrongholdAndReturn(s,20_000);
 assert.equal(n.expedition,null);
 assert.equal(n.lastExpedition?.outcome,'returned');
 assert.equal(n.lastExpedition?.loot.materials.ore[0],4);
 assert.equal(n.materials.ore[0],4);
 assert.equal(n.silver,37);
 assert.notEqual(n.materials.ore[0],4+reward);
 assert.ok(n.logs.some(line=>line.includes('자원거점 점령 포기')));
 assert.ok(n.logs.some(line=>line.includes('안전 귀환')));
});

test('STRONGHOLD 03: abandon-return cannot bypass enemy turns, events, revival or CONTESTED state',()=>{
 const enemy=withStronghold();enemy.expedition!.phase='MONSTER_TURN';
 assert.strictEqual(abandonStrongholdAndReturn(enemy),enemy);
 const event=withStronghold();event.expedition!.events.phase='EVENT';
 assert.strictEqual(abandonStrongholdAndReturn(event),event);
 const revival=withStronghold();revival.expedition!.pendingRevival={source:'EVENT_DAMAGE',steps:[{kind:'AFTER_EVENT_RESULT'}]};
 assert.strictEqual(abandonStrongholdAndReturn(revival),revival);
 const contested=withStronghold();const r=contested.expedition!.events.stronghold!;r.status='CONTESTED';r.contestedByUserId='other';r.contestRemainingMs=60_000;
 assert.strictEqual(abandonStrongholdAndReturn(contested),contested);
});

test('STRONGHOLD 04: active stronghold survives current save roundtrip without resetting its timestamps or reward',()=>{
 const s=withStronghold(123_456,7),{repo,map}=memory();
 assert.equal(validSave(s),true);
 repo.save(s);
 assert.ok(map.has(SAVE_KEY));
 const n=repo.load();
 assert.deepEqual(n.expedition!.events.stronghold,s.expedition!.events.stronghold);
});

test('STRONGHOLD 05: malformed persisted stronghold states are rejected',()=>{
 const source=withStronghold(50_000,5);
 const corruptions:Array<(s:any)=>void>=[
  s=>{s.expedition.events.stronghold.floor=2;},
  s=>{s.expedition.events.stronghold.tower='kaleon';},
  s=>{s.expedition.events.stronghold.reward.tower='gem';},
  s=>{s.expedition.events.stronghold.captureEndsAt=s.expedition.events.stronghold.captureStartedAt;},
  s=>{s.expedition.events.stronghold.status='ACTIVE';s.expedition.events.stronghold.deletedAt=55_000;},
  s=>{s.expedition.events.stronghold.ownerUserId='';},
 ];
 for(const mutate of corruptions){
  const s:any=structuredClone(source);mutate(s);
  assert.equal(validSave(s),false);
  assert.throws(()=>memory().repo.save(s));
 }
});

test('STRONGHOLD 06: completion pays the snapshotted reward once, marks the runtime deleted and remains save-valid',()=>{
 const s=withStronghold(1_000,6),r=s.expedition!.events.stronghold!,amount=r.reward.materialAmount,end=r.captureEndsAt;
 assert.strictEqual(settleStronghold(s,end-1),s);
 const n=settleStronghold(s,end);
 assert.equal(n.expedition!.loot.materials.ore[0],amount);
 assert.equal(n.expedition!.events.stronghold!.status,'DELETED');
 assert.equal(n.expedition!.events.stronghold!.completedAt,end);
 assert.equal(n.expedition!.events.stronghold!.deletedAt,end);
 assert.equal(validSave(n),true);
 assert.strictEqual(settleStronghold(n,end+1),n);
});


test('STRONGHOLD 07: timed encounter persists an exact 30-second deadline and does nothing before it',()=>{
 const opened=timedStrongholdEvent(100_000),p=opened.expedition!.events.pendingEvent!;
 assert.equal(p.expiresAt,130_000);
 assert.equal(validSave(opened),true);
 assert.strictEqual(expireTimedEventChoice(opened,129_999),opened);
 const {repo}=memory();repo.save(opened);
 assert.equal(repo.load().expedition!.events.pendingEvent!.expiresAt,130_000);
});

test('STRONGHOLD 08: deadline automatically resolves as skip without creating or rewarding a stronghold',()=>{
 const opened=timedStrongholdEvent(200_000),before=structuredClone(opened.expedition!.loot);
 const expired=expireTimedEventChoice(opened,230_000);
 const p=expired.expedition!.events.pendingEvent!;
 assert.equal(expired.expedition!.events.phase,'EVENT_RESULT');
 assert.equal(p.state,'RESULT');
 assert.equal(p.choiceId,'skip');
 assert.equal(p.outcomeId,null);
 assert.match(p.resultText,/30초가 지나/);
 assert.equal(expired.expedition!.events.stronghold,null);
 assert.deepEqual(expired.expedition!.loot,before);
 assert.equal(validSave(expired),true);
 const resumed=continueEvent(expired,p.instanceId,()=>.99);
 assert.equal(resumed.expedition!.events.phase,'BATTLE');
});

test('STRONGHOLD 09: a late claim click is coerced to skip, while a claim before deadline starts the 15-minute timer at decision time',()=>{
 const late=timedStrongholdEvent(300_000),lateId=late.expedition!.events.pendingEvent!.instanceId;
 const skipped=resolveEvent(late,lateId,'claim',330_001);
 assert.equal(skipped.expedition!.events.pendingEvent!.choiceId,'skip');
 assert.equal(skipped.expedition!.events.stronghold,null);

 const timely=timedStrongholdEvent(400_000),timelyId=timely.expedition!.events.pendingEvent!.instanceId;
 const claimed=resolveEvent(timely,timelyId,'claim',429_999),r=claimed.expedition!.events.stronghold!;
 assert.equal(claimed.expedition!.events.pendingEvent!.choiceId,'claim');
 assert.equal(r.status,'ACTIVE');
 assert.equal(r.captureStartedAt,429_999);
 assert.equal(r.captureEndsAt,429_999+STRONGHOLD_BALANCE.captureMs);
});
