import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928072500_occupation_war_indexes_v0165.sql',import.meta.url),'utf8');

test('OCCUPATION INDEX 01: participant and duel user foreign keys are covered',()=>{
 for(const name of [
  'occupation_participants_user_idx',
  'occupation_duels_attacker_idx',
  'occupation_duels_defender_idx',
  'occupation_duels_current_actor_idx',
  'occupation_duels_winner_idx',
 ])assert.match(sql,new RegExp(name));
});
