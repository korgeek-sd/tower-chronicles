import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {currentMarketCatalog} from '../src/game/market/marketService.ts';
test('current market contains 45 equipment products, four supported stacks and all skillbooks',()=>{
 const s=initialState();s.lootItems.split_stone=12;s.lootItems.enhancement_stone=9;
 const catalog=currentMarketCatalog(s);
 assert.equal(catalog.filter(item=>item.modernEquipment).length,45);
 assert.deepEqual(catalog.filter(item=>!item.modernEquipment&&item.category!=='skillbooks').map(item=>item.id).sort(),['material:leather:1','material:ore:1','other:job_draw_ticket','other:split_stone']);
 assert.equal(catalog.filter(item=>item.category==='skillbooks').length,80);
 const stone=catalog.find(item=>item.id==='other:split_stone')!;
 assert.equal(stone.name,'분해석');assert.equal(stone.category,'materials');assert.equal(stone.available,12);
});
