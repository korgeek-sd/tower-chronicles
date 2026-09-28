import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928083500_server_association_indexes_v0166.sql',import.meta.url),'utf8');

test('SERVER ASSOCIATION INDEX 01: reviewed-by and activity actor foreign keys are covered',()=>{
 assert.match(sql,/online_association_applications_reviewed_by_idx/i);
 assert.match(sql,/online_association_activity_actor_idx/i);
 assert.match(sql,/online_association_applications\(reviewed_by\)/i);
 assert.match(sql,/online_association_activity\(actor_user_id\)/i);
});
