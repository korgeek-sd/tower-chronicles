import test from 'node:test';
import assert from 'node:assert/strict';
import {questRewardSummary} from '../src/online/quests';
test('old quest food rewards display current food names while preserving quantities',()=>{
 assert.equal(questRewardSummary([{item:'defense_food',name:'방어 음식',quantity:2},{item:'experience_food',name:'경험치 음식',quantity:3},{item:'potion',name:'체력 포션',quantity:100}]),'감자튀김 2개 · 빵 3개 · 체력 포션 100개');
});
