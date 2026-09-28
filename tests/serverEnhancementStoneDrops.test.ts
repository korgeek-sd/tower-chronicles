import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928033000_enhancement_stone_combat_drops_v0164.sql',import.meta.url),'utf8');

test('SERVER STONE DROP 01: normal Iron floor chances encode 12 through 38 percent',()=>{
 for(const chance of ['0.12','0.14','0.16','0.18','0.20','0.22','0.25','0.28','0.32','0.38'])assert.ok(sql.includes(chance),chance);
 assert.match(sql,/server_enhancement_stone_drop/);
});

test('SERVER STONE DROP 02: bosses 6F through 10F guarantee 3 4 5 7 10 stones',()=>{
 assert.match(sql,/when 6 then 3/);
 assert.match(sql,/when 7 then 4/);
 assert.match(sql,/when 8 then 5/);
 assert.match(sql,/when 9 then 7/);
 assert.match(sql,/when 10 then 10/);
});

test('SERVER STONE DROP 03: restore exposes temporary stones and only ACTIVE to RETURNED settlement persists them',()=>{
 assert.match(sql,/enhancementStones/);
 assert.match(sql,/temporary_loot/);
 assert.match(sql,/restore_online_expedition/);
 assert.match(sql,/other:enhancement_stone/);
 assert.match(sql,/create trigger[\s\S]*enhancement_stone/i);
 assert.match(sql,/old\.status='ACTIVE'/);
 assert.match(sql,/new\.status='RETURNED'/);
});

test('SERVER STONE DROP 04: stone roll uses independent deterministic server RNG channels',()=>{
 assert.match(sql,/server_roll\(p_run\.reward_seed,p_kill,6411,1\)/);
 assert.match(sql,/server_roll\(p_run\.reward_seed,p_kill,6412,2\)/);
});
