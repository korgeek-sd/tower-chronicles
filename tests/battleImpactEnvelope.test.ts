import test from 'node:test';
import assert from 'node:assert/strict';
import {battleImpactEnvelope} from '../src/components/battle/battleVfxTimeline.ts';

test('impact bursts peak quickly and leave a longer fading tail',()=>{
 const start=battleImpactEnvelope(0,false),peak=battleImpactEnvelope(55,false),tail=battleImpactEnvelope(220,false);
 assert.ok(peak.core>start.core);
 assert.ok(peak.core>tail.core);
 assert.ok(tail.flame>0);
 assert.equal(battleImpactEnvelope(700,false).flame,0);
 assert.ok(battleImpactEnvelope(100,true).radius>battleImpactEnvelope(100,false).radius);
});
