import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928043000_equipment_market_v2_v0164.sql',import.meta.url),'utf8');

test('V2 MARKET 01: equipment listings are fixed-price 72h listings with no bid side',()=>{
 assert.match(sql,/create table if not exists private\.equipment_market_listings/i);
 assert.match(sql,/interval '72 hours'/i);
 assert.match(sql,/list_price bigint/i);
 assert.match(sql,/status in \('OPEN','SOLD','CANCELLED','EXPIRED'\)/i);
 assert.doesNotMatch(sql,/bid_price|bid_amount|place.*bid/i);
});

test('V2 MARKET 02: registration fee is 1% with 100 to 100000 Silver clamp and never refunded',()=>{
 assert.match(sql,/equipment_market_registration_fee/);
 assert.match(sql,/greatest\(100/);
 assert.match(sql,/least\(100000/);
 assert.match(sql,/100/);
 assert.match(sql,/registration_fee/);
 const cancel=sql.slice(sql.indexOf('create or replace function public.cancel_online_equipment_listing'),sql.indexOf('create or replace function public.buy_online_equipment_listing'));
 assert.doesNotMatch(cancel,/registration_fee[\s\S]*player_wallets/);
});

test('V2 MARKET 03: seller fee is 5%, buyer pays only list price, proceeds go to market storage',()=>{
 assert.match(sql,/seller_fee_bps[^\n]*500/);
 assert.match(sql,/v_seller_fee:=floor\(v_listing\.list_price::numeric\*500\/10000\)/);
 assert.match(sql,/v_seller_net:=v_listing\.list_price-v_seller_fee/);
 assert.match(sql,/silver=silver-v_listing\.list_price/);
 assert.match(sql,/private\.market_storage/);
 assert.match(sql,/side,'SELL'/);
});

test('V2 MARKET 04: listing escrow removes exact equipment_v2 instance and cancellation or expiry restores it',()=>{
 assert.match(sql,/equipment_v2:'\|\|p_item_id/);
 assert.match(sql,/delete from private\.market_assets/);
 assert.match(sql,/asset_item_id/);
 assert.match(sql,/gear jsonb not null/);
 assert.match(sql,/expire_equipment_market_listings/);
 assert.match(sql,/insert into private\.market_assets/);
});

test('V2 MARKET 05: starter equipped and expedition equipment cannot be listed',()=>{
 assert.match(sql,/starter-v2/);
 assert.match(sql,/EQUIPMENT_MARKET_STARTER_PROTECTED/);
 assert.match(sql,/EQUIPMENT_MARKET_EQUIPPED/);
 assert.match(sql,/EQUIPMENT_MARKET_EXPEDITION_BLOCKED/);
});

test('V2 MARKET 06: instant purchase transfers exact gear to buyer and forbids self-purchase',()=>{
 assert.match(sql,/buy_online_equipment_listing/);
 assert.match(sql,/EQUIPMENT_MARKET_SELF_BUY/);
 assert.match(sql,/buyer_id/);
 assert.match(sql,/equipment_v2:/);
 assert.match(sql,/status='SOLD'/);
});

test('V2 MARKET 07: state exposes kinds grades enhancements filters and market policy',()=>{
 assert.match(sql,/equipmentListings/);
 assert.match(sql,/equipmentTrades/);
 assert.match(sql,/registrationFeeBps',100/);
 assert.match(sql,/sellerFeeBps',500/);
 assert.match(sql,/durationHours',72/);
 assert.match(sql,/marketKey/);
 assert.match(sql,/kind/);
 assert.match(sql,/grade/);
 assert.match(sql,/enhancement/);
});

test('V2 MARKET 08: public RPCs require active session and restricted execution',()=>{
 for(const name of ['list_online_equipment','cancel_online_equipment_listing','buy_online_equipment_listing']){
  assert.match(sql,new RegExp("create or replace function public\\."+name+"[\\s\\S]*?private\\.require_active_game_session","i"));
  assert.match(sql,new RegExp("revoke all on function public\\."+name+"[\\s\\S]*?public,anon","i"));
  assert.match(sql,new RegExp("grant execute on function public\\."+name+"[\\s\\S]*?authenticated","i"));
 }
});
