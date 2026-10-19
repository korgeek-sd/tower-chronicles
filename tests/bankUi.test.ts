import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BankScreen} from '../src/components/bank/BankScreen';

test('게스트 은행 화면은 서버 거래를 제공하지 않는다',()=>{
 const html=renderToStaticMarkup(React.createElement(BankScreen));
 assert.match(html,/Google 로그인/);
 assert.doesNotMatch(html,/<(?:button|input|form|select)\b/);
});

import {PremiumDialog} from '../src/components/PremiumDialog';
import {initialState} from '../src/game/engine/state';
test('온라인 계정은 lease가 없어도 로컬 프리미엄을 표시하거나 구매하지 않는다',()=>{
 const game=initialState();game.market.gold=1000;game.goldenRecorder={expiresAt:Date.now()+86400000};
 const html=renderToStaticMarkup(React.createElement(PremiumDialog,{
  game,lease:null,onlineAccount:true,onClose:()=>{},onRecord:()=>{},onPrepare:async()=>{},onPending:()=>{},
 }));
 assert.match(html,/계정 확인 중/);
 assert.doesNotMatch(html,/<b>이용 중<\/b>/);
 assert.match(html,/<button[^>]*disabled[^>]*>1,000골드로 30일 활성화/);
 assert.match(html,/온라인 은행 설립/);
});
