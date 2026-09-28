import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928044000_equipment_market_v2_indexes_v0164.sql',import.meta.url),'utf8');

test('V2 MARKET INDEX 01: equipment can be relisted after cancel expire or sale while only one OPEN escrow exists',()=>{
 assert.match(sql,/drop constraint if exists equipment_market_listings_asset_item_id_key/i);
 assert.match(sql,/unique index[\s\S]*asset_item_id[\s\S]*where status='OPEN'/i);
});

test('V2 MARKET INDEX 02: buyer and seller foreign keys have covering indexes',()=>{
 assert.match(sql,/equipment_market_listings_buyer_idx[\s\S]*buyer_id/i);
 assert.match(sql,/equipment_market_trades_buyer_idx[\s\S]*buyer_id/i);
 assert.match(sql,/equipment_market_trades_seller_idx[\s\S]*seller_id/i);
});
