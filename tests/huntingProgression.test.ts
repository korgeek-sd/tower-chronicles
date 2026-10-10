import test from 'node:test';
import assert from 'node:assert/strict';
import {huntingLevel,HUNT_MAPS,resolveHunt,initialHuntingState,huntingExperienceForLevel,huntingExperienceToNextLevel,huntingProgress} from '../src/game/hunting/model';
test('confirmed progression uses cumulative thresholds at every level and caps at 100',()=>{
 assert.equal(huntingExperienceForLevel(20),49780);
 assert.equal(huntingExperienceForLevel(40),672780);
 assert.equal(huntingExperienceForLevel(100),239686780);
 for(let level=1;level<100;level++){
  const next=huntingExperienceForLevel(level+1);
  assert.equal(huntingLevel(next-1),level);assert.equal(huntingLevel(next),level+1);
  assert.equal(next-huntingExperienceForLevel(level),huntingExperienceToNextLevel(level));
 }
 assert.equal(huntingLevel(-1),1);assert.equal(huntingLevel(Infinity),1);
 assert.equal(huntingLevel(1e12),100);assert.equal(huntingExperienceToNextLevel(99),16300000);
 assert.deepEqual(huntingProgress(239686780),{level:100,exp:0,nextExp:0});
});
test('every region grants its confirmed reward, food adds ten percent, defeat grants zero',()=>{
 assert.deepEqual(HUNT_MAPS.map(m=>m.exp),[100,250,600,1400,3000]);
 for(const map of HUNT_MAPS){
  const s=initialHuntingState(0),fighter={hp:10000,attack:10000,defense:10000};
  assert.equal(resolveHunt(s,map.id,fighter,['heavy'],0,()=>1).result.exp,map.exp);
  assert.equal(resolveHunt({...s,foodTurns:{experience_food:1}},map.id,fighter,['heavy'],0,()=>1).result.exp,Math.floor(map.exp*1.1));
  assert.equal(resolveHunt(s,map.id,{hp:1,attack:0,defense:0},[],0,()=>1).result.exp,0);
 }
});
