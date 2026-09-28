import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/market.ts',import.meta.url),'utf8');

test('V2 MARKET UI 01: equipment category shares the same list and card UI as other categories',()=>{
 assert.doesNotMatch(server,/EquipmentMarketPanel/);
 assert.match(server,/combinedCatalog/);
 assert.match(server,/tc-market-v2-list tc-market-v3-list tc-market-v4-list/);
 assert.match(server,/tc-market-v2-row tc-market-v3-card tc-market-v4-card/);
});

test('V2 MARKET UI 02: owned and listed equipment are merged into normal browsing',()=>{
 assert.match(server,/equipmentBrowseRows/);
 assert.match(server,/snapshot\.equipmentListings/);
 assert.match(server,/view\.equipmentItems/);
 assert.match(server,/listingCount/);
 assert.match(server,/bestListing/);
});

test('V2 MARKET UI 03: equipment fixed-price detail shows instant buy and sell fee preview',()=>{
 assert.match(server,/즉시 구매/);
 assert.match(server,/판매 등록/);
 assert.match(server,/등록 수수료/);
 assert.match(server,/판매 수수료 5%/);
 assert.match(server,/예상 정산/);
 assert.doesNotMatch(server,/입찰하기|placeBid|bidAmount/);
});

test('V2 MARKET UI 04: starter and equipped equipment are excluded from sellable availability',()=>{
 assert.match(server,/V2_STARTER_EQUIPMENT_ID/);
 assert.match(server,/Object\.values\(view\.equipped\)/);
 assert.match(server,/sellItemId/);
});

test('V2 MARKET UI 05: online market client exposes list buy cancel and V2 state models',()=>{
 for(const name of ['listOnlineEquipment','buyOnlineEquipmentListing','cancelOnlineEquipmentListing'])assert.match(online,new RegExp(name));
 assert.match(online,/equipmentListings/);
 assert.match(online,/equipmentTrades/);
 assert.match(online,/equipment_v2:/);
});
