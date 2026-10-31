import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {AppearanceSummonScreen} from '../src/components/appearance/AppearanceSummonScreen';
import {APPEARANCE_SUMMON_RATES} from '../src/game/data/appearanceSummonRates';

test('weekly pickup shares the existing 0.2% SSR rarity chance',()=>{
 assert.equal(APPEARANCE_SUMMON_RATES.find(rate=>rate.rarity==='SSR')?.basisPoints,20);
 assert.equal(APPEARANCE_SUMMON_RATES.reduce((sum,rate)=>sum+rate.basisPoints,0),10000);
 const sql=readFileSync('supabase/migrations/20261031193000_weekly_ssr_pickup.sql','utf8');
 for(const token of ['private.appearance_secure_int(2)=0',"tier='SSR'",'private.weekly_appearance_pickup_id()','Asia/Seoul','get_weekly_appearance_pickup','SUMMON_TICKET_INSUFFICIENT','appearance_summon_receipts'])assert.ok(sql.includes(token),token);
});
test('summon stage shows server weekly pickup rather than unrelated job carousel',()=>{
 const source=readFileSync('src/components/appearance/AppearanceSummonScreen.tsx','utf8');
 assert.match(source,/getWeeklyAppearancePickup\(\)/);
 assert.match(source,/featured\?\.imagePath/);
 assert.doesNotMatch(source,/showcase|setFocus|tc-altar-prev|기존 캐릭터 이미지 미리보기/);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game:initialState(),onList:()=>{}}));
 assert.match(html,/이번 주 SSR 픽업/);
 assert.match(html,/서버 확인 중/);
});
