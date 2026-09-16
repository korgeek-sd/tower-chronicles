import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ORE_EVENTS} from '../src/game/events/content/ore';
import {eventAsset} from '../src/game/events/catalog';

test('IRON EVENT ART: every Iron Vein event has a checked-in illustration',()=>{
  for(const event of ORE_EVENTS){
    assert.ok(event.imageAssetKey,`${event.id}: imageAssetKey is required`);
    const asset=eventAsset(event.imageAssetKey);
    assert.ok(asset,`${event.id}: asset key is not registered`);
    const filePath=asset!.replace(/^\.\//,'public/');
    assert.ok(existsSync(filePath),`${event.id}: missing ${filePath}`);
  }
});
