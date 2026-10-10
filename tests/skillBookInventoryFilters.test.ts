import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES} from '../src/game/life/inventory';
import {selectInventory} from '../src/game/inventoryView';
import {currentMarketCatalog,marketItemIdForInventory} from '../src/game/market/marketService';
import {SKILL_BOOKS} from '../src/game/skills/books';
import {GRADES} from '../src/game/skills/catalog';
import {MarketGradeFilters,marketGradeMatches} from '../src/components/market/MarketGradeFilters';
import {InventoryItemArt,InventoryStackCount} from '../src/components/inventory/InventoryDetailSheet';

test('owned catalog books remain in unified inventory before life data loads',()=>{
 const game=initialState();
 for(const [index,book] of SKILL_BOOKS.entries())game.skillBooks[book.skillId]=index%3?index+1:0;
 game.skillBooks.execute=12;
 assert.ok(LIFE_INVENTORY_CATEGORIES.includes('skillbooks'));
 const before=JSON.stringify(game),books=selectInventory(unifiedInventoryView(game,null),'skillbooks');
 assert.equal(books.length,SKILL_BOOKS.filter((_,index)=>index%3).length);
 for(const item of books){
  assert.equal(item.quantity,game.skillBooks[item.sourceId]);
  assert.equal(marketItemIdForInventory(game,item),'skillbook:'+item.sourceId);
  assert.match(renderToStaticMarkup(React.createElement(InventoryItemArt,{item,slot:true})),/skillbook.jpg/);
 }
 assert.ok(!books.some(item=>item.sourceId==='execute'));
 assert.equal(JSON.stringify(game),before);
});
test('a single skillbook still shows its owned count',()=>{
 const game=initialState();game.skillBooks[SKILL_BOOKS[0].skillId]=1;
 const item=selectInventory(unifiedInventoryView(game,null),'skillbooks')[0];
 assert.match(renderToStaticMarkup(React.createElement(InventoryStackCount,{item})),/>1</);
});
test('skillbook grade filters cover each grade without requiring ownership',()=>{
 const catalog=currentMarketCatalog(initialState()).filter(item=>item.category==='skillbooks');
 assert.equal(catalog.filter(item=>marketGradeMatches(item,'all')).length,80);
 for(const grade of GRADES){
  const filtered=catalog.filter(item=>marketGradeMatches(item,grade));
  assert.equal(filtered.length,SKILL_BOOKS.filter(book=>book.grade===grade).length);
  assert.ok(filtered.every(item=>item.skillBookGrade===grade));
 }
 const html=renderToStaticMarkup(React.createElement(MarketGradeFilters,{category:'skillbooks',value:'SR',onChange:()=>{}}));
 assert.match(html,/스킬북 등급/);
 assert.equal((html.match(/<button/g)??[]).length,7);
 assert.match(html,/aria-pressed="true"[^>]*>SR</);
 assert.equal(marketGradeMatches({category:'equipment',gear:{grade:'rare'}},'rare'),true);
 assert.equal(marketGradeMatches({category:'equipment',gear:{grade:'rare'}},'SSR'),false);
});
