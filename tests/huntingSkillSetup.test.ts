import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {matchesSkillConditions,validSkillConditions,CONDITION_OPTIONS,type ConditionContext} from '../src/game/hunting/skillConditions';
test('cycle resumes after the used skill instead of restarting at slot one',()=>{
 const s=initialHuntingState(0),ids=['sword_strike_c','heavy','quick'];
 const {result}=resolveHunt(s,'ruins',{hp:10000,attack:1,defense:10000,critChance:0},ids,0,()=>.5);
 assert.match(result.turns[0].lines[0],/보급검 베기/);
 assert.match(result.turns[1].lines[0],/강타/);
 assert.match(result.turns[2].lines[0],/속공/);
});
test('false conditions skip without consuming a turn, and an empty circuit waits',()=>{
 const s={...initialHuntingState(0),skillSetup:{slots:['heavy','quick'],conditions:{heavy:[{kind:'turn_gte',value:3}],quick:[{kind:'turn_lte',value:1}]}}};
 const {result}=resolveHunt(s,'ruins',{hp:10000,attack:1,defense:10000,critChance:0},s.skillSetup.slots,0,()=>.5);
 assert.match(result.turns[0].lines[0],/속공/);
 assert.match(result.turns[1].lines[0],/대기/);
 assert.match(result.turns[2].lines[0],/강타/);
});
const context:ConditionContext={hp:50,maxHp:100,mp:25,maxMp:100,enemyHp:40,enemyMaxHp:80,turn:6,shield:0,buff:false,effects:{bleedUntil:5,burnUntil:6},enemyDot:true,enemyDefenseDown:false};
test('inclusive resource/turn boundaries, AND, intervals and expired effects',()=>{
 for(const [kind,value] of [['hp_pct_lte',50],['hp_gte',50],['mp_pct_gte',25],['mp_lte',25],['enemy_hp_pct_lte',50],['turn_gte',6],['turn_lte',6],['turn_every',3]] as const)assert.ok(matchesSkillConditions([{kind,value}],context),kind);
 assert.ok(matchesSkillConditions([{kind:'bleed_absent'}],context));assert.ok(matchesSkillConditions([{kind:'burn_present'}],context));
 assert.ok(!matchesSkillConditions([{kind:'hp_lte',value:49}],context));
 assert.ok(!matchesSkillConditions([{kind:'turn_every',value:4}],context));
 assert.ok(!validSkillConditions([{kind:'hp_pct_lte',value:101}]));assert.ok(!validSkillConditions([{kind:'turn_every',value:0}]));assert.ok(!validSkillConditions([{kind:'hp_lte',value:NaN}]));
 for(const [kind] of CONDITION_OPTIONS)assert.equal(typeof matchesSkillConditions([{kind,value:50}],context),'boolean');
});

import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('server ignores unused values for state and always conditions just like guests',async()=>{
 const db=new PGlite();try{
  await db.exec('create schema private;create role anon;create role authenticated;');
  const sql=readFileSync('supabase/hunting-skill-setup.sql','utf8');
  await db.exec(sql.slice(sql.indexOf('create or replace function private.hunting_conditions_match'),sql.indexOf('create or replace function public.save_hunting_setup')));
  const conditions=[{kind:'always',value:'unused'},{kind:'shield_absent',value:{unused:true}}];
  const result=await db.query<{ok:boolean}>('select private.hunting_conditions_match($1::jsonb,$2::jsonb) ok',[JSON.stringify(conditions),JSON.stringify({shield:false})]);
  assert.equal(result.rows[0].ok,true);
 }finally{await db.close();}
});
