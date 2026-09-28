import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928114000_resource_stronghold_pvp_indexes_v1.sql',import.meta.url),'utf8');

test('STRONGHOLD PVP INDEXES 01: every new foreign key has a covering index',()=>{
 for(const index of [
  'resource_stronghold_contests_challenger_idx','resource_stronghold_contests_request_idx',
  'resource_stronghold_contests_winner_idx','resource_stronghold_receipts_recipient_idx',
  'resource_stronghold_requests_requester_idx','resource_stronghold_requests_stronghold_idx',
  'resource_strongholds_active_contest_idx',
 ])assert.match(sql,new RegExp('create index if not exists '+index,'i'));
});
