import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {RecordCollectionScreen} from '../src/components/mobile/RecordCollectionScreen';
import {RECORD_COLLECTION_SETS,APPEARANCE_RECORD_SETS,EQUIPMENT_RECORD_SETS,recordCollectionProgress,recordCollectionBonuses,validateRecordCollections} from '../src/game/data/recordCollections';
import {registerCollectionEquipment} from '../src/game/engine/collection';

test('record data contains ten independent appearance and relic records',()=>{
 assert.equal(APPEARANCE_RECORD_SETS.length,10);
 assert.equal(EQUIPMENT_RECORD_SETS.length,10);
 assert.equal(RECORD_COLLECTION_SETS.length,20);
 assert.ok(validateRecordCollections());
 assert.ok(APPEARANCE_RECORD_SETS.every(s=>s.kind==='appearance'&&s.equipment===undefined));
 assert.ok(EQUIPMENT_RECORD_SETS.every(s=>s.kind==='equipment'&&s.appearanceIds.length===0));
});
test('appearances unlock automatically and equipped appearance is irrelevant',()=>{
 const set=APPEARANCE_RECORD_SETS[0];
 assert.deepEqual(recordCollectionProgress(set,[],new Set()),{count:0,total:2,complete:false});
 assert.equal(recordCollectionProgress(set,[...set.appearanceIds],new Set()).complete,true);
 assert.deepEqual(recordCollectionBonuses(set.appearanceIds,new Set()),{hp:0,attack:0,defense:1});
});
test('legacy equipment registration counts without re-registering or duplicating value',()=>{
 const registered=new Set(['ashen_border_1']);
 assert.deepEqual(recordCollectionProgress(EQUIPMENT_RECORD_SETS[0],[],registered),{count:1,total:1,complete:true});
 assert.deepEqual(recordCollectionBonuses([],registered),{hp:0,attack:1,defense:0});
});
test('record UI displays tabs, completion conditions and active categories',()=>{
 const html=renderToStaticMarkup(React.createElement(RecordCollectionScreen,{game:initialState(),setGame:()=>{}}));
 for(const text of ['기록의 서고','인물의 기록','유물의 기록','자동 등록','영구 적용','끝나지 않은 충성','완성한 기록'])assert.ok(html.includes(text),text);
 assert.match(html,/aria-label="인물의 기록 목록"/);
 assert.doesNotMatch(html,/record_relic_armor/);
});
test('unknown record IDs cannot consume guest inventory',()=>{
 const initial=initialState();
 const result=registerCollectionEquipment(initial,'record_people_knights','anything');
 assert.equal(result.equipmentItems.length,initial.equipmentItems.length);
 assert.equal(result.collectionRegisteredItems?.record_people_knights,undefined);
});
