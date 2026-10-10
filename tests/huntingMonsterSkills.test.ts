import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';
import {HUNT_MAPS,damage,initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {HUNT_MONSTER_SKILLS,resolveMonsterAction} from '../src/game/hunting/monsterSkills';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';
import {initialState} from '../src/game/engine/state';
import {PGlite} from '@electric-sql/pglite';

const sql=()=>readFileSync(new URL('../supabase/migrations/20261010150000_hunting_monster_skills.sql',import.meta.url),'utf8');
test('every monster encounter has one distinct authored skill without changing map-wide battle base',()=>{
 const known=new Set(Object.values(HUNT_MONSTERS).flat().map(m=>m.id));
 assert.equal(known.size,11);
 assert.deepEqual(new Set(Object.keys(HUNT_MONSTER_SKILLS)),known);
 for(const map of HUNT_MAPS)for(const m of HUNT_MONSTERS[map.id]){
  const skill=HUNT_MONSTER_SKILLS[m.id];
  assert.ok(skill.name&&skill.description);assert.ok(skill.interval>=2&&skill.interval<=4);
  assert.ok(skill.multiplier>0&&skill.hits>=1&&skill.hits<=2);
 }
 const first=resolveHunt(initialHuntingState(0),'plains',{hp:1000,attack:30,defense:40},['heavy'],0,()=>.99);
 assert.equal(first.result.monster?.hp,HUNT_MAPS[0].hp);
 assert.deepEqual(first.result.monster?.skill,HUNT_MONSTER_SKILLS.hide_gnawer);
});
test('signature skills proc on schedule, regular monster strikes and player guard remain valid',()=>{
 const props={monsterId:'hide_gnawer',monsterName:'하이에나',attack:12,defense:7,monsterHp:35,monsterMaxHp:90};
 const args=(turn:number,guard=false)=>resolveMonsterAction(props.monsterId,props.monsterName,turn,props.attack,props.defense,guard,props.monsterHp,props.monsterMaxHp);
 assert.equal(args(1).skillName,null);assert.equal(args(2).skillName,null);
 assert.equal(args(1).damage,damage(12,7));
 assert.equal(args(3).skillName,'찢어 물기');
 assert.equal(args(3).damage,damage(12,7,1.3));
 assert.ok(args(3,true).damage<args(3).damage);
 assert.equal(args(6).skillName,'찢어 물기');
 assert.equal(args(4).skillName,null);
});
test('double hit guards both strikes, and bat lifesteal is capped by missing HP',()=>{
 const strike=resolveMonsterAction('pack_vanguard','선봉',4,42,28,false,100,250);
 const guarded=resolveMonsterAction('pack_vanguard','선봉',4,42,28,true,100,250);
 assert.equal(strike.hits,2);
 assert.equal(strike.damage,2*damage(42,28,.85));
 assert.equal(guarded.damage,2*damage(42,28,.85*.5));
 assert.match(strike.line,/2연타/);
 const drain=resolveMonsterAction('mine_bat','박쥐',4,60,0,false,50,90);
 assert.equal(drain.heal,Math.min(40,Math.floor(drain.damage*.5)));
 assert.match(drain.line,/흡혈 송곳니/);assert.match(drain.line,/HP \+/);
 assert.equal(resolveMonsterAction('mine_bat','박쥐',4,60,0,false,90,90).heal,0);
});
test('skills run during actual guest instant hunt and monster info renders in battle result',()=>{
 const state=resolveHunt(initialHuntingState(0),'plains',{hp:1000,attack:0,defense:7},[],0,()=>.5).state;
 const result=state.lastResult!;
 assert.ok(result.turns.length>=3);
 assert.ok(result.turns[0].lines.some(t=>t.includes('하이에나의 공격')));
 assert.ok(result.turns[2].lines.some(t=>t.includes('찢어 물기')));
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:state,now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.match(html,/고유 스킬 · 찢어 물기/);
 assert.match(html,/3턴마다 공격력 130% 피해/);
});
test('live SQL skill metadata and special/regular attack results equal TypeScript across all monsters',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema private;create role anon;create role authenticated;");
  // The function signature and rounding use the canonical hunting_damage formula.
  await db.exec(`create function private.hunting_damage(p_attack numeric,p_defense numeric,p_multiplier numeric,p_pen numeric) returns numeric language sql immutable as $$
   select greatest(1,floor(greatest(0,p_attack)*p_multiplier*100/(100+greatest(0,p_defense)*(1-greatest(0,least(1,p_pen)))))) $$;`);
  await db.exec(sql().split('CREATE OR REPLACE FUNCTION public.hunt_once')[0]);
  for(const [id,skill] of Object.entries(HUNT_MONSTER_SKILLS)){
   const metadata=(await db.query<{v:unknown}>('select private.hunting_monster_skill_info($1) v',[id])).rows[0].v;
   assert.deepEqual(metadata,skill,id+' metadata');
   for(const turn of [1,2,3,4,6,8,12])for(const guard of [false,true]){
    const expected=resolveMonsterAction(id,'몬스터',turn,42,28,guard,30,100);
    const {rows}=await db.query<{v:any}>('select private.hunting_monster_attack($1,$2,$3::numeric,$4::numeric,$5::boolean,$6::numeric,$7::numeric) v',[id,turn,42,28,guard,30,100]);
    assert.equal(Number(rows[0].v.damage),expected.damage,`${id} turn ${turn} guard=${guard}`);
    assert.equal(Number(rows[0].v.heal),expected.heal,`${id} heal turn ${turn}`);
    assert.equal(rows[0].v.skillName,expected.skillName);
    assert.equal(rows[0].v.hits,expected.hits);
   }
  }
  const check=(await db.query<{v:any}>("select private.hunting_monster_attack('missing',4,30,10,false,30,100) v")).rows[0].v;
  assert.equal(check.skillName,null);
  assert.equal((await db.query<{yes:boolean}>("select has_function_privilege('anon','private.hunting_monster_attack(text,integer,numeric,numeric,boolean,numeric,numeric)','EXECUTE') yes")).rows[0].yes,false);
  const fullSql=sql();
  assert.match(fullSql,/monster:=monster\|\|jsonb_build_object\('skill'/);
  assert.match(fullSql,/monster_action:=private\.hunting_monster_attack/);
  assert.match(fullSql,/monster_action->>'heal'/);
  assert.match(fullSql,/create or replace function private\.hunting_monster_skill_info/);
 }finally{await db.close();}
});
