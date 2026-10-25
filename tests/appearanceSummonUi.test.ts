import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {AppearanceSummonScreen} from '../src/components/appearance/AppearanceSummonScreen';
import {initialState} from '../src/game/engine/state';

test('summon showcase has three existing sprites and safe disabled actions for guests',()=>{
 const game=initialState(),before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{}}));
 assert.equal((html.match(/class="tc-summon-figure /g)??[]).length,3);
 assert.ok(html.includes('외형 소환'));
 assert.ok(html.includes('착용 효과'));
 assert.ok(html.includes('1회 소환'));
 assert.ok(html.includes('10회 소환'));
 assert.ok(html.includes('disabled=""'));
 assert.ok(html.includes('온라인 로그인 및 플레이 세션이 필요합니다.'));
 assert.equal(JSON.stringify(game),before);
});
test('summon navigation connects both codex entries and compact viewport layout',()=>{
 const app=readFileSync('src/main.tsx','utf8'),css=readFileSync('src/components/appearance/appearance-summon.css','utf8');
 assert.ok(app.includes('<AppearanceSummonScreen'));
 assert.ok(app.includes('onSummon='));
 assert.ok(css.includes('minmax(0,1fr)'));
 assert.ok(css.includes('prefers-reduced-motion'));
});
test('iron summon footer keeps the real ticket balance and disabled actions with collection navigation',()=>{
 const game=initialState();game.cosmetics.summonTickets=23;const before=JSON.stringify(game);
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{},onCollection:()=>{}}));
 assert.match(html,/tc-iron-summon-screen/);
 const footer=html.slice(html.indexOf('<footer class="tc-summon-footer"'));
 assert.match(footer,/외형 소환권/);assert.match(footer,/23장/);assert.match(footer,/1회 소환/);assert.match(footer,/10회 소환/);assert.match(footer,/소환권 사용/);
 assert.equal((footer.match(/disabled=""/g)??[]).length,3);
 assert.match(footer,/컬렉션/);assert.match(footer,/온라인 로그인 및 플레이 세션이 필요합니다./);
 assert.equal(JSON.stringify(game),before);
});

test('altar layout has a dedicated backdrop and accessible preview navigation',()=>{
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game:initialState(),onList:()=>{}}));
 assert.match(html,/tc-altar-summon-screen/);assert.match(html,/summon-altar-v1.webp/);
 assert.match(html,/aria-label="이전 외형 미리보기"/);assert.match(html,/aria-label="다음 외형 미리보기"/);
});

test('confirmed summon prices are displayed with no guarantee, pity, or shard conversion',()=>{
 const game=initialState();game.market.gold=3100;
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,onList:()=>{}}));
 assert.ok(html.includes('1회 소환</strong><small>300 G</small>'));
 assert.ok(html.includes('10회 소환</strong><small>2,700 G'));
 assert.match(html,/10% 할인/);
 assert.doesNotMatch(html,/확정 지급|천장|외형 조각|조각 전환/);
 assert.equal((html.match(/disabled=""/g)??[]).length>=3,true);
});

test('online summon enables affordable gold and ticket actions, without mutating balances',()=>{
 const game=initialState();game.market.gold=3100;game.cosmetics.summonTickets=2;
 const before=JSON.stringify(game);
 const lease={leaseId:'11111111-1111-4111-8111-111111111111',generation:1,clientInstanceId:'device-test',expiresAt:new Date().toISOString()};
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,userId:'test-user',lease,onList:()=>{},onRecord:()=>{}}));
 const footer=html.slice(html.indexOf('<footer class="tc-summon-footer"'));
 assert.equal((footer.match(/disabled=""/g)??[]).length,0);
 assert.match(footer,/300 G/);
 assert.match(footer,/2,700 G/);
 assert.match(footer,/SSR 0.2%/);
 assert.equal(JSON.stringify(game),before);
});
test('server-owned rates exactly total 10,000 basis points without pity',async()=>{
 const {APPEARANCE_SUMMON_RATES,APPEARANCE_SUMMON_RATE_TOTAL}=await import('../src/game/data/appearanceSummonRates.ts');
 assert.deepEqual(APPEARANCE_SUMMON_RATES.map(item=>[item.rarity,item.basisPoints]),[['C',6000],['B',3000],['A',800],['SR',180],['SSR',20]]);
 assert.equal(APPEARANCE_SUMMON_RATE_TOTAL,10000);
 const sql=readFileSync('supabase/migrations/20261025142000_appearance_summon_server.sql','utf8');
 for(const part of ['bucket<6000','bucket<9000','bucket<9800','bucket<9980','private.appearance_secure_int(10000)','p_request_id','appearance_summon_receipts','private.appearance_authoritative_payload','game_save_authoritative_appearances'])assert.ok(sql.includes(part),part);
 assert.ok(!/pity_count|pity_counter|guaranteed_tier|shard_exchange/.test(sql));
});
