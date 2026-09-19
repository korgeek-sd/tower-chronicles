import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleFxCollector} from '../src/game/engine/battleFx';
import {buildBattleFxBatch} from '../src/components/battle/battleFxPresentation';

test('battle FX collector preserves engine emission order',()=>{
  const fx=createBattleFxCollector();
  fx.emit({source:'player',target:'monster',kind:'DIRECT_HIT',damage:10});
  fx.emit({source:'monster',target:'player',kind:'DIRECT_HIT',skillId:'counter',damage:7});
  fx.emit({source:'player',target:'monster',kind:'DIRECT_HIT',damage:10});
  assert.deepEqual(fx.events.map(event=>event.sequence),[0,1,2]);
  assert.deepEqual(fx.events.map(event=>event.target),['monster','player','monster']);
});

test('battle FX batch keeps equal damage hits when event ids differ',()=>{
  const fx=createBattleFxCollector();
  fx.emit({source:'player',target:'monster',kind:'DIRECT_HIT',weaponId:'bow',hitIndex:0,hitCount:2,damage:12});
  fx.emit({source:'player',target:'monster',kind:'DIRECT_HIT',weaponId:'bow',hitIndex:1,hitCount:2,damage:12});
  const batch=buildBattleFxBatch(fx.events,'batch-1','PLAYER_ACTION');
  assert.equal(batch.events.length,2);
  assert.equal(batch.events[0].atMs,0);
  assert.equal(batch.events[1].atMs,110);
  assert.notEqual(batch.events[0].playbackId,batch.events[1].playbackId);
});

test('battle FX batch drops only duplicate event ids and keeps sequence timing',()=>{
  const fx=createBattleFxCollector();
  const first=fx.emit({source:'player',target:'monster',kind:'DIRECT_HIT',damage:8});
  const second=fx.emit({source:'monster',target:'player',kind:'DIRECT_HIT',damage:5});
  const batch=buildBattleFxBatch([first,first,second],'batch-2','SYSTEM');
  assert.equal(batch.events.length,2);
  assert.deepEqual(batch.events.map(event=>event.target),['monster','player']);
  assert.ok(batch.events[1].atMs>batch.events[0].atMs);
});
