import test from 'node:test';
import assert from 'node:assert/strict';
import {GOLD_SHOP_PACKAGES,getGoldPackageBySku} from '../src/shop/catalog.ts';

test('GOLD SHOP 01: v1 exposes exactly six paid Gold packages',()=>{
 assert.equal(GOLD_SHOP_PACKAGES.length,6);
 assert.deepEqual(GOLD_SHOP_PACKAGES.map(p=>p.gold),[1000,3100,7000,13800,24500,42000]);
 assert.deepEqual(GOLD_SHOP_PACKAGES.map(p=>p.priceKrw),[1500,4500,9900,19000,33000,55000]);
});

test('GOLD SHOP 02: catalog contains paid Gold only and no gameplay items',()=>{
 for(const item of GOLD_SHOP_PACKAGES){
  assert.equal(item.kind,'gold');
  assert.ok(item.sku.startsWith('gold_'));
  assert.ok(!('itemId' in item));
  assert.ok(!('silver' in item));
 }
});

test('GOLD SHOP 03: sku lookup returns the canonical package and rejects unknown sku',()=>{
 assert.equal(getGoldPackageBySku('gold_7000')?.gold,7000);
 assert.equal(getGoldPackageBySku('missing'),null);
});

test('GOLD SHOP 04: v1 does not grant Gold locally',()=>{
 for(const item of GOLD_SHOP_PACKAGES)assert.equal(item.purchaseState,'billing_not_connected');
});
