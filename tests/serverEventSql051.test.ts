import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260926140250_fix_server_event_array_append_v0151.sql',import.meta.url),'utf8');

test('SERVER EVENT SQL 01: event ids and weights use explicit array_append',()=>{
 assert.match(sql,/ids:=array_append\(ids,'common_cache'\)/);
 assert.match(sql,/ids:=array_append\(ids,'resource_gather_'\|\|p_tower\)/);
 assert.match(sql,/weights:=array_append\(weights,\.65::numeric\)/);
});

test('SERVER EVENT SQL 02: scalar values are never concatenated directly onto typed arrays',()=>{
 assert.doesNotMatch(sql,/ids\s*:=\s*ids\s*\|\|\s*'/);
 assert.doesNotMatch(sql,/weights\s*:=\s*weights\s*\|\|\s*[0-9.]/);
});

test('SERVER EVENT SQL 03: both overloads remain private from API roles',()=>{
 const revokes=sql.match(/revoke all on function private\.server_event_id/g)??[];
 assert.equal(revokes.length,2);
 assert.match(sql,/from public,anon,authenticated/);
});
