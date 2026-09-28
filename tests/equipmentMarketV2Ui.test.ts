import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const panel=readFileSync(new URL('../src/components/market/EquipmentMarketPanel.tsx',import.meta.url),'utf8');
const server=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/market.ts',import.meta.url),'utf8');

test('V2 MARKET UI 01: equipment category uses dedicated fixed-price panel',()=>{
 assert.match(server,/EquipmentMarketPanel/);
 assert.match(server,/category==='equipment'/);
 assert.match(panel,/즉시 구매/);
 assert.match(panel,/판매 등록/);
 assert.match(panel,/입찰 없음/);
 assert.doesNotMatch(panel,/placeBid|bidPrice|bidAmount|입찰하기/);
});

test('V2 MARKET UI 02: buy list supports kind grade and enhancement filters',()=>{
 assert.match(panel,/kindFilter/);
 assert.match(panel,/gradeFilter/);
 assert.match(panel,/enhancementFilter/);
 assert.match(panel,/EQUIPMENT_DEFINITIONS/);
 assert.match(panel,/EQUIPMENT_GRADES/);
});

test('V2 MARKET UI 03: sell form shows registration fee, seller fee and expected proceeds',()=>{
 assert.match(panel,/등록 수수료/);
 assert.match(panel,/판매 수수료/);
 assert.match(panel,/예상 정산/);
 assert.match(panel,/registrationFee/);
 assert.match(panel,/sellerFee/);
});

test('V2 MARKET UI 04: owned equipment listing excludes starter and marks equipped items unavailable',()=>{
 assert.match(panel,/starter-v2/);
 assert.match(panel,/Object\.values\(game\.equipped\)/);
 assert.match(panel,/장착 해제/);
});

test('V2 MARKET UI 05: online market client exposes list buy cancel and V2 state models',()=>{
 for(const name of ['listOnlineEquipment','buyOnlineEquipmentListing','cancelOnlineEquipmentListing'])assert.match(online,new RegExp(name));
 assert.match(online,/equipmentListings/);
 assert.match(online,/equipmentTrades/);
 assert.match(online,/equipment_v2:/);
});
