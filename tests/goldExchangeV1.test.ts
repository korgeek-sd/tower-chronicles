import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('GOLD EXCHANGE V1 01: UI is a single GOLD/SILVER market with no item storage',()=>{
 const source=readFileSync(new URL('../src/components/market/GoldExchangeScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/GOLD \/ SILVER/);
 assert.match(source,/1 Gold당 Silver/);
 assert.match(source,/\['market','시장'\]/);
 assert.match(source,/\['orders','내 주문'\]/);
 assert.match(source,/\['trades','체결'\]/);
 assert.match(source,/별도 보관함 수령이 없습니다/);
 assert.doesNotMatch(source,/claimOnlineMarketStorage|marketCatalog|itemId/);
});

test('GOLD EXCHANGE V1 02: Gold Exchange is server-only and uses idempotent request ids',()=>{
 const client=readFileSync(new URL('../src/online/goldExchange.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/components/market/GoldExchangeScreen.tsx',import.meta.url),'utf8');
 assert.match(ui,/SERVER ONLY/);
 assert.match(client,/crypto\.randomUUID\(\)/);
 assert.match(client,/p_request_id:requestId/);
 assert.match(client,/place_online_gold_exchange_order/);
 assert.match(client,/cancel_online_gold_exchange_order/);
 assert.doesNotMatch(ui,/Math\.random\(/);
});

test('GOLD EXCHANGE V1 03: seller fee is visible and buy side has no trade fee',()=>{
 const source=readFileSync(new URL('../src/components/market/GoldExchangeScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/sellerFeeBps/);
 assert.match(source,/매수 수수료/);
 assert.match(source,/판매 수수료/);
 assert.match(source,/등록 수수료 없음/);
 assert.match(source,/즉시 정산/);
});

test('GOLD EXCHANGE V1 04: server migration escrows currencies and settles both wallets immediately',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927102323_online_gold_exchange_v0159.sql',import.meta.url),'utf8');
 assert.match(sql,/gold_exchange_orders/);
 assert.match(sql,/gold_exchange_trades/);
 assert.match(sql,/gold_exchange_order_requests/);
 assert.match(sql,/gold_exchange_cancel_requests/);
 assert.match(sql,/silver=silver-v_reserve/);
 assert.match(sql,/gold=gold-p_gold_quantity/);
 assert.match(sql,/set gold=gold\+v_qty/);
 assert.match(sql,/set silver=silver\+v_net/);
 assert.match(sql,/user_id<>v_user/);
 assert.match(sql,/seller_fee_bps/);
 assert.match(sql,/then 100[\s\S]*else 200/);
 assert.match(sql,/persist_market_economy_to_save\(v_id\)/);
});

test('GOLD EXCHANGE V1 05: public API is authenticated-only by migration contract',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927102323_online_gold_exchange_v0159.sql',import.meta.url),'utf8');
 assert.match(sql,/revoke all on function public\.get_online_gold_exchange_state\(\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.get_online_gold_exchange_state\(\) to authenticated/);
 assert.match(sql,/GOLD_EXCHANGE_EXPEDITION_BLOCKED/);
 assert.match(sql,/require_active_game_session/);
});
