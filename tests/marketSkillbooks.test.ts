import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';
import {currentMarketCatalog,marketItemIdForInventory,placeOrder,marketItemName} from '../src/game/market/marketService';
import {SKILL_BOOKS} from '../src/game/skills/books';
import {inventoryView} from '../src/game/inventoryView';

const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('all 80 skillbooks are listed even without ownership or sell orders',()=>{
 const game=initialState(),catalog=currentMarketCatalog(game).filter(item=>item.category==='skillbooks');
 assert.equal(SKILL_BOOKS.length,80);assert.equal(catalog.length,80);
 for(const book of SKILL_BOOKS){
  const item=catalog.find(x=>x.id===book.itemId);
  assert.ok(item,book.itemId);
  assert.equal(item.name,book.name);
  assert.equal(item.available,0);
  assert.equal(item.skillBookGrade,book.grade);
 }
});
test('owned books retain stable trade id and available amount across inventory and market',()=>{
 const game=initialState(),book=SKILL_BOOKS[0];
 game.skillBooks[book.skillId]=4;
 assert.equal(currentMarketCatalog(game).find(x=>x.id===book.itemId)?.available,4);
 const inventory=inventoryView(game).find(x=>x.category==='skillbooks'&&x.sourceId===book.skillId);
 assert.ok(inventory);
 assert.equal(marketItemIdForInventory(game,inventory),book.itemId);
 assert.equal(marketItemName(game,book.itemId),book.name);
 const listed=placeOrder(game,{itemId:book.itemId,side:'SELL',limitPrice:100,quantity:2});
 assert.equal(listed.skillBooks[book.skillId],2);
});
test('server and local screens filter skillbooks separately from miscellaneous goods',()=>{
 for(const path of ['src/components/market/MarketScreen.tsx','src/components/market/ServerMarketScreen.tsx']){
  const s=source(path);
  assert.ok(s.includes("['skillbooks','스킬북']"));
  assert.ok(s.includes("['tickets','other'].includes(entryCategory)"));
  assert.ok(!s.includes("['skillbooks','tickets','other'].includes(entryCategory)"));
  assert.ok(s.includes('entry.skillBookGrade'));
 }
 assert.ok(source('src/mobile-game.css').includes('.tc-market-v4-cats{grid-template-columns:repeat(5,minmax(0,1fr))}'));
});
