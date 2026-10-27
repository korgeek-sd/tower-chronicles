import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261027120000_unified_vitality.sql','utf8');
test('all life production draws from server-owned vitality',()=>{
 assert.match(sql,/private\.refresh_hunting_state\(u\)/);
 assert.match(sql,/set vitality=vitality-p_count/);
 assert.match(sql,/VITALITY_EMPTY/);
 assert.match(sql,/'vitalitySpent'/);
 assert.doesNotMatch(sql,/set action_points=s\.action_points-p_count/);
});
test('daily refresh does not refill vitality',()=>{
 assert.match(sql,/set day=today/);
 assert.doesNotMatch(sql,/set action_points=100,day=today/);
 assert.match(sql,/'vitality',life_vitality/);
 assert.match(sql,/'recoveredAt'/);
 assert.match(sql,/300 seconds/);
});
