import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuildAuctionPanel} from '../src/components/association/GuildAuctionPanel';
import type {GameplayLease} from '../src/online/gameSession';

const panel=readFileSync(new URL('../src/components/association/GuildAuctionPanel.tsx',import.meta.url),'utf8');
const theme=readFileSync(new URL('../src/components/association/guildAuctionReference.css',import.meta.url),'utf8');
const art=readFileSync(new URL('../src/components/association/auctionReferenceScene.svg',import.meta.url),'utf8');
const association=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');

test('reference auction shows the correct game title, header, guide and server contribution balance while loading',()=>{
 const lease={leaseId:'test',generation:1,expiresAt:'',clientInstanceId:'test'} as GameplayLease;
 const html=renderToStaticMarkup(React.createElement(GuildAuctionPanel,{lease,associationId:'test',expedition:false,onChanged:()=>{},onRecord:()=>{},onBack:()=>{}}));
 for(const label of ['탑의 기록','원정단 경매장','원정단원이 함께 이용하는 전용 경매장입니다.','사용 가능 공헌도','뒤로']){
  assert.ok(html.includes(label),label);
 }
 assert.match(html,/tc-ga-banner-art/);
 assert.match(html,/tc-ga-guide/);
 assert.match(html,/tc-ga-v3/);
 assert.match(html,/경매 정보를 불러오는 중입니다/);
});

test('reference auction renders five category buttons, bold featured bidding and each-row bid button',()=>{
 for(const label of ["['all','전체'","['gear','장비'","['material','재료'","['consumable','소모품'","['rare','희귀품'"]){
  assert.ok(panel.includes(label),label);
 }
 assert.match(panel,/★ 특급 경매 아이템/);
 assert.match(panel,/tc-ga-feature-bid/);
 assert.match(panel,/tc-ga-row-main/);
 assert.match(panel,/tc-ga-row-bid/);
 assert.match(panel,/tc-ga-row-time/);
 assert.match(panel,/남은 시간순/);
 assert.match(panel,/최고 입찰순/);
 assert.match(panel,/낮은 가격순/);
 assert.match(panel,/낙찰 내역/);
 assert.match(panel,/setInterval\(\(\)=>setClock\(Date\.now\(\)\),1000\)/);
});

test('reference auction shows only server-sourced active listing prices and does not fabricate bidder totals',()=>{
 assert.match(panel,/featured\.topBid\|\|featured\.startingBid/);
 assert.match(panel,/l\.topBid\|\|l\.startingBid/);
 assert.match(panel,/l\.topUserId\?'● 입찰 진행':'입찰 전'/);
 assert.match(panel,/l\.status==='OPEN'/);
 assert.match(panel,/getGuildAuctionState/);
 assert.match(panel,/bidGuildAuction/);
 assert.match(panel,/claimGuildAuctionItem/);
 assert.match(panel,/recoverGuildMaterialAuction/);
 assert.match(panel,/gradePriority\[l\.gear\.grade\]>=2/);
 assert.doesNotMatch(panel,/98,000,000|240,000,000|320,000,000/);
});

test('gold fantasy reference artwork is locally bundled and does not replace live interface interactions',()=>{
 assert.match(art,/<svg/);
 assert.match(art,/id="moon"/);
 assert.match(art,/id="redcloth"/);
 assert.match(art,/id="tower"/);
 assert.match(theme,/auctionReferenceScene\.svg/);
 assert.match(theme,/\.tc-ga-v3 \.tc-ga-row-bid/);
 assert.match(theme,/\.tc-ga-v3 \.tc-ga-bottom-tabs/);
 assert.match(theme,/overflow-y:auto!important/);
 assert.match(theme,/@media\(max-width:350px\)/);
 assert.match(association,/import '\.\/guildAuctionReference\.css'/);
 assert.match(association,/tc-auction-immersive/);
});
