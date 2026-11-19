import test from 'node:test';
import assert from 'node:assert/strict';
import {cardTimeline,runCardTimeline} from '../src/gameFeel/cardSequence';
test('batch reveals lower grades first and serializes legendary spotlights',()=>{
 const events=cardTimeline(['legendary','common','heroic','legendary'],[0,1,2,3],false);
 assert.deepEqual(events.filter(e=>e.phase==='charge').map(e=>e.index),[1,2,0,3]);
 const firstEnd=events.find(e=>e.index===0&&e.phase==='finish')!.at;
 assert.ok(events.find(e=>e.index===3&&e.phase==='charge')!.at>=firstEnd);
 assert.equal(events.filter(e=>e.phase==='impact').length,4);
});
test('cancel discards scheduled callbacks and reduced motion has no spotlight wait',()=>{
 const callbacks=new Map<number,()=>void>();let id=0;const seen:string[]=[];
 const cancel=runCardTimeline(cardTimeline(['legendary'],[0],false),e=>seen.push(e.phase),()=>seen.push('done'),(fn)=>{callbacks.set(++id,fn);return id;},key=>{callbacks.delete(key);});
 cancel();for(const fn of callbacks.values())fn();assert.deepEqual(seen,[]);
 assert.ok(cardTimeline(['legendary'],[0],true).every(e=>e.at===0));
});

import {cuesForFeedback,EFFECT_SOUND_PROFILES} from '../src/audio/gameEffects';
import {resolveGameFeelRecipe} from '../src/gameFeel/engine';
test('confirmed card grades receive distinct bounded audio and motion recipes',()=>{
 for(const grade of ['common','uncommon','rare','heroic','legendary']){
  const [cue]=cuesForFeedback('card.result',{grade});assert.equal(cue.name,'card.'+grade);
  assert.ok(EFFECT_SOUND_PROFILES[cue.name].every(note=>note.delay+note.duration<=1));
  assert.ok(resolveGameFeelRecipe('card.result',{grade}).duration<=800);
 }
 assert.equal(resolveGameFeelRecipe('card.result',{grade:'legendary'},{reducedMotion:true}).duration,220);
});
test('normal playback emits every phase once and completes after the final finish',()=>{
 const pending:{fn:()=>void;ms:number}[]=[],seen:string[]=[];
 runCardTimeline(cardTimeline(['common','legendary'],[0,1],false),e=>seen.push(e.index+':'+e.phase),()=>seen.push('done'),(fn,ms)=>{pending.push({fn,ms});return pending.length;},()=>{});
 pending.sort((a,b)=>a.ms-b.ms).forEach(p=>p.fn());
 assert.deepEqual(seen,['0:charge','0:flip','0:impact','0:finish','1:charge','1:flip','1:impact','1:finish','done']);
});
