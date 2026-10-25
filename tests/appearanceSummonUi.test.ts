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
 assert.match(footer,/외형 소환권/);assert.match(footer,/23장/);assert.match(footer,/1회 소환/);assert.match(footer,/10회 소환/);assert.doesNotMatch(footer,/소환권 사용/);
 assert.equal((footer.match(/disabled=""/g)??[]).length,2);
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
 assert.equal((html.match(/disabled=""/g)??[]).length,2);
});

test('online summon automatically spends tickets before gold, without mutating balances',()=>{
 const game=initialState();game.market.gold=3100;game.cosmetics.summonTickets=2;
 const before=JSON.stringify(game);
 const lease={leaseId:'11111111-1111-4111-8111-111111111111',generation:1,clientInstanceId:'device-test',expiresAt:new Date().toISOString()};
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,userId:'test-user',lease,onList:()=>{},onRecord:()=>{}}));
 const footer=html.slice(html.indexOf('<footer class="tc-summon-footer"'));
 assert.equal((footer.match(/disabled=""/g)??[]).length,0);
 assert.match(footer,/1회 소환<\/strong><small>소환권 1장/);
 assert.match(footer,/10회 소환<\/strong><small>소환권 2장 \+ 2,160 G/);
 assert.doesNotMatch(footer,/소환권 사용/);
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

test('automatic ticket-first payment keeps ten-pull discount for only the gold-funded draws',async()=>{
 const {appearanceSummonPayment}=await import('../src/game/data/appearanceSummonPricing.ts');
 assert.deepEqual(appearanceSummonPayment(1,0),{ticketsUsed:0,goldSpent:300});
 assert.deepEqual(appearanceSummonPayment(1,3),{ticketsUsed:1,goldSpent:0});
 assert.deepEqual(appearanceSummonPayment(10,0),{ticketsUsed:0,goldSpent:2700});
 assert.deepEqual(appearanceSummonPayment(10,2),{ticketsUsed:2,goldSpent:2160});
 assert.deepEqual(appearanceSummonPayment(10,9),{ticketsUsed:9,goldSpent:270});
 assert.deepEqual(appearanceSummonPayment(10,10),{ticketsUsed:10,goldSpent:0});
 assert.deepEqual(appearanceSummonPayment(10,14),{ticketsUsed:10,goldSpent:0});
});

test('single and ten-pull buttons stay usable with tickets even when gold is zero',()=>{
 const game=initialState();game.market.gold=0;game.cosmetics.summonTickets=10;
 const lease={leaseId:'11111111-1111-4111-8111-111111111111',generation:1,clientInstanceId:'device-test',expiresAt:new Date().toISOString()};
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonScreen,{game,userId:'test-user',lease,onList:()=>{}}));
 const buttons=html.slice(html.indexOf('class="tc-summon-actions"'),html.indexOf('class="tc-summon-status"'));
 assert.equal((buttons.match(/disabled=""/g)??[]).length,0);
 assert.match(buttons,/10회 소환<\/strong><small>소환권 10장/);
 assert.doesNotMatch(buttons,/소환권 사용/);
});

test('ticket-first server migration uses canonical ticket wallet and records both currency amounts',()=>{
 const sql=readFileSync('supabase/migrations/20261025153000_appearance_ticket_priority.sql','utf8');
 for(const required of [
  'private.appearance_ticket_wallets','private.player_wallets',
  'tickets_spent','gold_spent','appearance_payment',
  'SUMMON_GOLD_INSUFFICIENT','SUMMON_REQUEST_CONFLICT','private.persist_market_economy_to_save',
 ])assert.ok(sql.includes(required),required);
 assert.ok(!sql.includes('pity_count'));
});

test('single summon result shows the official full sprite and repeat/equip actions',async()=>{
 const {AppearanceSummonResultView}=await import('../src/components/appearance/AppearanceSummonScreen.tsx');
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{
  draws:[{id:'valkyrie',rarity:'A',duplicate:false}],
  payment:{ticketsSpent:1,goldSpent:0},repeatPayment:{ticketsUsed:0,goldSpent:300},
  canRepeat:true,busy:false,selectedAppearanceId:'default',expedition:false,
  onRepeat:()=>{},onClose:()=>{},onList:()=>{},onEquip:()=>{},
 }));
 assert.match(html,/tc-summon-single-stage/);
 assert.match(html,/valkyrie-a22cd8cc46a8\.webp/);
 assert.match(html,/1회 다시 소환/);
 assert.match(html,/300 G/);
 assert.match(html,/전용 조각 ×1/);
 assert.match(html,/해금 후 착용/);
 assert.match(html,/외형 목록/);
});

