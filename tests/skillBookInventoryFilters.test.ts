import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialState} from '../src/game/engine/state';
import {unifiedInventoryView,LIFE_INVENTORY_CATEGORIES} from '../src/game/life/inventory';
import {selectInventory,inventoryView} from '../src/game/inventoryView';
import {currentMarketCatalog,marketItemIdForInventory} from '../src/game/market/marketService';
import {SKILL_BOOKS} from '../src/game/skills/books';
import {GRADES} from '../src/game/skills/catalog';
import {MarketGradeFilters,marketGradeMatches} from '../src/components/market/MarketGradeFilters';
import {InventoryItemArt,InventoryStackCount} from '../src/components/inventory/InventoryDetailSheet';

test('retired books are absent from current inventory without deleting saved ownership',()=>{
 const game=initialState();for(const book of SKILL_BOOKS)game.skillBooks[book.skillId]=3;
 const before=JSON.stringify(game);
 assert.ok(!LIFE_INVENTORY_CATEGORIES.includes('skillbooks'));
 assert.equal(selectInventory(unifiedInventoryView(game,null),'skillbooks').length,0);
 assert.equal(JSON.stringify(game),before);
});
test('a single skillbook still shows its owned count',()=>{
 const game=initialState();game.skillBooks[SKILL_BOOKS[0].skillId]=1;
 const item=selectInventory(inventoryView(game),'skillbooks')[0];
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
 assert.match(html,/aria-pressed="true"[^>]*>[^]*?SR</);
 assert.equal(marketGradeMatches({category:'equipment',gear:{grade:'rare'}},'rare'),true);
 assert.equal(marketGradeMatches({category:'equipment',gear:{grade:'rare'}},'SSR'),false);
});
