import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {HUNT_MONSTERS,chooseHuntMonster} from '../src/game/hunting/encounters';
import {HUNT_MAPS,resolveHunt,initialHuntingState} from '../src/game/hunting/model';
test('each map uses real art and excludes the immediately previous monster for every draw',()=>{
 for(const map of HUNT_MAPS){const pool=HUNT_MONSTERS[map.id];assert.ok(pool.length>=2);
  for(const monster of pool){assert.ok(existsSync(new URL('../public/'+monster.image,import.meta.url)));for(const draw of [0,.2,.5,.999999])assert.notEqual(chooseHuntMonster(map.id,monster.id,draw).id,monster.id);}
 }
});
test('successive guest hunts always change opponent including failures and map changes, retaining map stats and rewards',()=>{
 let state=initialHuntingState(0),previous='';
 for(const map of HUNT_MAPS)for(let i=0;i<5;i++){
  const r=resolveHunt({...state,vitality:100},map.id,{hp:10000,attack:10000,defense:10000},['heavy'],0,()=>.5);
  assert.notEqual(r.result.monster!.id,previous);assert.equal(r.result.monster!.hp,map.hp);assert.equal(r.result.exp,map.exp);assert.ok(r.result.turns[0].lines.length);previous=r.result.monster!.id;state=r.state;
 }
 const failed=resolveHunt(state,'plains',{hp:1,attack:0,defense:0},[],0,()=>0);
 const next=resolveHunt({...failed.state,vitality:100},'plains',{hp:1,attack:0,defense:0},[],0,()=>0);
 assert.notEqual(failed.result.monster!.id,next.result.monster!.id);
});
test('server encounters match the catalog and exclude previous identities at selection boundaries',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFileSync}=await import('node:fs');const db=new PGlite();
 try{await db.exec('create schema private;create role anon;create role authenticated;');await db.exec(readFileSync(new URL('../supabase/migrations/20261010123745_hunting_varied_encounters.sql',import.meta.url),'utf8').split('create or replace function public.hunt_once')[0]);
 for(const map of HUNT_MAPS)for(const monster of HUNT_MONSTERS[map.id])for(const draw of [0,.5,.999999]){
  const result=(await db.query<{m:any}>('select private.choose_hunting_monster($1,$2,$3) m',[map.id,monster.id,draw])).rows[0].m;
  assert.deepEqual(result,chooseHuntMonster(map.id,monster.id,draw));
 }
 }finally{await db.close();}
});
test('result and battle record render the actual encounter snapshot instead of the map default',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {HuntingScreen}=await import('../src/components/hunting/HuntingScreen');const {initialState}=await import('../src/game/engine/state');
 const base=resolveHunt(initialHuntingState(0),'plains',{hp:10000,attack:30,defense:1000},['heavy'],0,()=>.5).state;
 const actual=resolveHunt({...base,vitality:100},'plains',{hp:10000,attack:30,defense:1000},['heavy'],0,()=>.5).state;
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:actual,now:0,busy:true,onHunt:()=>{},onSettings:()=>{}}));
 assert.ok(html.includes(actual.lastResult!.monster!.image));assert.ok(html.includes(`data-monster-id="${actual.lastResult!.monster!.id}"`));assert.ok(html.includes(`Turn 1 ${actual.lastResult!.monster!.name} HP`));assert.ok(html.includes('새 몬스터 추적 중…'));assert.ok(html.includes('사냥 중…'));
});
test('hunting feedback distinguishes accepted input from server-confirmed completion',async()=>{
 const {resolveGameFeelRecipe}=await import('../src/gameFeel/engine');
 assert.equal(resolveGameFeelRecipe('hunt.start').intensity,'subtle');
 assert.equal(resolveGameFeelRecipe('hunt.result',{outcome:'victory'}).intensity,'normal');
 assert.equal(resolveGameFeelRecipe('hunt.result',{outcome:'victory',grade:'legendary'}).intensity,'exceptional');
});
