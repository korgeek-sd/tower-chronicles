import test from 'node:test';
import assert from 'node:assert/strict';
import * as seal from '../src/game/seal';
// Official basic table, rows 1–30. Basis points preserve 0.45% / 0.75% exactly.
export const expectedWeights=[
 [6250,3300,450],[6450,3100,450],[6650,2900,450],[6850,2700,450],
 [7050,2500,450],[7250,2300,450],[7450,2100,450],[7650,1900,450],
 [7950,1700,350],[8150,1500,350],[8350,1300,350],[8550,1100,350],
 [8650,1000,350],[8750,900,350],[8850,800,350],[8850,800,350],
 [8850,800,350],[8950,800,250],[8950,800,250],[8950,800,250],
 [8950,800,250],[9150,700,150],[9150,700,150],[9150,700,150],
 [9350,500,150],[9600,300,100],[9700,200,100],[9805,150,45],
 [9925,75,0],[10000,0,0],
];
test('both seals display the next-stage basic table, including fractional percentages and cap',()=>{
 assert.equal(typeof seal.associationSealProbabilities,'function');
 for(let level=0;level<30;level++){
  const rates=seal.associationSealProbabilities(level);
  assert.deepEqual(rates.map(row=>row.rate*100),expectedWeights[level]);
  assert.equal(rates.reduce((sum,row)=>sum+Math.round(row.rate*100),0),10000);
  assert.deepEqual(rates.map(row=>row.step),[1,2,3]);
 }
 assert.deepEqual(seal.associationSealProbabilities(30),seal.associationSealProbabilities(29));
});

