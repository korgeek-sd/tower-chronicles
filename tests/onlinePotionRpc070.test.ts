import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20260928120332_fix_online_potion_ids_v0170.sql',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/online/economy.ts',import.meta.url),'utf8');

test('ONLINE POTION 01: server accepts every canonical healing potion id',()=>{
 for(const id of ['healing_lesser','healing_standard','healing_greater','healing_supreme'])assert.ok(migration.includes(id),id);
 assert.match(migration,/potion_key:=case p_potion/i);
});

test('ONLINE POTION 02: server persists the run bag and returns authoritative potion counts',()=>{
 assert.match(migration,/persist_run_bag_to_save/i);
 assert.match(migration,/'potions',jsonb_build_object/i);
 for(const field of ['potion_lesser','potion_standard','potion_greater','potion_supreme'])assert.ok(migration.includes(field),field);
});

test('ONLINE POTION 03: authenticated clients retain RPC access while anon remains blocked',()=>{
 assert.match(migration,/revoke all on function public\.apply_online_potion\([^;]+\) from public,anon/i);
 assert.match(migration,/grant execute on function public\.apply_online_potion\([^;]+\) to authenticated/i);
});

test('ONLINE POTION 04: client reconciles server potion counts into the expedition bag',()=>{
 assert.match(client,/if\(server\.potions\)/);
 for(const id of ['healing_lesser','healing_standard','healing_greater','healing_supreme'])assert.ok(client.includes(id),id);
 assert.match(client,/e\.bag\[potion\]=Math\.max/);
});

test('ONLINE POTION 05: server potion errors are shown as user-facing messages',()=>{
 assert.match(client,/COMBAT_POTION_INVALID:'현재 상태에서는 포션을 사용할 수 없습니다\.'/);
 assert.match(client,/COMBAT_POTION_EMPTY:'원정 가방에 해당 포션이 없습니다\.'/);
});
