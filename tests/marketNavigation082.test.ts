import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const inventory=read('src/components/inventory/InventoryScreen.tsx');
const detail=read('src/components/inventory/InventoryDetailSheet.tsx');
const main=read('src/main.tsx');
const market=read('src/components/market/MarketScreen.tsx');
const server=read('src/components/market/ServerMarketScreen.tsx');
const service=read('src/game/market/marketService.ts');
const css=read('src/mobile-game.css');

test('MARKET LINK 0.1.82 01: inventory resolves exact shared order-book ids',()=>{
 assert.match(service,/marketItemIdForInventory/);
 assert.match(service,/marketItemIdForEquipment/);
 assert.match(service,/return item\.id===V2_STARTER_EQUIPMENT_ID\?null:equipmentMarketKey\(item\)/);
 assert.match(service,/return marketItemIdForEquipment\(gear\)/);
 assert.match(service,/'material':'ticket'/);
 assert.match(service,/'skillbook:'\+item\.sourceId/);
 assert.match(inventory,/시세 · 거래/);
 assert.match(inventory,/거래 불가/);
});

test('MARKET LINK 0.1.82 02: app passes item navigation intent from inventory to market',()=>{
 assert.match(inventory,/onMarket\?:\(intent:MarketIntent\)=>void/);
 assert.match(inventory,/inventoryKey:item\.key/);
 assert.match(main,/openMarketFromInventory/);
 assert.match(main,/intent=\{marketIntent\}/);
 assert.match(main,/onReturnToInventory=\{returnToInventory\}/);
});

test('MARKET LINK 0.1.82 03: local and online market open exact detail and restore inventory detail',()=>{
 assert.match(market,/setSelected\(intent\.itemId\)/);
 assert.match(server,/setSelected\(intent\.itemId\)/);
 assert.match(server,/setDemoMode\(false\)/);
 assert.match(market,/returnInventoryKey\?'‹ 아이템':returnEnhancementId\?'‹ 강화':'시장'/);
 assert.match(server,/returnInventoryKey\?'‹ 아이템':returnEnhancementId\?'‹ 강화':'시장'/);
 assert.match(main,/initialSelected=\{inventoryReturnKey\}/);
});

test('MARKET LINK 0.1.82 04: detail market action is touch-safe on narrow phones',()=>{
 assert.match(detail,/tc-item-market/);
 assert.match(detail,/marketDisabled/);
 const section=css.slice(css.indexOf('/* v0.1.82 — INVENTORY → MARKET DEEP LINK'));
 assert.match(section,/@media\(max-width:380px\)/);
 assert.match(section,/grid-auto-rows:44px/);
 assert.match(section,/min-height:44px/);
 assert.equal(/url\s*\(/i.test(section),false);
});
