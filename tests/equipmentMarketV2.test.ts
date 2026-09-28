import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928052000_equipment_orderbook_v2_v0164.sql',import.meta.url),'utf8');

test('V2 ORDERBOOK 01: equipment uses the shared market order and trade tables',()=>{
 assert.match(sql,/insert into private\.market_orders/);
 assert.match(sql,/insert into private\.market_trades/);
 assert.match(sql,/insert into private\.market_storage/);
 assert.match(sql,/v_order_item_id:=private\.equipment_market_key/);
});

test('V2 ORDERBOOK 02: same kind grade enhancement share one equipment market key',()=>{
 assert.match(sql,/equipment:<kind>:<grade>:\+<enhancement>/);
 assert.match(sql,/private\.equipment_market_key\(v_asset\.gear\)/);
 assert.match(sql,/item_id=v_incoming\.item_id/);
});

test('V2 ORDERBOOK 03: SELL escrows one exact equipment instance and BUY may request quantity',()=>{
 assert.match(sql,/p_item_id like 'equipment_v2:%'/);
 assert.match(sql,/p_side<>'SELL' or p_quantity<>1/);
 assert.match(sql,/delete from private\.market_assets/);
 assert.match(sql,/p_item_id like 'equipment:%'/);
 assert.match(sql,/if p_side<>'BUY'/);
});

test('V2 ORDERBOOK 04: price-time matching and partial fills are shared with normal items',()=>{
 assert.match(sql,/order by limit_price asc,created_at asc,order_id asc/);
 assert.match(sql,/order by limit_price desc,created_at asc,order_id asc/);
 assert.match(sql,/least\(v_buy\.remaining_quantity,v_sell\.remaining_quantity\)/);
 assert.match(sql,/PARTIAL/);
});

test('V2 ORDERBOOK 05: cancellation and BUY storage restore exact equipment_v2 ids',()=>{
 assert.match(sql,/v_asset_id:='equipment_v2:'\|\|\(v_order\.gear->>'id'\)/);
 assert.match(sql,/v_asset_id:='equipment_v2:'\|\|\(v_entry\.gear->>'id'\)/);
 assert.match(sql,/on conflict\(user_id,item_id\)/);
});

test('V2 ORDERBOOK 06: old fixed-price listings migrate to SELL orders and old RPCs are retired',()=>{
 assert.match(sql,/Existing fixed-price V2 listings are converted/);
 assert.match(sql,/from private\.equipment_market_listings l/);
 assert.match(sql,/l\.market_key,'SELL'/);
 for(const name of ['list_online_equipment','cancel_online_equipment_listing','buy_online_equipment_listing'])
  assert.match(sql,new RegExp('revoke execute on function public\\.'+name+'[\\s\\S]*from authenticated'));
});

test('V2 ORDERBOOK 07: shared RPCs stay authenticated and session-authoritative',()=>{
 assert.match(sql,/private\.require_active_game_session/);
 assert.match(sql,/revoke all on function public\.place_online_market_order[\s\S]*public,anon/);
 assert.match(sql,/grant execute on function public\.place_online_market_order[\s\S]*authenticated/);
});
