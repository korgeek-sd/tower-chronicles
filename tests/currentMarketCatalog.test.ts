import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {currentMarketCatalog} from '../src/game/market/marketService.ts';
test('current market contains current life materials and all skillbooks',()=>{
 const s=initialState();s.lootItems.split_stone=12;s.lootItems.enhancement_stone=9;s.lootItems.challenge_ticket=3;
 const catalog=currentMarketCatalog(s,{herb:10,pepper:20,potato:30,wheat:40,stone:50});
 assert.equal(catalog.filter(item=>item.modernEquipment).length,45);
 assert.deepEqual(catalog.filter(item=>!item.modernEquipment&&item.category!=='skillbooks').map(item=>item.id).sort(),['material:life:herb','material:life:pepper','material:life:potato','material:life:stone','material:life:wheat','other:challenge_ticket','other:job_draw_ticket']);
 const challenge=catalog.find(item=>item.id==='other:challenge_ticket')!;assert.equal(challenge.name,'점령전 도전권');assert.equal(challenge.available,3);
 assert.equal(catalog.filter(item=>item.category==='skillbooks').length,80);
 const stone=catalog.find(item=>item.id==='material:life:stone')!;
 assert.equal(stone.name,'분해석');assert.equal(stone.category,'materials');assert.equal(stone.available,50);
 assert.equal(catalog.find(item=>item.id==='material:life:herb')?.available,10);
 assert.ok(!catalog.some(item=>['material:ore:1','material:leather:1','other:split_stone'].includes(item.id)));
});
