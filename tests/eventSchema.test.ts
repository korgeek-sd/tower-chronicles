import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {EVENT_CATALOG} from '../src/game/events/catalog';
import {validateEventCatalog} from '../src/game/events/catalogValidation';
import {DEV_EVENTS} from '../src/game/events/fixtures';
import {initialEvents,openEvent,resolveEvent} from '../src/game/events/service';
import {meetsCondition} from '../src/game/events/selector';
import type {ExpeditionEventDefinition} from '../src/game/events/types';

const run=()=>{const s=initialState();s.tickets.ore[0]=1;const n=enter(s,'ore',1);n.expedition!.events=initialEvents('test');return n;};

test('EVENT SCHEMA 01: production catalog passes authoring validation',()=>{
 assert.deepEqual(validateEventCatalog(EVENT_CATALOG),[]);
});

test('EVENT SCHEMA 02: invalid catalog data is rejected with useful errors',()=>{
 const invalid:ExpeditionEventDefinition={id:'bad',type:'RISK',title:'bad',description:'bad',weight:0,metadata:{fixture:true},conditions:[{kind:'PLAYER_HP_BELOW',ratio:2}],choices:[{id:'same',label:'a',effects:[{kind:'TAKE_DAMAGE_RATIO',ratio:0}]},{id:'same',label:'b',effects:[]}]};
 const errors=validateEventCatalog([invalid,invalid]);
 assert.ok(errors.some(error=>error.includes('weight must be > 0')));
 assert.ok(errors.some(error=>error.includes('fixture event')));
 assert.ok(errors.some(error=>error.includes('duplicate event id')));
 assert.ok(errors.some(error=>error.includes('duplicate choice id')));
 assert.ok(errors.some(error=>error.includes('ratio')));
});

test('EVENT SCHEMA 03: potion conditions inspect the expedition bag',()=>{
 const s=run();
 s.expedition!.bag.healing_lesser=0;
 assert.equal(meetsCondition(s,{kind:'HAS_POTION',potion:'healing_lesser',amount:1}),false);
 assert.equal(meetsCondition(s,{kind:'MISSING_POTION',potion:'healing_lesser',amount:1}),true);
 s.expedition!.bag.healing_lesser=1;
 assert.equal(meetsCondition(s,{kind:'HAS_POTION',potion:'healing_lesser',amount:1}),true);
 assert.equal(meetsCondition(s,{kind:'MISSING_POTION',potion:'healing_lesser',amount:1}),false);
});

test('EVENT SCHEMA 04: behavior is separate from style and new effects resolve deterministically',()=>{
 const fixture=DEV_EVENTS.find(event=>event.id==='TEST_SCHEMA_EVENT')!;
 const blocked=run();
 blocked.expedition!.bag.healing_lesser=0;
 openEvent(blocked,fixture,()=>.25);
 const instance=blocked.expedition!.events.pendingEvent!.instanceId;
 assert.strictEqual(resolveEvent(blocked,instance,'trade_health'),blocked);

 const s=run();
 s.expedition!.bag.healing_lesser=1;
 const maxHp=stats(s,s.expedition!.equipment).hp;
 s.expedition!.hp=maxHp;
 openEvent(s,fixture,()=>.25);
 const id=s.expedition!.events.pendingEvent!.instanceId;
 const resolved=resolveEvent(s,id,'trade_health');
 assert.equal(resolved.expedition!.bag.healing_lesser,0);
 assert.equal(resolved.expedition!.hp,maxHp-Math.floor(maxHp*.1));
 assert.equal(resolved.expedition!.events.phase,'EVENT_RESULT');
});
