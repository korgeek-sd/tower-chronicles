import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {BankScreen} from '../src/components/bank/BankScreen';
test('server banking never offers guest/local transactions',()=>{
 const html=renderToStaticMarkup(React.createElement(BankScreen,{userId:null,lease:null,onPrepare:async()=>{},onPending:()=>{},onRecord:()=>{}} as any));
 assert.match(html,/Google 로그인/);assert.doesNotMatch(html,/<input|은행 설립 확정/);
});
