import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928113000_resource_stronghold_pvp_v1.sql',import.meta.url),'utf8');

test('STRONGHOLD PVP SERVER 01: shared strongholds contests requests and loot receipts are private server state',()=>{
 for(const table of ['resource_strongholds','resource_stronghold_requests','resource_stronghold_contests','resource_stronghold_loot_receipts'])
  assert.match(sql,new RegExp('create table if not exists private\\.'+table,'i'));
});

test('STRONGHOLD PVP SERVER 02: all player RPCs require active sessions and authenticated execution only',()=>{
 for(const name of ['get_resource_stronghold_state','request_resource_stronghold','respond_resource_stronghold_contest','apply_resource_stronghold_contest_action','abandon_resource_stronghold']){
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'[\\s\\S]*private\\.require_active_game_session','i'));
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'[\\s\\S]*public,anon','i'));
  assert.match(sql,new RegExp('grant execute on function public\\.'+name+'[\\s\\S]*authenticated','i'));
 }
});

test('STRONGHOLD PVP SERVER 03: claims and simultaneous requests serialize and are idempotent',()=>{
 assert.match(sql,/for update/i);
 assert.match(sql,/p_request_id uuid/i);
 assert.match(sql,/unique\s*\(request_id\)/i);
 assert.match(sql,/order by requested_at asc,request_id asc/i);
 assert.match(sql,/on conflict\s*\(request_id\)/i);
});

test('STRONGHOLD PVP SERVER 04: server enforces 15 minute capture, 30 second choice, urgent times 1.5 and takeover carry',()=>{
 assert.match(sql,/interval '15 minutes'/i);
 assert.match(sql,/interval '30 seconds'/i);
 assert.match(sql,/60000/);
 assert.match(sql,/\*\s*1\.5/);
});

test('STRONGHOLD PVP SERVER 05: intervention combat uses turn nonce and resolves loot and deterministic destruction once',()=>{
 assert.match(sql,/action_nonce/);
 assert.match(sql,/p_action_nonce<>v_contest\.action_nonce\+1/);
 assert.match(sql,/p_action not in\('BASIC','GUARD'\)/);
 assert.match(sql,/equipment/i);
 assert.match(sql,/material/i);
 assert.match(sql,/destroyed/i);
 assert.match(sql,/resource_stronghold_loot_receipts/i);
});

test('STRONGHOLD PVP SERVER 06: every mutation broadcasts a private realtime change',()=>{
 assert.match(sql,/realtime\.send\([\s\S]*'resource_stronghold_changed'[\s\S]*'resource_stronghold'[\s\S]*true\)/i);
});

test('STRONGHOLD PVP SERVER 07: both expedition runs are locked during contest and released on resolution',()=>{
 assert.match(sql,/update private\.online_expeditions set stronghold=private\.resource_stronghold_json\(v_sh\),run_version=run_version\+1[\s\S]*user_id=v_sh\.owner_user_id[\s\S]*user_id=v_user/i);
 assert.match(sql,/v_contest\.challenger_user_id[\s\S]*jsonb_build_object\('status','DELETED'/i);
 assert.match(sql,/v_run\.tower<>p_tower or v_run\.floor<>p_floor/);
});
