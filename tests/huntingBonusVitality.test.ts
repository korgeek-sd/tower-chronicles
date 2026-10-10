import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialHuntingState,recoverVitality,resolveHunt,VITALITY_CAP,VITALITY_INTERVAL} from '../src/game/hunting/model';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
test('extra vitality survives repeated refresh and is spent normally',()=>{
 const now=1710000000000;
 const extra={...initialHuntingState(now),vitality:1000};
 for(const elapsed of [0,1000,VITALITY_INTERVAL,2*VITALITY_INTERVAL,10000000]){
   const refreshed=recoverVitality(extra,now+elapsed);
   assert.equal(refreshed.vitality,1000);
   assert.ok(refreshed.recoveredAt>=now);
 }
 const fight=resolveHunt(extra,'plains',{hp:180,attack:10000,defense:100},['heavy'],now,()=>.01);
 assert.equal(fight.state.vitality,999);
 assert.equal(recoverVitality(fight.state,now+VITALITY_INTERVAL).vitality,999);
});
test('natural recharge remains capped at 100 and resumes after bonus spent',()=>{
 const now=1710000000000;
 assert.equal(VITALITY_CAP,100);
 assert.equal(recoverVitality({...initialHuntingState(now),vitality:0},now+200*VITALITY_INTERVAL).vitality,100);
 assert.equal(recoverVitality({...initialHuntingState(now),vitality:99},now+VITALITY_INTERVAL).vitality,100);
 assert.equal(recoverVitality({...initialHuntingState(now),vitality:100},now+VITALITY_INTERVAL).vitality,100);
 assert.equal(recoverVitality({...initialHuntingState(now),vitality:101},now+VITALITY_INTERVAL).vitality,101);
});
test('hunting screen shows four-digit bonus stock but progress stays within accessible 100 scale',()=>{
 const now=1710000000000;
 const hunting={...initialHuntingState(now),vitality:1000};
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting,now,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.match(html,/활력 <b>1,000<\/b>/);
 assert.match(html,/추가 지급 활력 사용 중/);
 assert.match(html,/aria-label="활력"[^>]*aria-valuemax="100"[^>]*aria-valuenow="100"/);
 assert.doesNotMatch(html,/width:1000%/);
});
