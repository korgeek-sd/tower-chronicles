import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928035000_equipment_enhancement_v2_v0164.sql',import.meta.url),'utf8');

test('SERVER V2 ENHANCE 01: RPC validates session, V2 ownership, expedition state, starter and +10 cap',()=>{
 assert.match(sql,/create or replace function public\.enhance_online_equipment/i);
 assert.match(sql,/private\.require_active_game_session/);
 assert.match(sql,/equipment_v2:/);
 assert.match(sql,/for update/i);
 assert.match(sql,/ENHANCE_EXPEDITION_BLOCKED/);
 assert.match(sql,/starter-v2/);
 assert.match(sql,/ENHANCE_MAX_LEVEL/);
});

test('SERVER V2 ENHANCE 02: exact grade bases, stage factors and stone costs are encoded',()=>{
 for(const value of ['500','750','1100','1600','2500'])assert.ok(sql.includes(value),value);
 for(const factor of ['1.0','1.5','2.2','3.2','4.5','6.5','9.5','14','21','32'])assert.ok(sql.includes(factor),factor);
 for(const pair of ['when 1 then 1','when 2 then 1','when 3 then 2','when 4 then 2','when 5 then 3','when 6 then 4','when 7 then 5','when 8 then 7','when 9 then 10','when 10 then 15'])assert.ok(sql.includes(pair),pair);
 assert.match(sql,/other:enhancement_stone/);
});

test('SERVER V2 ENHANCE 03: exact +0 through +10 outcome thresholds exist',()=>{
 for(const threshold of ['0.50','0.65','0.970','0.998','0.60','0.940','0.997','0.55','0.890','0.995','0.48','0.820','0.993','0.40','0.730','0.990','0.32','0.630','0.990','0.24','0.510','0.985','0.19','0.430','0.980','0.10','0.330','0.975'])assert.ok(sql.includes(threshold),threshold);
});

test('SERVER V2 ENHANCE 04: Silver and stones are deducted before outcome and every result mutates only the target item',()=>{
 const debit=sql.indexOf('update private.player_wallets');
 const roll=sql.indexOf('v_roll:=random()');
 assert.ok(debit>0&&roll>debit);
 assert.match(sql,/quantity=quantity-v_stone_cost/);
 assert.match(sql,/jsonb_set\(gear,'\{enhancement\}'/);
 assert.match(sql,/delete from private\.market_assets[\s\S]*equipment_v2:/i);
});

test('SERVER V2 ENHANCE 05: destruction clears equipped and preset references before persisting authoritative save',()=>{
 assert.match(sql,/FAIL_DESTROYED/);
 assert.match(sql,/array\['equipped',v_slot\]/);
 assert.match(sql,/expeditionPresets/);
 assert.match(sql,/private\.persist_client_payload_with_server_economy/);
 assert.match(sql,/private\.cloud_record_json/);
});

test('SERVER V2 ENHANCE 06: RPC is exposed only to authenticated role with fixed search_path',()=>{
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/revoke all on function public\.enhance_online_equipment[\s\S]*public,anon/i);
 assert.match(sql,/grant execute on function public\.enhance_online_equipment[\s\S]*authenticated/i);
});
