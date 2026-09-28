import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928002500_iron_equipment_combat_rewards_v0164.sql',import.meta.url),'utf8');

test('SERVER EQUIPMENT DROP 01: migration defines server-authoritative Iron equipment drop helper',()=>{
  assert.match(sql,/create or replace function private\.server_kill_loot/i);
  assert.match(sql,/equipment_v2:/);
  for(const monster of ['goblin_miner','goblin_carrier','goblin_overseer','cave_rat','mine_bat'])assert.match(sql,new RegExp(monster));
});

test('SERVER EQUIPMENT DROP 02: floor equipment chances and grade bands are encoded server-side',()=>{
  for(const chance of ['0.08','0.09','0.10','0.11','0.12','0.14','0.16','0.18','0.20','0.25'])assert.ok(sql.includes(chance),chance);
  assert.match(sql,/legendary/);
  assert.match(sql,/heroic/);
  assert.match(sql,/uncommon/);
});

test('SERVER EQUIPMENT DROP 03: kill settlement keeps equipment temporary and safe return persists it',()=>{
  assert.match(sql,/temporary_loot/);
  assert.match(sql,/'equipment'/);
  assert.match(sql,/settle_online_expedition_v2/);
  assert.match(sql,/server_economy_payload/);
  assert.match(sql,/equipmentItems/);
  assert.match(sql,/p_outcome='returned'/);
  assert.match(sql,/p_outcome='dead'/);
});

test('SERVER EQUIPMENT DROP 04: privileged functions keep pinned search_path and restricted execution',()=>{
  assert.match(sql,/security definer set search_path=''/i);
  assert.match(sql,/revoke all on function private\.server_kill_loot/i);
  assert.match(sql,/revoke all on function public\.settle_online_expedition_v2/i);
  assert.match(sql,/grant execute on function public\.settle_online_expedition_v2[\s\S]*authenticated/i);
});
