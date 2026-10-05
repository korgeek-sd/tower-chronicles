import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20261005123000_preserve_all_job_ids_in_online_combat.sql',import.meta.url),'utf8');

test('online combat preserves job identity for selectable jobs including hunter and excavator',()=>{
 for(const id of ['hunter','excavator','guide','hundred_battle_returnee'])assert.match(sql,new RegExp(`'${id}'`));
 assert.match(sql,/else\s+null/i);
 assert.match(sql,/revoke all on function private\.server_job_id\(jsonb\) from public,anon,authenticated/i);
});