import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync('supabase/migrations/20261028084402_seal_stage_probabilities.sql','utf8');
const user='11111111-1111-4111-8111-111111111111';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema private;create role anon;create role authenticated;create role service_role;
 create table public.game_saves(user_id uuid primary key,payload jsonb default '{}');
 create table private.player_wallets(user_id uuid primary key,gold bigint,updated_at timestamptz);
 create table private.online_expeditions(user_id uuid,status text);
 create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin
  if $1 is null then raise exception 'GAME_SESSION_LOST';end if;return '${user}'::uuid;end;$$;
 create function private.sync_market_economy_from_latest_save(uuid) returns void language sql as $$select;$$;
 create function private.persist_client_payload_with_server_economy(uuid,jsonb,text) returns void language plpgsql as $$begin
  if current_setting('test.persist_failure',true)='on' then raise exception 'TEST_PERSIST_FAILURE';end if;end;$$;
 create function private.cloud_record_json(uuid) returns jsonb language sql as $$select '{}'::jsonb;$$;
 insert into public.game_saves(user_id) values('${user}');
 insert into private.player_wallets(user_id,gold) values('${user}',30000);`);
 for(const id of ['association','guardian'])await db.exec(`
 create table private.player_${id}_seals(user_id uuid primary key,level smallint default 0,rolls_used smallint default 0,reset_count integer default 0,updated_at timestamptz);
 create table private.${id}_seal_roll_requests(user_id uuid,request_id uuid,step smallint,before_level smallint,after_level smallint,gold_cost bigint,primary key(user_id,request_id));
 create function private.${id}_seal_state_json(uuid) returns jsonb language sql as $$
 select jsonb_build_object('level',level,'rollsUsed',rolls_used) from private.player_${id}_seals where user_id=$1;$$;
 insert into private.player_${id}_seals(user_id) values('${user}');`);
 await db.exec(migration);
 return db;
}
async function draw(db:PGlite,level:number){return (await db.query<{step:number}>('select private.association_seal_draw_step($1) step',[level])).rows[0].step;}
async function forge(db:PGlite,id:string,request=crypto.randomUUID()){
 return (await db.query<{result:any}>(`select public.roll_${id}_seal($1,1,'client','device',$2) result`,[user,request])).rows[0].result;
}

test('live SQL table matches all thirty client rows; seeded draw is reproducible and preserves zero rates',async()=>{
 const db=await fixture();try{
  const rows=(await db.query<{level:number;weights:number[]}>('select n as level,private.association_seal_probability_weights(n) weights from generate_series(0,29) n')).rows;
  assert.deepEqual(rows.map(r=>r.weights),expectedWeights);
  await db.exec('select setseed(0.2810)');const first=[];for(let n=0;n<60;n++)first.push(await draw(db,n%30));
  await db.exec('select setseed(0.2810)');const second=[];for(let n=0;n<60;n++)second.push(await draw(db,n%30));
  assert.deepEqual(second,first);
  const counts=(await db.query<{level:number;step:number;count:number}>('select level,step,count(*)::int count from (select n as level,private.association_seal_draw_step(n) step from generate_series(0,29) n cross join generate_series(1,10000) trial) draws group by level,step')).rows;
  for(let level=0;level<30;level++)for(let step=1;step<=3;step++){
   const count=counts.find(r=>r.level===level&&r.step===step)?.count??0;
   const p=expectedWeights[level][step-1]/10000;
   if(p===0||p===1)assert.equal(count,p*10000);
   else assert.ok(Math.abs(count-p*10000)<7*Math.sqrt(10000*p*(1-p))+2,`level=${level} step=${step} count=${count}`);
  }
  const privileges=(await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','private.association_seal_draw_step(integer)','execute') allowed")).rows[0];
  assert.equal(privileges.allowed,false);
 }finally{await db.close();}
});

test('both RPCs use the locked current level, debit once, replay safely and retain limits',async()=>{
 const db=await fixture();try{
  // Replace only the RNG input in this isolated test database; production keeps random().
  const def=(await db.query<{definition:string}>("select pg_get_functiondef('private.association_seal_draw_step(integer)'::regprocedure) definition")).rows[0].definition;
  assert.equal((def.match(/random\(\)/g)||[]).length,1);
  await db.exec(def.replace('random()',"current_setting('test.seal_roll')::double precision"));
  for(const id of ['association','guardian']){
   for(let level=0;level<30;level++){
    const [one,two]=expectedWeights[level];
    const points=new Set([0,(one-0.5)/10000,one/10000,(one+two-0.5)/10000,(one+two)/10000,0.999999]);
    for(const roll of points){
     if(roll<0||roll>=1)continue;
     await db.query("select set_config('test.seal_roll',$1,false)",[String(roll)]);
     await db.exec(`update private.player_${id}_seals set level=${level},rolls_used=0;update private.player_wallets set gold=30000;`);
     const request=crypto.randomUUID(),r=await forge(db,id,request);
     const step=roll<one/10000?1:roll<(one+two)/10000?2:3;
     assert.equal(r.step,step);assert.equal(r.beforeLevel,level);assert.equal(r.afterLevel,level+step);
     assert.equal(r.state.rollsUsed,1);assert.equal(r.goldCost,300);
     const replay=await forge(db,id,request);assert.equal(replay.replayed,true);assert.equal(replay.step,step);
     assert.equal(Number((await db.query<{gold:number}>('select gold from private.player_wallets')).rows[0].gold),29700);
    }
   }
   await db.exec(`update private.player_${id}_seals set level=0,rolls_used=20;`);
   await assert.rejects(()=>forge(db,id),/SEAL_ROLL_LIMIT/);
   await db.exec(`update private.player_${id}_seals set level=30,rolls_used=0;`);
   await assert.rejects(()=>forge(db,id),/SEAL_COMPLETED/);
   await db.exec(`update private.player_${id}_seals set level=0;update private.player_wallets set gold=299;`);
   await assert.rejects(()=>forge(db,id),/SEAL_GOLD_SHORTAGE/);
   await db.exec("update private.player_wallets set gold=30000;select set_config('test.persist_failure','on',false)");
   await assert.rejects(()=>forge(db,id),/TEST_PERSIST_FAILURE/);
   assert.equal(Number((await db.query<{gold:number}>('select gold from private.player_wallets')).rows[0].gold),30000);
   assert.equal((await db.query<{level:number}>(`select level from private.player_${id}_seals`)).rows[0].level,0);
   await db.exec("select set_config('test.persist_failure','off',false)");
  }
 }finally{await db.close();}
});
