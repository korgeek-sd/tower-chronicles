import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928014500_equipment_v2_cutover_v0164.sql',import.meta.url),'utf8');

test('SERVER V2 CUTOVER 01: legacy gear assets orders and storage are removed with currency refunds',()=>{
 assert.match(sql,/item_id like 'gear:%'/i);
 assert.match(sql,/remaining_quantity\s*\*\s*limit_price/i);
 assert.match(sql,/market_storage/i);
 assert.match(sql,/side='SELL'/i);
 assert.match(sql,/delete from private\.market_orders/i);
 assert.match(sql,/delete from private\.market_storage/i);
 assert.match(sql,/delete from private\.market_assets/i);
});

test('SERVER V2 CUTOVER 02: unfinished equipment crafts refund materials and only alchemy survives',()=>{
 assert.match(sql,/online_craft_jobs/i);
 assert.match(sql,/status in \('ACTIVE','QUEUED'\)/i);
 assert.match(sql,/material_cost/i);
 assert.match(sql,/field<>'alchemy'/i);
 assert.match(sql,/delete from private\.online_craft_jobs/i);
});

test('SERVER V2 CUTOVER 03: every saved account gets exactly one deterministic common starter sword',()=>{
 assert.match(sql,/equipment_v2:starter-v2/);
 assert.match(sql,/association_supply_iron_sword/);
 assert.match(sql,/'common'/);
 assert.match(sql,/'enhancement',0/);
 assert.match(sql,/on conflict\(user_id,item_id\)/i);
});

test('SERVER V2 CUTOVER 04: cloud payloads are rewritten to schema 23 and seven-slot starter loadout',()=>{
 assert.match(sql,/'version'.*23/s);
 assert.match(sql,/'items'.*\[\]/s);
 assert.match(sql,/'equipmentItems'/);
 for(const slot of ['weapon','helmet','armor','gloves','boots','necklace','ring'])assert.match(sql,new RegExp("'"+slot+"'"));
 assert.match(sql,/starter-v2/);
});

test('SERVER V2 CUTOVER 05: legacy client payloads cannot re-import gear and server crafting is potion-only',()=>{
 assert.match(sql,/create or replace function private\.sync_market_economy_from_latest_save/i);
 const sync=sql.slice(sql.indexOf('create or replace function private.sync_market_economy_from_latest_save'),sql.indexOf('create or replace function public.start_online_craft'));
 assert.doesNotMatch(sync,/insert into private\.market_assets[\s\S]*?'gear:'/i);
 assert.match(sql,/EQUIPMENT_CRAFTING_REMOVED/);
});

test('SERVER V2 CUTOVER 06: privileged migration helpers retain pinned search_path and restricted execution',()=>{
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/revoke all on function private\.sync_market_economy_from_latest_save/i);
});
