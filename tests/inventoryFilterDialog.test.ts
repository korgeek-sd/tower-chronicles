import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InventoryFilterDialog,inventoryGradeSummary} from '../src/components/inventory/InventoryFilterDialog';
test('inventory grade summary describes multiple choices compactly',()=>{assert.equal(inventoryGradeSummary('equipment',[]),'전체 등급');assert.equal(inventoryGradeSummary('equipment',['rare','legendary']),'희귀 외 1개');assert.equal(inventoryGradeSummary('skillbooks',['SR']),'SR');});
test('filter dialog retains search, sorting, grade multiselect and reset controls',()=>{const html=renderToStaticMarkup(React.createElement(InventoryFilterDialog,{category:'equipment',query:'',sort:'default',filter:{tier:0,status:false,grades:['rare','legendary']},onQuery:()=>{},onSort:()=>{},onFilter:()=>{},onReset:()=>{},onClose:()=>{},returnFocus:{current:null}}));assert.match(html,/aria-label="가방 필터"/);assert.match(html,/아이템 검색/);assert.match(html,/티어 필터/);assert.match(html,/장착 중/);assert.match(html,/초기화/);assert.match(html,/완료/);assert.equal((html.match(/aria-pressed="true"/g)??[]).length,2);});
