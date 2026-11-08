import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuildAuctionPanel} from '../src/components/association/GuildAuctionPanel';
import type {GameplayLease} from '../src/online/gameSession';

const source=readFileSync(new URL('../src/components/association/GuildAuctionPanel.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/association/guildAuction.css',import.meta.url),'utf8');

test('guild auction concept one renders a responsive in-game board and loading state',()=>{
 const lease={leaseId:'test',generation:1,expiresAt:'',clientInstanceId:'test'} as GameplayLease;
 const html=renderToStaticMarkup(React.createElement(GuildAuctionPanel,{
  lease,associationId:'demo',expedition:false,onRecord:()=>{},onChanged:()=>{},
 }));
 assert.match(html,/tc-guild-auction tc-ga-v2/);
 assert.match(html,/원정단 경매장/);
 assert.match(html,/사용 가능 공헌도/);
 assert.match(html,/경매 정보를 불러오는 중입니다/);
 assert.match(html,/tc-ga-detail-dialog/);
});

test('auction board presents featured lot, accurate contribution prices, compact rows and sections',()=>{
 for(const required of ['tc-ga-feature','tc-ga-list-entry','tc-ga-categories','tc-ga-sort','tc-ga-bottom-tabs','tc-ga-feature-cta','tc-ga-detail-metrics','getGuildAuctionState','n(state.points)']){
  assert.ok(source.includes(required),required);
 }
 for(const title of ['진행 중','내 입찰','종료 내역','전체','장비','재료','보스 전리품','종료순','높은 입찰','낮은 입찰']){
  assert.ok(source.includes(title),title);
 }
 assert.match(source,/assetUrl\('assets\/ui\/equipment\/'\+lot\.gear\.kind\+'\.png'\)/);
 assert.match(source,/l\.source==='MATERIAL'/);
 assert.match(source,/l\.isMyTopBid/);
 assert.doesNotMatch(source,/현재 최고 입찰가[^<]*골드/);
});

test('auction board retains all original server-authoritative actions and recovery options',()=>{
 for(const method of ['bidGuildAuction','claimGuildBossReward','claimGuildAuctionItem','registerGuildAuctionItem','recoverGuildAuctionItem','relistGuildBossAuctionItem','recoverGuildMaterialAuction']){
  assert.ok(source.includes(method),method);
 }
 assert.match(source,/GuildMaterialAuctionForm/);
 assert.match(source,/tc-guild-auction-bid:/);
 assert.match(source,/tc-guild-auction-register:/);
 assert.match(source,/selected\.isMyListing/);
 assert.match(source,/validBid/);
 assert.match(source,/selected\.canRelist/);
 assert.match(source,/selected\.canReturnMaterial/);
 assert.match(source,/selected\.canCancel/);
});

test('entire guild auction view stays one screen; only auction list scrolls',()=>{
 assert.match(css,/\.tc-guild-workspace>\.tc-guild-auction\.tc-ga-v2\{[\s\S]*?overflow:hidden/);
 assert.match(css,/\.tc-ga-list\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.tc-ga-detail-dialog\[open\]\{display:flex/);
 assert.match(css,/\.tc-ga-detail-dialog::backdrop/);
 assert.match(css,/@media\(max-height:700px\)/);
});
