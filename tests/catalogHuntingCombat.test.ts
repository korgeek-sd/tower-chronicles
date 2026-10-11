import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SKILL_TREE_CATALOG} from '../src/game/skills/catalog';
import {initialHuntingState,resolveHunt,normalizeStatAllocation,usedStatPoints} from '../src/game/hunting/model';
import {catalogSkill,validSkillForWeapon,validateCombatPreset,maxHuntingMp,castCatalogSkill,initialCatalogCombat,applyCatalogTurnStart,takeCatalogMonsterDamage,HUNT_ACTIVE_SLOTS,HUNT_PASSIVE_SLOTS} from '../src/game/hunting/catalogCombat';
import sqlCatalog from '../src/game/hunting/catalogSkillSpecs.json' with {type:'json'};
const sql=readFileSync(new URL('../supabase/migrations/20261011194500_hunting_catalog_combat.sql',import.meta.url),'utf8');

test('all 80 learned skill definitions share exact MP, grade, power and weapon with the server catalog',()=>{
 assert.equal(SKILL_TREE_CATALOG.length,80);
 assert.equal(HUNT_ACTIVE_SLOTS,6);assert.equal(HUNT_PASSIVE_SLOTS,3);
 assert.equal(Object.keys(sqlCatalog).length,80);
 for(const skill of SKILL_TREE_CATALOG){
  const spec=(sqlCatalog as Record<string,{mp:number;power:number;weapon:string;type:string;chance:number;family:string}>)[skill.id];
  assert.ok(spec,'server skill missing: '+skill.id);
  assert.equal(spec.mp,skill.mp,skill.id);
  assert.equal(spec.power,Number.parseFloat(skill.power),skill.id);
  assert.equal(spec.weapon,skill.weapon,skill.id);
  assert.equal(spec.type,skill.type,skill.id);
  assert.equal(spec.chance,skill.chance,skill.id);
  assert.equal(spec.family,skill.family,skill.id);
  assert.equal(catalogSkill(skill.id)?.name,skill.name);
 }
 assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='active').length,60);
 assert.equal(SKILL_TREE_CATALOG.filter(s=>s.type==='passive').length,20);
 assert.ok(sql.includes('create or replace function private.hunting_skill_spec('));
 assert.ok(sql.includes('not exists(select 1 from private.learned_catalog_skills'));
 assert.ok(sql.includes('p_skills is null or cardinality(p_skills)>9'));
});
test('preset rejects unlearned, duplicate and incompatible weapon skills, accepts 6 active 3 passive',()=>{
 const learned=['sword_strike_c','shield_c','heal_c','restore_c','prepare_c','sword_wound_c','sword_mastery_c','return_oath_ssr','sixth_mark_ssr'];
 assert.ok(validateCombatPreset(learned,learned,'sword'));
 assert.ok(!validateCombatPreset([...learned,'heavy'],learned,'sword'));
 assert.ok(!validateCombatPreset(['staff_flame_c'],learned,'sword'));
 assert.ok(!validateCombatPreset(['sword_strike_b'],learned,'sword'));
 assert.ok(!validateCombatPreset(['sword_strike_c','sword_strike_c'],learned,'sword'));
 assert.ok(validSkillForWeapon(catalogSkill('shield_c')!,'staff'));
 assert.ok(!validSkillForWeapon(catalogSkill('bow_shot_c')!,'sword'));
});
test('MP starts full on each new battle; high-cost skill spends MP without passive per-turn regeneration',()=>{
 const input={hp:500,attack:10,defense:100};
 const before={...initialHuntingState(0),skills:['sword_strike_ssr']};
 const battle=resolveHunt(before,'plains',input,before.skills,0,()=>.5,{},'sword');
 assert.equal(battle.result.playerMaxMp,100);
 assert.equal(battle.result.playerMp,100,'skill requiring 170 MP should be skipped');
 const skilled=resolveHunt({...before,statAllocation:{...before.statAllocation!,mp:10}},'plains',input,before.skills,0,()=>.5,{},'sword');
 assert.equal(skilled.result.playerMaxMp,200);
 assert.ok(skilled.result.turns.some(t=>t.lines.some(l=>l.includes('종언의 참격'))));
 assert.ok((skilled.result.turns[0].playerMp??200)<=30);
 const another=resolveHunt(skilled.state,'plains',input,before.skills,0,()=>.5,{},'sword');
 assert.equal(another.result.playerMaxMp,200);
 assert.ok(another.result.turns.some(t=>t.lines.some(l=>l.includes('종언의 참격'))),'fresh hunt refills MP');
 assert.equal(maxHuntingMp(normalizeStatAllocation({mp:10})),200);
 assert.equal(usedStatPoints(normalizeStatAllocation({mp:10})),10);
});
test('all active families cast using their authored MP cost, and restoration obeys cap',()=>{
 const p={hp:300,attack:90,defense:20,critChance:0,critDamage:1.5,armorPenetration:0};
 for(const family of ['sword_strike','sword_wound','bow_shot','bow_volley','staff_flame','staff_rift','shield','heal','restore','prepare']){
  const skill=catalogSkill(family+'_b')!;
  let state=initialCatalogCombat(p,200,[],{},skill.weapon);
  state.monsterHp=1000;state.hp=family==='heal'?100:state.hp;state.mp=family==='restore'?60:200;
  const cast=castCatalogSkill(skill.id,2,1,state,p,15,()=>0.5);
  assert.ok(cast,skill.id);
  if(family!=='restore')assert.equal(cast!.state.mp,state.mp-skill.mp,skill.id);
  if(family==='restore')assert.ok(cast!.state.mp>state.mp&&cast!.state.mp<=200);
  if(['sword_strike','sword_wound','bow_shot','bow_volley','staff_flame','staff_rift'].includes(family))assert.ok(cast!.hit>0);
  if(family==='heal')assert.ok(cast!.state.hp>state.hp);
  if(family==='shield')assert.ok(cast!.state.shield>0);
  if(family==='prepare')assert.ok(cast!.state.prep>0);
 }
});
test('three passive mechanics: mastery, once-only survival, sixth active restores 80 MP',()=>{
 const p={hp:300,attack:50,defense:20,critChance:0,critDamage:1.5,armorPenetration:0};
 let s=initialCatalogCombat(p,100,['sword_mastery_sr','return_oath_ssr','sixth_mark_ssr'],{},'sword');
 assert.ok(s.passiveDamage>.1);assert.ok(s.maxHp>300);assert.ok(s.oathAvailable);assert.ok(s.sixthMark);
 s.monsterHp=3000;s.mp=90;s.activeCount=5;
 const cast=castCatalogSkill('sword_strike_c',0,1,s,p,30,()=>.5)!;
 assert.equal(cast.state.mp,100);
 assert.equal(cast.state.activeCount,6);
 const lethal=takeCatalogMonsterDamage({...cast.state,shield:0},20000,1);
 assert.equal(lethal.state.hp,1);assert.ok(!lethal.state.oathAvailable);assert.ok(lethal.state.shield>0);
 assert.equal(takeCatalogMonsterDamage(lethal.state,20000,5).state.hp,0);
 const bleeding=applyCatalogTurnStart({...s,monsterDot:22,monsterDotUntil:3,monsterHp:90},2);
 assert.equal(bleeding.monsterHp,68);
});
test('server uses authenticated learned records and atomic receipts; there is no MP potion',()=>{
 for(const word of ['public.hunt_once','private.learned_catalog_skills','public.save_hunting_preset','private.refresh_hunting_state','current_mp=mp_now','mp_now:=mp_max','private.hunting_monster_action','private.hunting_equipment_drop','private.hunting_stat_reset_receipts','maxMp'])assert.ok(sql.includes(word),word);
 assert.ok(!sql.includes('MP 포션'));
});
