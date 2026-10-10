import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters';
import {HUNT_MAPS,initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {monsterSkillAt,resolveMonsterAction,damageOverTime,playerAttackFactor,playerDefenseFactor,blocksPlayerSkill,takeMonsterShield} from '../src/game/hunting/monsterSkills';
const sql=()=>readFileSync(new URL('../supabase/migrations/20261011100000_new_hunting_monsters.sql',import.meta.url),'utf8');
test('all five maps have ten unique NEW monsters with exactly three authored skills',()=>{
 const ids=new Set<string>();const names=new Set<string>();let count=0;
 for(const map of HUNT_MAPS){
  assert.equal(HUNT_MONSTERS[map.id].length,10);
  for(const m of HUNT_MONSTERS[map.id]){
   assert.ok(!ids.has(m.id));ids.add(m.id);assert.ok(!names.has(m.name));names.add(m.name);
   assert.ok(m.image.startsWith('assets/monsters/new/'));
   assert.ok(m.hp>0&&m.attack>0&&m.defense>=0);
   assert.equal(m.skills.length,3);
   for(const s of m.skills){assert.ok(s.name.length>1&&s.power>=0&&s.hits>=1&&s.hits<=3);count++;}
   assert.deepEqual([1,2,3,4,5,6,7,8].map(t=>monsterSkillAt(m,t).name),[0,1,0,2,0,1,0,2].map(i=>m.skills[i].name));
  }
 }
 assert.equal(ids.size,50);assert.equal(count,150);
 for(const old of ['hide_gnawer','wasteland_boar','carrion_vulture','goblin_miner','fang_nest'])assert.equal(ids.has(old),false);
});
test('all three skills affect real guest hunting turns and each monster has its own stats',()=>{
 for(const map of HUNT_MAPS){
  for(const index of [0,4,9]){
   const result=resolveHunt(initialHuntingState(0),map.id,{hp:20000,attack:0,defense:100},[],0,()=>index/10+.001).result;
   const monster=result.monster!;
   assert.equal(monster.hp,HUNT_MONSTERS[map.id][index].hp);
   assert.equal(monster.attack,HUNT_MONSTERS[map.id][index].attack);
   assert.ok(result.turns[0].lines.some(s=>s.includes(monster.skills[0].name)));
   assert.ok(result.turns[1].lines.some(s=>s.includes(monster.skills[1].name)));
   assert.ok(result.turns[3].lines.some(s=>s.includes(monster.skills[2].name)));
  }
 }
});
test('persistent debuffs, damage over time, shield, reflect and skill block are predictable',()=>{
 const m=HUNT_MONSTERS.forest[0];
 const e={bleed:.12,bleedUntil:3,attack_down:.2,attack_downUntil:2,defense_down:.2,defense_downUntil:2,silenceUntil:2,shield:.4,reflect:.2};
 assert.equal(damageOverTime(e,2,18)[0].damage,2);
 assert.equal(damageOverTime(e,4,18).length,0);
 assert.equal(playerAttackFactor(e,2),.8);
 assert.equal(playerDefenseFactor(e,3),1);
 assert.equal(blocksPlayerSkill(e,2),true);
 const impact=takeMonsterShield(50,e);
 assert.equal(impact.hit,30);assert.equal(impact.reflected,6);
 assert.equal(impact.effects.shield,0);
 const action=resolveMonsterAction(m,2,30,false,80,{});
 assert.equal(action.skillName,m.skills[1].name);
 assert.ok(action.effects.attack_down!==undefined || action.effects.shield!==undefined || action.effects.vulnerable!==undefined);
});
test('SQL catalog / deterministic action and client combat calculations agree across 150 skills',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create schema private;create role anon;create role authenticated;");
  await db.exec(`create function private.hunting_damage(p_attack numeric,p_defense numeric,p_multiplier numeric,p_pen numeric) returns numeric language sql immutable as $$
   select greatest(1,floor(greatest(0,p_attack)*p_multiplier*100/(100+greatest(0,p_defense)*(1-greatest(0,least(1,p_pen)))))) $$;`);
  await db.exec(sql().split('CREATE OR REPLACE FUNCTION public.hunt_once')[0]);
  for(const [map,monsters] of Object.entries(HUNT_MONSTERS)){
   for(const monster of monsters){
    const server=(await db.query<{monster:any}>("select item monster from jsonb_array_elements(private.hunting_monster_catalog()->$1) item where item->>'id'=$2",[map,monster.id])).rows[0].monster;
    assert.deepEqual(server,monster);
    for(const turn of [1,2,4])for(const guard of [false,true]){
     const effects={attack_buff:.2,vulnerable:.2};
     const expected=resolveMonsterAction(monster,turn,42,guard,monster.hp-10,effects);
     const r=(await db.query<{action:any}>("select private.hunting_monster_action($1::jsonb,$2,$3::numeric,$4,$5::numeric,$6::jsonb) action",[JSON.stringify(monster),turn,42,guard,monster.hp-10,JSON.stringify(effects)])).rows[0].action;
     assert.equal(Number(r.damage),expected.damage,monster.id+' turn '+turn);
     assert.equal(Number(r.heal),expected.heal,monster.id+' heal');
     assert.equal(r.line,expected.line,monster.id+' text');
     assert.deepEqual(r.effects,expected.effects,monster.id+' effect');
    }
   }
  }
  assert.equal((await db.query<{priv:boolean}>("select has_function_privilege('anon','private.hunting_monster_catalog()','EXECUTE') priv")).rows[0].priv,false);
  assert.ok(sql().includes("private.hunting_monster_action(monster,turn_no"));
 }finally{await db.close();}
});
