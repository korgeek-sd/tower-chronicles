import test from 'node:test';
import assert from 'node:assert/strict';
import {associationDonationGain,associationPeriodStart,associationLevelProgress} from '../src/game/association/growthRules';
import {initialState} from '../src/game/engine/state';
import {inventoryView} from '../src/game/inventoryView';
import {marketItems} from '../src/game/market/marketService';

test('donations use the agreed exchange and reject partial or invalid units',()=>{
 assert.equal(associationDonationGain('silver',10000),100);
 assert.equal(associationDonationGain('gold',100),200);
 for(const amount of [0,-100,NaN,Infinity,100.5,101])assert.throws(()=>associationDonationGain('gold',amount));
 assert.throws(()=>associationDonationGain('silver',9999));
});
test('daily and weekly limits reset at Korean midnight and Monday',()=>{
 assert.equal(associationPeriodStart('DAILY',Date.parse('2026-10-01T14:59:59Z')),'2026-10-01');
 assert.equal(associationPeriodStart('DAILY',Date.parse('2026-10-01T15:00:00Z')),'2026-10-02');
 assert.equal(associationPeriodStart('WEEKLY',Date.parse('2026-10-04T14:59:59Z')),'2026-09-28');
 assert.equal(associationPeriodStart('WEEKLY',Date.parse('2026-10-04T15:00:00Z')),'2026-10-05');
});
test('level progress uses experience within the current level and caps at ten',()=>{
 assert.deepEqual(associationLevelProgress(1000),{level:2,startExp:1000,nextExp:5000,percent:0});
 assert.equal(associationLevelProgress(3000).percent,50);
 assert.deepEqual(associationLevelProgress(2000000),{level:10,startExp:1000000,nextExp:1000000,percent:100});
});
test('shop draw tickets have a player-facing name in inventory and market',()=>{
 const game=initialState();game.lootItems.job_draw_ticket=5;
 assert.equal(inventoryView(game).find(item=>item.sourceId==='job_draw_ticket')?.name,'직능 뽑기권');
 assert.equal(marketItems(game).find(item=>item.id==='other:job_draw_ticket')?.name,'직능 뽑기권');
});
