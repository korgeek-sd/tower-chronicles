import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {BankScreen} from '../src/components/bank/BankScreen';
test('server banking never offers guest/local transactions',()=>{
 const html=renderToStaticMarkup(React.createElement(BankScreen,{userId:null,lease:null,onPrepare:async()=>{},onPending:()=>{},onRecord:()=>{}} as any));
 assert.match(html,/Google 로그인/);assert.doesNotMatch(html,/<input|은행 설립 확정/);
});

test('bank comparison sorts rates, marks selection and blocks own bank',async()=>{
 const {BankDirectory}=await import('../src/components/bank/BankScreen');
 const html=renderToStaticMarkup(React.createElement(BankDirectory,{banks:[{id:'own',name:'내 은행',rate:9,vault:100000,durations:[5],isMine:true},{id:'low',name:'낮은 은행',rate:3,vault:50000,durations:[10],isMine:false}],selectedId:'low',onSelect:()=>{},principal:50000,sort:'rate',availableOnly:false}));
 assert.ok(html.indexOf('낮은 은행')<html.indexOf('내 은행'));
 assert.match(html,/aria-pressed="true"/);
 assert.match(html,/disabled=""/);
 assert.match(html,/금고/);
});
