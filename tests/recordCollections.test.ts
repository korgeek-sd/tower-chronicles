import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 for(const text of ['인물의 기록','유물의 기록','끝나지 않은 충성','완성한 기록','누적 능력치'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/THE ARCHIVE OF THE TOWER|잊힌 이름도, 사라진 이야기도|인물 자동 등록 · 유물은 장비 소모/);
 assert.doesNotMatch(html,/tc-record-header|tc-record-footnote/);
 const withAppearanceLink=renderToStaticMarkup(React.createElement(RecordCollectionScreen,{game:initialState(),setGame:()=>{},onAppearances:()=>{}}));
 assert.match(withAppearanceLink,/tc-record-summary-heading/);
 assert.match(withAppearanceLink,/외형 목록/);
 assert.match(html,/aria-label="인물의 기록 목록"/);
 assert.doesNotMatch(html,/record_relic_armor/);
});
test('unknown record IDs cannot consume guest inventory',()=>{
 const initial=initialState();
 const result=registerCollectionEquipment(initial,'record_people_knights','anything');
 assert.equal(result.equipmentItems.length,initial.equipmentItems.length);
 assert.equal(result.collectionRegisteredItems?.record_people_knights,undefined);
});


test('archive mobile UI uses bounded pagination instead of a scrollable list',()=>{
 const tsx=readFileSync('src/components/mobile/RecordCollectionScreen.tsx','utf8');
 const css=readFileSync('src/components/mobile/record-collection.css','utf8');
 assert.match(tsx,/visibleRecords=lists\.slice\(/);
 assert.match(tsx,/getComputedStyle\(element\)/);
 assert.match(tsx,/tc-record-entry-rank/);
 assert.match(tsx,/tc-record-entry-progress/);
 assert.doesNotMatch(tsx,/EquipmentArt|assetUrl|tc-record-entry-art|tc-record-material-art/);
 assert.match(css,/--tc-record-row-height:55px/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(67px,25%\) 38px 10px/);
 assert.match(tsx,/ref=\{listRef\}/);
 assert.match(tsx,/aria-label="다음 컬렉션 페이지"/);
 assert.doesNotMatch(tsx,/className="sr-only">컬렉션 검색/);
 assert.match(css,/\.tc-record-list\{[^}]*overflow:hidden!important/);
 assert.match(css,/\.tc-record-screen>\.tc-screen-body\{[^}]*overflow:hidden/);
});

test('collection rows are image-free and retain real progress and rewards',()=>{
 const html=renderToStaticMarkup(React.createElement(RecordCollectionScreen,{game:initialState(),setGame:()=>{}}));
 assert.ok(html.includes('끝나지 않은 충성'));
 assert.ok(html.includes('방어력 +1'));
 assert.ok(html.includes('0 / 2'));
 assert.match(html,/tc-record-sigil/);
 assert.doesNotMatch(html,/<img\b|tc-record-entry-art|tc-record-material-art/);
});
