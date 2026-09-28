import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928123000_resource_stronghold_pvp_v2.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/online/resourceStronghold.ts',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/events/ResourceStrongholdPanel.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('STRONGHOLD PVP V2 01: server advances expired decisions and stalled combat turns',()=>{
 assert.match(sql,/turn_ends_at/i);
 assert.match(sql,/decision_ends_at\s*<=\s*p_now/i);
 assert.match(sql,/turn_ends_at\s*<=\s*p_now/i);
 assert.match(sql,/private\.active_game_sessions/i);
 assert.match(sql,/private\.finish_resource_stronghold_contest/i);
});

test('STRONGHOLD PVP V2 02: queued requests promote deterministically and stale runs are rejected',()=>{
 assert.match(sql,/order by requested_at asc,request_id asc/i);
 assert.match(sql,/status='QUEUED'/i);
 assert.match(sql,/status='REJECTED'/i);
 assert.match(sql,/EXPEDITION_INACTIVE/i);
 assert.match(sql,/private\.occupation_stats/i);
});

test('STRONGHOLD PVP V2 03: advance RPC is authenticated, session-bound and fixed search path',()=>{
 assert.match(sql,/create or replace function public\.advance_resource_stronghold_state/i);
 assert.match(sql,/private\.require_active_game_session/i);
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/revoke all on function public\.advance_resource_stronghold_state[\s\S]*public,anon/i);
 assert.match(sql,/grant execute on function public\.advance_resource_stronghold_state[\s\S]*authenticated/i);
});

test('STRONGHOLD PVP V2 04: client polls authoritative advancement and presents timeout recovery',()=>{
 assert.match(api,/export const advanceResourceStrongholdState/);
 assert.match(app,/advanceResourceStrongholdState/);
 assert.match(app,/setInterval\([^,]+,5000\)/);
 assert.match(panel,/turn_ends_at/);
 assert.match(panel,/자동 처리/);
});