test('ten summon result is a 2-column ten-card grid with real character sprites and fixed repeat footer',async()=>{
 const {AppearanceSummonResultView}=await import('../src/components/appearance/AppearanceSummonScreen.tsx');
 const draws=[
  {id:'scout',rarity:'C',duplicate:false},
  {id:'cultist',rarity:'B',duplicate:false},
  {id:'ice_mage',rarity:'C',duplicate:true},
  {id:'skeleton_knight',rarity:'C',duplicate:true},
  {id:'musketeer',rarity:'C',duplicate:true},
  {id:'summoner',rarity:'B',duplicate:false},
  {id:'plague_doctor',rarity:'B',duplicate:false},
  {id:'butcher',rarity:'C',duplicate:false},
  {id:'valkyrie',rarity:'A',duplicate:false},
  {id:'baal',rarity:'SSR',duplicate:false},
 ] as const;
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{
  draws:[...draws],payment:{ticketsSpent:10,goldSpent:0},repeatPayment:{ticketsUsed:3,goldSpent:1890},
  canRepeat:true,busy:false,selectedAppearanceId:'default',expedition:false,
  onRepeat:()=>{},onClose:()=>{},onList:()=>{},onEquip:()=>{},
 }));
 assert.match(html,/tc-summon-result-grid/);
 assert.equal((html.match(/class="tc-summon-draw-card /g)??[]).length,10);
 assert.match(html,/scout-[a-z0-9]+\.webp/);
 assert.match(html,/baal-d5dd22a83f6c\.webp/);
 assert.match(html,/data-rarity="SSR"/);
 assert.match(html,/전용 조각 10개 획득/);
 // Each draw is guaranteed to give exactly one shard; avoid ten redundant labels.
 assert.doesNotMatch(html,/tc-summon-acquisition/);
 assert.doesNotMatch(html,/전용 조각 1개 상세 보기/);
 assert.match(html,/10회 다시 소환/);
 assert.match(html,/소환권 3장 \+ 1,890 G/);
 assert.match(html,/tc-summon-result-footer/);
 assert.doesNotMatch(html,/외형 소환 완료\. 소환권/);
});

test('repeat button is disabled when server balance cannot cover remaining summons',async()=>{
 const {AppearanceSummonResultView}=await import('../src/components/appearance/AppearanceSummonScreen.tsx');
 const html=renderToStaticMarkup(React.createElement(AppearanceSummonResultView,{
  draws:[{id:'nidhogg',rarity:'SSR',duplicate:false}],
  payment:{ticketsSpent:0,goldSpent:300},repeatPayment:{ticketsUsed:0,goldSpent:300},
  canRepeat:false,busy:false,selectedAppearanceId:'default',expedition:false,
  onRepeat:()=>{},onClose:()=>{},onList:()=>{},onEquip:()=>{},
 }));
 assert.match(html,/nidhogg-b1f245699fec\.webp/);
 assert.match(html,/1회 다시 소환/);
 assert.match(html,/재화 부족/);
 assert.match(html,/disabled=""/);
 assert.match(html,/tc-summon-result-footer/);
 const css=readFileSync('src/components/appearance/altar-summon.css','utf8');
 assert.match(css,/\.tc-summon-result-modal/);
 assert.match(css,/\.tc-summon-result-content/);
 assert.match(css,/\.tc-summon-result-content\{[^}]*overflow:hidden/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('one and ten appearance summon results fit a portrait viewport without inner scrolling',()=>{
 const css=readFileSync('src/components/appearance/altar-summon.css','utf8');
 const view=readFileSync('src/components/appearance/AppearanceSummonResultView.tsx','utf8');
 // The modal owns the height, the grid gets exactly five equal rows,
 // and every card can shrink below its old hard-coded 91–100px minimum.
 assert.match(css,/\.tc-summon-result-modal\{[^}]*height:min\(790px,/);
 assert.match(css,/\.tc-summon-result-content\{[^}]*overflow:hidden/);
 assert.match(css,/\.tc-summon-result-grid\{[^}]*grid-template-rows:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tc-summon-result-grid\{[^}]*height:100%/);
 assert.match(css,/\.tc-summon-draw-card\{[^}]*min-height:0/);
 assert.match(css,/\.tc-summon-draw-art\{[^}]*height:100%/);
 assert.match(css,/\.tc-summon-single-stage\{[^}]*grid-template-rows:auto auto auto minmax\(0,1fr\) auto auto auto/);
 assert.match(css,/\.tc-summon-single-art\{[^}]*height:100%/);
 assert.doesNotMatch(css,/\.tc-summon-result-content\{[^}]*overflow-y:auto/);
 assert.doesNotMatch(css,/\.tc-summon-draw-card\{[^}]*min-height:(?:91|100)px/);
 assert.match(view,/tc-summon-result-content/);
 assert.match(view,/tc-summon-result-footer/);
 assert.match(view,/10회 다시 소환/);
});
