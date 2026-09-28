import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928023000_equipment_v23_cutover_v0164.sql',import.meta.url),'utf8');

test('V23 SERVER CUTOVER 01: legacy gear orders, storage, assets and non-alchemy craft jobs are removed with refunds',()=>{
 assert.match(sql,/update private\.player_wallets[\s\S]*market_orders[\s\S]*item_id like 'gear:%'/i);
 assert.match(sql,/market_storage[\s\S]*side='SELL'/i);
 assert.match(sql,/online_craft_jobs[\s\S]*field<>'alchemy'/i);
 assert.match(sql,/material:/i);
 assert.match(sql,/delete from private\.market_orders[\s\S]*item_id like 'gear:%'/i);
 assert.match(sql,/delete from private\.market_storage[\s\S]*item_id like 'gear:%'/i);
 assert.match(sql,/delete from private\.market_assets[\s\S]*item_id like 'gear:%'/i);
});

test('V23 SERVER CUTOVER 02: every save and server asset receives one canonical starter sword and seven-slot loadout',()=>{
 assert.match(sql,/equipment_v2:starter-v2/);
 assert.match(sql,/association_supply_iron_sword/);
 assert.match(sql,/'grade','common'/);
 assert.match(sql,/'enhancement',0/);
 assert.match(sql,/'weapon','starter-v2'/);
 for(const slot of ['helmet','armor','gloves','boots','necklace','ring'])assert.match(sql,new RegExp("'"+slot+"',null"));
 assert.match(sql,/jsonb_set[\s\S]*\{items\}[\s\S]*'\[\]'::jsonb/i);
 assert.match(sql,/equipmentItems/);
});

test('V23 SERVER CUTOVER 03: first server economy bootstrap imports V2 equipment instead of legacy gear',()=>{
 assert.match(sql,/create or replace function private\.sync_market_economy_from_latest_save/i);
 assert.match(sql,/equipment_v2:/);
 assert.match(sql,/equipmentItems/);
 assert.doesNotMatch(sql,/insert into private\.market_assets[\s\S]{0,500}'gear:'/i);
});

test('V23 SERVER CUTOVER 04: server combat applies all finalized nine-item base stats including ring crit',()=>{
 for(const kind of [
  'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
  'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
  'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring',
 ])assert.match(sql,new RegExp(kind));
 assert.match(sql,/expedition_iron_helmet[\s\S]*20[\s\S]*5/);
 assert.match(sql,/mining_detail_reinforced_gloves[\s\S]*3[\s\S]*2/);
 assert.match(sql,/survey_corps_dust_boots[\s\S]*15[\s\S]*3/);
 assert.match(sql,/association_registration_tag[\s\S]*2[\s\S]*25/);
 assert.match(sql,/expedition_merit_ring[\s\S]*4/);
 assert.match(sql,/0\.03/);
 assert.match(sql,/critChance/);
});

test('V23 SERVER CUTOVER 05: equipment crafting is rejected server-side while alchemy remains supported',()=>{
 assert.match(sql,/create or replace function public\.start_online_craft/i);
 assert.match(sql,/healing_lesser/);
 assert.match(sql,/healing_standard/);
 assert.match(sql,/healing_greater/);
 assert.match(sql,/healing_supreme/);
 assert.match(sql,/CRAFT_EQUIPMENT_REMOVED/);
 assert.doesNotMatch(sql,/p_kind in \('sword','dagger','bow','staff'\)/);
});

test('V23 SERVER CUTOVER 06: privileged replacement functions pin search_path and preserve restricted execution',()=>{
 for(const name of ['sync_market_economy_from_latest_save','server_equipment_snapshot','combat_equipment_stats']){
  assert.match(sql,new RegExp("create or replace function private\\."+name+"[\\s\\S]*?set search_path=''","i"));
  assert.match(sql,new RegExp("revoke all on function private\\."+name+"[\\s\\S]*?authenticated","i"));
 }
 assert.match(sql,/revoke all on function public\.start_online_craft[\s\S]*anon/i);
 assert.match(sql,/grant execute on function public\.start_online_craft[\s\S]*authenticated/i);
});
