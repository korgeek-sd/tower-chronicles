import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
const service=readFileSync(new URL('../src/game/market/marketService.ts',import.meta.url),'utf8');

test('V2 MARKET UNIFIED 01: equipment tab no longer routes to a separate market panel',()=>{
 assert.doesNotMatch(server,/EquipmentMarketPanel/);
 assert.doesNotMatch(server,/category==='equipment'\?\s*<EquipmentMarketPanel/);
});

test('V2 MARKET UNIFIED 02: V2 equipment uses the same market card classes as all materials and other items',()=>{
 assert.match(server,/tc-market-v2-row tc-market-v3-card tc-market-v4-card/);
 assert.match(server,/equipmentBrowseRows/);
 assert.match(server,/combinedCatalog/);
});

test('V2 MARKET UNIFIED 03: owned V2 equipment is part of the normal market catalog',()=>{
 assert.match(service,/s\.equipmentItems/);
 assert.match(service,/equipment_v2:/);
 assert.match(service,/equipmentItemName/);
});

test('V2 MARKET UNIFIED 04: open equipment listings are merged into all and equipment category browsing',()=>{
 assert.match(server,/snapshot\.equipmentListings/);
 assert.match(server,/categoryMatch\(entry\.category,category\)/);
 assert.match(server,/marketKey/);
 assert.match(server,/bestListing/);
});

test('V2 MARKET UNIFIED 05: equipment detail keeps fixed-price immediate buy and fixed-price sell registration',()=>{
 assert.match(server,/buyOnlineEquipmentListing/);
 assert.match(server,/listOnlineEquipment/);
 assert.match(server,/즉시 구매/);
 assert.match(server,/판매 등록/);
 assert.doesNotMatch(server,/입찰하기|placeBid|bidAmount/);
});
