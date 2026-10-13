import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CraftPendingIndicator,CraftReceiptToast} from '../src/components/world/CraftFeedback';
test('pending crafting is indeterminate and never advertises a fabricated percentage',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftPendingIndicator));
 assert.match(html,/role="progressbar"/);assert.match(html,/u083-seg a/);assert.match(html,/u083-seg b/);
 assert.doesNotMatch(html,/aria-valuenow|\d+%/);assert.match(html,/제작 요청 처리 중/);
});
test('receipt toast names the actual server product and quantity without blocking controls',()=>{
 const html=renderToStaticMarkup(React.createElement(CraftReceiptToast,{receipt:{requestId:'receipt-1',product:'experience_food',quantity:3},index:0,open:false,onDismiss:()=>{},onHeight:()=>{}}));
 assert.match(html,/빵 3개 제작 완료/);assert.match(html,/role="status"/);assert.match(html,/aria-label="알림 닫기"/);
 assert.doesNotMatch(html,/<dialog|제작 확정/);
});
