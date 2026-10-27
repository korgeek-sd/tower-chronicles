import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketLifeProductItemId,MARKET_LIFE_PRODUCT_IDS} from '../src/game/life/marketProducts.ts';
const sql=readFileSync('supabase/migrations/20261027200000_life_consumable_market.sql','utf8');
test('only four crafted consumables are allowed in life product exchange',()=>{
 assert.deepEqual([...MARKET_LIFE_PRODUCT_IDS],['potion','attack_food','defense_food','experience_food']);
 assert.equal(marketLifeProductItemId('potion'),'product:life:potion');
 assert.doesNotMatch(sql,/'product:life:vitality_potion'/);
 assert.match(sql,/private\.market_life_product_id\(p_item_id\)/);
 assert.match(sql,/MARKET_PRODUCT_INVALID/);
});
test('orders reserve, deliver, refund and expose actual server life products',()=>{
 assert.match(sql,/set products=jsonb_set\(products,array\[v_life_product_key\]/);
 assert.match(sql,/set products=jsonb_set\(products,array\[private\.market_life_product_id\(p_item\)\]/);
 assert.match(sql,/coalesce\(\(products->>v_life_product_key\)::bigint,0\)>=p_quantity/);
 assert.match(sql,/o\.item_id like 'product:life:%'/);
 assert.match(sql,/v_entry\.item_id like 'product:life:%'/);
 assert.match(sql,/'lifeProducts'/);
 assert.match(sql,/o\.item_id not like 'product:life:%'/);
});
