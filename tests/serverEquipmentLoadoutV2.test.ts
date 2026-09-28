import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../supabase/migrations/20260928012000_v2_equipment_loadout_runtime_v0164.sql',import.meta.url),'utf8');

test('SERVER V2 LOADOUT 01: snapshot verifies all seven V2 slots against owned equipment_v2 assets',()=>{
 for(const slot of ['weapon','helmet','armor','gloves','boots','necklace','ring'])assert.match(sql,new RegExp("'"+slot+"'"));
 assert.match(sql,/equipment_v2:/);
 for(const kind of [
  'association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff',
  'expedition_iron_helmet','return_corps_plate_armor','mining_detail_reinforced_gloves',
  'survey_corps_dust_boots','association_registration_tag','expedition_merit_ring',
 ])assert.match(sql,new RegExp(kind));
});

test('SERVER V2 LOADOUT 02: deterministic grade and +0 through +10 multipliers are server-side',()=>{
 for(const value of ['1.12','1.26','1.42','1.60','1.04','1.08','1.13','1.18','1.24','1.31','1.38','1.45','1.52'])assert.ok(sql.includes(value),value);
 assert.match(sql,/legendary/);
 assert.match(sql,/enhancement/);
});

test('SERVER V2 LOADOUT 03: online combat applies V2 weapon armor boots and preserves Association Seal bonuses',()=>{
 assert.match(sql,/create or replace function private\.combat_equipment_stats/i);
 assert.match(sql,/return_corps_plate_armor/);
 assert.match(sql,/survey_corps_dust_boots/);
 assert.match(sql,/player_association_seals/);
 assert.match(sql,/association_seal_bonus_json/);
 assert.doesNotMatch(sql,/equipment_v2[\s\S]{0,500}speed/i);
});

test('SERVER V2 LOADOUT 04: V2 staff drives online skill power',()=>{
 assert.match(sql,/create or replace function private\.combat_skill_power/i);
 assert.match(sql,/archive_standard_arcane_staff/);
 assert.match(sql,/1\.3/);
});

test('SERVER V2 LOADOUT 05: private runtime helpers pin search_path and stay non-callable by authenticated users',()=>{
 for(const name of ['server_equipment_snapshot','v2_equipment_multiplier','combat_equipment_stats','combat_skill_power']){
  assert.match(sql,new RegExp("create or replace function private\\."+name+"[\\s\\S]*?set search_path=''","i"));
  assert.match(sql,new RegExp("revoke all on function private\\."+name+"[\\s\\S]*?authenticated","i"));
 }
});

test('SERVER V2 LOADOUT 06: empty weapon remains empty instead of silently forcing starter gear',()=>{
 const snapshot=sql.slice(sql.indexOf('create or replace function private.server_equipment_snapshot'),sql.indexOf('create or replace function private.v2_equipment_multiplier'));
 assert.doesNotMatch(snapshot,/gear:starter/);
});
