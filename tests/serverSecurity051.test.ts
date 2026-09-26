import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260926140510_harden_advance_exploration_wrapper_v0151.sql',import.meta.url),'utf8');

test('SERVER SECURITY 01: exploration compatibility wrapper does not retain elevated privileges',()=>{
 assert.match(sql,/advance_online_exploration\(uuid,bigint,text,text,bigint\) security invoker/i);
});

test('SERVER SECURITY 02: wrapper is unavailable to anonymous callers',()=>{
 assert.match(sql,/revoke all .* from public,anon/i);
 assert.match(sql,/grant execute .* to authenticated/i);
});
