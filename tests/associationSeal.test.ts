import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ASSOCIATION_SEAL_MAX_LEVEL,
 ASSOCIATION_SEAL_MAX_ROLLS,
 ASSOCIATION_SEAL_PROBABILITIES,
 ASSOCIATION_SEAL_RESET_COST,
 ASSOCIATION_SEAL_ROLL_COST,
 associationSealReward,
} from '../src/game/seal.ts';

test('ASSOCIATION SEAL 01: final progression rules stay locked',()=>{
 assert.equal(ASSOCIATION_SEAL_MAX_LEVEL,30);
 assert.equal(ASSOCIATION_SEAL_MAX_ROLLS,20);
 assert.equal(ASSOCIATION_SEAL_ROLL_COST,300);
 assert.equal(ASSOCIATION_SEAL_RESET_COST,3000);
 assert.deepEqual(ASSOCIATION_SEAL_PROBABILITIES.map(row=>[row.step,row.rate]),[[1,76],[2,20],[3,4]]);
});

test('ASSOCIATION SEAL 02: milestone reward table reaches HP 6 / ATK 3 / DEF 3',()=>{
 assert.deepEqual(associationSealReward(0),{hpPercent:0,attackPercent:0,defensePercent:0});
 assert.deepEqual(associationSealReward(5),{hpPercent:.7,attackPercent:.35,defensePercent:.35});
 assert.deepEqual(associationSealReward(10),{hpPercent:1.5,attackPercent:.75,defensePercent:.75});
 assert.deepEqual(associationSealReward(15),{hpPercent:2.4,attackPercent:1.2,defensePercent:1.2});
 assert.deepEqual(associationSealReward(20),{hpPercent:3.4,attackPercent:1.7,defensePercent:1.7});
 assert.deepEqual(associationSealReward(25),{hpPercent:4.5,attackPercent:2.25,defensePercent:2.25});
 assert.deepEqual(associationSealReward(30),{hpPercent:6,attackPercent:3,defensePercent:3});
});

test('ASSOCIATION SEAL 03: UI exposes server-only probabilities and costs with no client RNG',()=>{
 const ui=readFileSync(new URL('../src/components/seal/SealScreen.tsx',import.meta.url),'utf8');
 assert.match(ui,/ASSOCIATION_SEAL_PROBABILITIES/);
 assert.match(ui,/ASSOCIATION_SEAL_ROLL_COST/);
 assert.match(ui,/ASSOCIATION_SEAL_RESET_COST/);
 assert.match(ui,/SERVER ONLY/);
 assert.match(ui,/언제든지 재주조/);
 assert.doesNotMatch(ui,/canReset=.*rolls>=ASSOCIATION_SEAL_MAX_ROLLS/);
 assert.doesNotMatch(ui,/Math\.random\(/);
});

test('ASSOCIATION SEAL 04: server owns RNG, Gold deduction, limits and idempotency',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927114500_association_seal_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/association_seal_draw_step/);
 assert.match(sql,/v_roll<\.76/);
 assert.match(sql,/v_roll<\.96/);
 assert.match(sql,/set gold=gold-300/);
 assert.match(sql,/set gold=gold-3000/);
 assert.match(sql,/rolls_used>=20/);
 assert.match(sql,/SEAL_ROLL_DURING_EXPEDITION/);
 assert.match(sql,/require_active_game_session/);
 assert.match(sql,/p_request_id/);
 assert.match(sql,/for update/);
});

test('ASSOCIATION SEAL 05: seal bonuses are included in authoritative combat stats',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927114500_association_seal_v1.sql',import.meta.url),'utf8');
 assert.match(sql,/create or replace function private\.combat_equipment_stats/);
 assert.match(sql,/player_association_seals/);
 assert.match(sql,/hpPercent/);
 assert.match(sql,/attackPercent/);
 assert.match(sql,/defensePercent/);
 assert.match(sql,/v_hp:=v_hp\*\(1\+/);
 assert.match(sql,/v_attack:=v_attack\*\(1\+/);
 assert.match(sql,/v_def:=v_def\*\(1\+/);
});

test('ASSOCIATION SEAL 06: camp shortcut and app route are connected',()=>{
 const home=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(home,/title:'협회 인장'/);
 assert.match(home,/onMove\('seal'\)/);
 assert.match(main,/import \{SealScreen\}/);
 assert.match(main,/page==='seal'/);
 assert.match(main,/<SealScreen game=\{game\}/);
});


test('ASSOCIATION SEAL 07: reset is allowed before all 20 rolls are spent',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20260927121000_association_seal_reset_anytime_v0161.sql',import.meta.url),'utf8');
 assert.match(sql,/before_rolls between 0 and 20/);
 assert.match(sql,/set gold=gold-3000/);
 assert.match(sql,/set level=0,rolls_used=0,reset_count=reset_count\+1/);
 assert.doesNotMatch(sql,/rolls_used<20/);
 assert.doesNotMatch(sql,/SEAL_RESET_NOT_READY/);
});
