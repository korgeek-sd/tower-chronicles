import test from 'node:test';import assert from 'node:assert/strict';
import {rollHuntingEquipment,HUNT_EQUIPMENT_RATES} from '../src/game/hunting/equipmentDrops';
import {EQUIPMENT_GRADES,EQUIPMENT_DEFINITIONS} from '../src/game/data/equipment';
import {resolveHunt,initialHuntingState} from '../src/game/hunting/model';
test('confirmed absolute probabilities partition one draw into at most one grade',()=>{
 assert.deepEqual(HUNT_EQUIPMENT_RATES.ruins,[13000,4500,1600,350,116]);
 for(const [map,rates]of Object.entries(HUNT_EQUIPMENT_RATES)){
  let start=0;
  for(const [i,rate]of rates.entries()){if(rate){assert.equal(rollHuntingEquipment(map as any,start,0)?.grade,EQUIPMENT_GRADES[i]);assert.equal(rollHuntingEquipment(map as any,start+rate-1,8)?.grade,EQUIPMENT_GRADES[i]);}start+=rate;}
  assert.equal(rollHuntingEquipment(map as any,start,0),null);assert.equal(rollHuntingEquipment(map as any,999999,0),null);
 }
});
test('every grade samples all nine kinds without weighting and always starts at +0',()=>{
 const kinds=Object.keys(EQUIPMENT_DEFINITIONS);
 for(let index=0;index<9;index++){const item=rollHuntingEquipment('ruins',19450,index)!;assert.equal(item.kind,kinds[index]);assert.equal(item.grade,'legendary');assert.equal(item.enhancement,0);assert.ok(item.id);}
});
test('victory returns one equipment reward; defeat returns none',()=>{
 const win=resolveHunt(initialHuntingState(0),'plains',{hp:1000,attack:10000,defense:1000},['heavy'],0,()=>0);
 assert.equal(win.result.equipment?.grade,'common');
 const lose=resolveHunt(initialHuntingState(0),'plains',{hp:1,attack:0,defense:0},[],0,()=>0);
 assert.equal(lose.result.equipment,null);
});
test('SQL grade boundaries and nine kinds match the client without exposing the helper',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFileSync}=await import('node:fs');const db=new PGlite();
 try{
  await db.exec('create schema private;create role anon;create role authenticated;');
  const sql=readFileSync(new URL('../supabase/migrations/20261010122549_hunting_equipment_drops.sql',import.meta.url),'utf8').split('create or replace function public.hunt_once')[0];await db.exec(sql);
  for(const [map,rates]of Object.entries(HUNT_EQUIPMENT_RATES)){
   let start=0;for(const [index,rate]of rates.entries()){
    if(rate)for(const roll of [start,start+rate-1]){const item=(await db.query<{item:any}>('select private.hunting_equipment_drop($1,$2,0) item',[map,roll])).rows[0].item;assert.equal(item.grade,EQUIPMENT_GRADES[index]);}start+=rate;
   }
   assert.equal((await db.query<{item:any}>('select private.hunting_equipment_drop($1,$2,0) item',[map,start])).rows[0].item,null);
  }
  for(let i=0;i<9;i++){const item=(await db.query<{item:any}>("select private.hunting_equipment_drop('ruins',19450,$1) item",[i])).rows[0].item;assert.equal(item.kind,Object.keys(EQUIPMENT_DEFINITIONS)[i]);assert.equal(item.enhancement,0);}
  assert.equal((await db.query<{ok:boolean}>("select has_function_privilege('authenticated','private.hunting_equipment_drop(text,integer,integer)','EXECUTE') ok")).rows[0].ok,false);
 }finally{await db.close();}
});
