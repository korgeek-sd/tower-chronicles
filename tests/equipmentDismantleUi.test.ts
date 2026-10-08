import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const inventory=readFileSync(new URL('../src/components/inventory/InventoryScreen.tsx',import.meta.url),'utf8');
const detail=readFileSync(new URL('../src/components/inventory/InventoryDetailSheet.tsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const economy=readFileSync(new URL('../src/online/economy.ts',import.meta.url),'utf8');

test('DISMANTLE UI 01: inventory receives online lease and uses authoritative dismantle RPC when available',()=>{
 assert.match(main,/InventoryScreen[\s\S]*onlineLease=/);
 assert.match(inventory,/dismantleOnlineEquipment/);
 assert.match(inventory,/applyServerEconomyRecord/);
});

test('DISMANTLE UI 02: equipment details expose a destructive two-step dismantle action with expected stone yield',()=>{
 assert.match(detail,/dangerAction/);
 assert.match(detail,/dangerLabel/);
 assert.match(detail,/confirm/i);
 assert.match(inventory,/분해석/);
 assert.match(inventory,/equipmentDismantleYield/);
});

test('DISMANTLE UI 03: starter equipped and expedition states disable dismantling in the client',()=>{
 assert.match(inventory,/V2_STARTER_EQUIPMENT_ID/);
 assert.match(inventory,/item\.equipped/);
 assert.match(inventory,/game\.expedition/);
});

test('DISMANTLE UI 04: online economy maps dismantle server failures to Korean messages',()=>{
 for(const key of ['DISMANTLE_ITEM_NOT_FOUND','DISMANTLE_STARTER_PROTECTED','DISMANTLE_EQUIPPED','DISMANTLE_EXPEDITION_BLOCKED']){
  assert.match(economy,new RegExp(key));
 }
});
