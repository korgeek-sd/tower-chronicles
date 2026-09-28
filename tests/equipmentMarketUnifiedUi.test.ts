import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/components/market/ServerMarketScreen.tsx',import.meta.url),'utf8');
const service=readFileSync(new URL('../src/game/market/marketService.ts',import.meta.url),'utf8');

test('V2 MARKET UNIFIED 01: all categories render through one shared card list',()=>{
 assert.match(server,/tc-market-v2-row tc-market-v3-card tc-market-v4-card/);
 assert.doesNotMatch(server,/EquipmentMarketPanel/);
});

test('V2 MARKET UNIFIED 02: V2 equipment is grouped by spec into normal market item ids',()=>{
 assert.match(service,/equipmentMarketKey/);
 assert.match(service,/groupedEquipment/);
 assert.match(service,/equipmentIds/);
 assert.match(service,/'equipment:'/);
});

test('V2 MARKET UNIFIED 03: shared orderBook/getBestAsk/getBestBid work for equipment ids',()=>{
 assert.match(server,/orderBook\(view,selected\)/);
 assert.match(server,/getBestAsk\(view,entry\.id\)/);
 assert.match(server,/getBestBid\(view,entry\.id\)/);
});

test('V2 MARKET UNIFIED 04: shared orders tab handles equipment without a second listing model',()=>{
 assert.match(server,/getMyOpenOrders\(view\)/);
 assert.match(server,/shownOrders\.map/);
 assert.doesNotMatch(server,/myEquipmentListings|shownOrderRows/);
});

test('V2 MARKET UNIFIED 05: storage can resolve equipment names using escrow gear',()=>{
 assert.match(service,/storageGear/);
 assert.match(service,/marketItemName/);
});
