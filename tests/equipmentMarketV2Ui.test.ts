import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/market.ts',import.meta.url),'utf8');

test('V2 MARKET UI 01: equipment uses the exact same live order-book detail UI',()=>{
 assert.match(server,/tc-market-v2-book tc-market-v4-book/);
 assert.match(server,/실시간 주문장/);
 assert.match(server,/BUY · 매수/);
 assert.match(server,/SELL · 매도/);
 assert.doesNotMatch(server,/즉시 구매|정가 판매 · 72시간|등록 수수료|판매 수수료 5%/);
});

test('V2 MARKET UI 02: equipment orders use generic placeOnlineMarketOrder',()=>{
 assert.match(server,/placeOnlineMarketOrder\(lease/);
 assert.match(server,/assetItemId:equipmentSell/);
 assert.doesNotMatch(server,/buyOnlineEquipmentListing|listOnlineEquipment|cancelOnlineEquipmentListing/);
});

test('V2 MARKET UI 03: one exact equipment instance is selected for a SELL order',()=>{
 assert.match(server,/equipmentSell/);
 assert.match(server,/item\.equipmentIds\?\.\[0\]/);
 assert.match(server,/equipmentSell\?1:q/);
});

test('V2 MARKET UI 04: online order and storage gear types support V2 equipment',()=>{
 assert.match(online,/OnlineMarketGear/);
 assert.match(online,/gear:OnlineMarketGear\|null/);
 assert.match(online,/assetItemId\?:string/);
});

test('V2 MARKET UI 05: equipment no longer depends on fixed-price equipment listing state',()=>{
 assert.doesNotMatch(server,/equipmentListings|equipmentTrades|bestListing|listingCount|equipmentMarketKey/);
});
