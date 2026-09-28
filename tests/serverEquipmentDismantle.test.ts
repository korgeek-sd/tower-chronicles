import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928031000_equipment_dismantle_v0164.sql',import.meta.url),'utf8');

test('SERVER DISMANTLE 01: authenticated RPC requires active game session and an owned V2 equipment asset',()=>{
 assert.match(sql,/create or replace function public\.dismantle_online_equipment/i);
 assert.match(sql,/private\.require_active_game_session/);
 assert.match(sql,/equipment_v2:/);
 assert.match(sql,/for update/i);
 assert.match(sql,/DISMANTLE_ITEM_NOT_FOUND/);
});

test('SERVER DISMANTLE 02: starter equipped and expedition equipment cannot be dismantled',()=>{
 assert.match(sql,/starter-v2/);
 assert.match(sql,/DISMANTLE_STARTER_PROTECTED/);
 assert.match(sql,/DISMANTLE_EQUIPPED/);
 assert.match(sql,/DISMANTLE_EXPEDITION_BLOCKED/);
 assert.match(sql,/online_expeditions/);
 assert.match(sql,/status='ACTIVE'/);
});

test('SERVER DISMANTLE 03: grade yields are exactly 1 2 4 8 15 and enhancement level is not part of yield',()=>{
 assert.match(sql,/when 'common' then 1/);
 assert.match(sql,/when 'uncommon' then 2/);
 assert.match(sql,/when 'rare' then 4/);
 assert.match(sql,/when 'heroic' then 8/);
 assert.match(sql,/when 'legendary' then 15/);
 const yieldBlock=sql.slice(sql.indexOf("v_yield:=case"),sql.indexOf("end;",sql.indexOf("v_yield:=case"))+4);
 assert.doesNotMatch(yieldBlock,/enhancement/i);
});

test('SERVER DISMANTLE 04: asset deletion and universal enhancement stone credit are atomic and persisted',()=>{
 assert.match(sql,/delete from private\.market_assets[\s\S]*equipment_v2:/i);
 assert.match(sql,/other:enhancement_stone/);
 assert.match(sql,/on conflict\(user_id,item_id\) do update/i);
 assert.match(sql,/private\.persist_market_economy_to_save/);
 assert.match(sql,/private\.cloud_record_json/);
});

test('SERVER DISMANTLE 05: RPC execution is restricted to authenticated users',()=>{
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/revoke all on function public\.dismantle_online_equipment[\s\S]*public,anon/i);
 assert.match(sql,/grant execute on function public\.dismantle_online_equipment[\s\S]*authenticated/i);
});
