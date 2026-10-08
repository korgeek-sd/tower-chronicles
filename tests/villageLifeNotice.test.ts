import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {VillageLifeNotice} from '../src/components/world/WorldPage';

const render=(error:string,pending:boolean,busy:boolean)=>renderToStaticMarkup(React.createElement(VillageLifeNotice,{error,pending,busy,canRetry:true,onRetry:()=>{}}));
test('an ordinary pending gathering request does not flash a recovery warning',()=>{
 assert.equal(render('',true,true),'');
 assert.equal(render('',false,false),'');
});
test('an unresolved request still exposes recovery when no request is in flight',()=>{
 const html=render('',true,false);
 assert.match(html,/role="alert"/);
 assert.match(html,/이전 생활 결과 확인이 필요합니다/);
 assert.match(html,/생활 결과 다시 확인/);
});
test('actual failures stay visible and retry is disabled while checking them',()=>{
 const html=render('생활 상태를 불러오지 못했습니다.',false,true);
 assert.match(html,/생활 상태를 불러오지 못했습니다/);
 assert.match(html,/<button[^>]*disabled/);
});
