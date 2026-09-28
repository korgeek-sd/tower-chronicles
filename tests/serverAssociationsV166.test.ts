import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928083000_server_associations_v0166.sql',import.meta.url),'utf8');

test('SERVER ASSOCIATION 01: global associations members applications and activity live in private schema',()=>{
 for(const table of ['online_associations','online_association_members','online_association_applications','online_association_activity'])
  assert.match(sql,new RegExp('create table if not exists private\\.'+table,'i'));
});

test('SERVER ASSOCIATION 02: each account can belong to at most one server association',()=>{
 assert.match(sql,/unique\s*\(user_id\)/i);
 assert.match(sql,/member_limit/i);
 assert.match(sql,/30/);
});

test('SERVER ASSOCIATION 03: names are globally unique case-insensitively and reserved names are blocked',()=>{
 assert.match(sql,/unique index[\s\S]*lower\(name\)/i);
 for(const name of ['탑기록원','노바르 평의회','은저울 상회','네 공방 연맹','청동마차 상단'])
  assert.match(sql,new RegExp(name));
});

test('SERVER ASSOCIATION 04: online RPCs cover create join approval leave management transfer kick and disband',()=>{
 for(const name of [
  'get_online_association_state','create_online_association_v2','join_online_association',
  'review_online_association_application','leave_online_association','update_online_association',
  'transfer_online_association_leadership','kick_online_association_member','disband_online_association'
 ])assert.match(sql,new RegExp('create or replace function public\\.'+name,'i'));
});

test('SERVER ASSOCIATION 05: server projection overwrites client association claims on authoritative saves',()=>{
 assert.match(sql,/server_association_projection/);
 assert.match(sql,/server_association_payload/);
 assert.match(sql,/create or replace function private\.server_authoritative_payload/);
 assert.match(sql,/private\.server_association_payload\(p_user,p\)/);
});

test('SERVER ASSOCIATION 06: expedition revenue share is server membership based and credits treasury exactly once',()=>{
 assert.match(sql,/association_id uuid/);
 assert.match(sql,/server_association_revenue_rate/);
 assert.match(sql,/NEW\.revenue_share_rate:=/);
 assert.match(sql,/OLD\.status='ACTIVE'[\s\S]*NEW\.status='RETURNED'/);
 assert.match(sql,/treasury_silver=treasury_silver\+v_share/);
});

test('SERVER ASSOCIATION 07: occupation identity uses the global server association id, not account-local save ids',()=>{
 assert.match(sql,/create or replace function private\.occupation_identity/);
 assert.match(sql,/online_association_members/);
 assert.match(sql,/groupKey.*association_id/i);
 assert.doesNotMatch(sql,/p_user::text\|\|':'\|\|v_assoc_id/);
});

test('SERVER ASSOCIATION 08: mutating RPCs pin search_path require active gameplay sessions and are authenticated only',()=>{
 for(const name of [
  'create_online_association_v2','join_online_association','review_online_association_application',
  'leave_online_association','update_online_association','transfer_online_association_leadership',
  'kick_online_association_member','disband_online_association'
 ]){
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'[\\s\\S]*security definer set search_path=\\\'\\\'','i'));
  assert.match(sql,new RegExp('create or replace function public\\.'+name+'[\\s\\S]*require_active_game_session','i'));
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'[\\s\\S]*public,anon','i'));
  assert.match(sql,new RegExp('grant execute on function public\\.'+name+'[\\s\\S]*authenticated','i'));
 }
});

test('SERVER ASSOCIATION 09: mutations broadcast association and occupation refresh signals',()=>{
 assert.match(sql,/association_changed/);
 assert.match(sql,/occupation_changed/);
 assert.match(sql,/realtime\.send/);
});
