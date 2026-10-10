import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const uid='11111111-1111-4111-8111-111111111111';
test('skill upgrades charge atomically, persist server-owned levels and replay safely through +3',async()=>{const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${uid}');
 create table public.game_saves(user_id uuid primary key,payload jsonb,app_version text);insert into public.game_saves values('${uid}','{"expedition":null,"learned":["heavy"],"market":{"gold":1000000},"materials":{},"tickets":{}}','0.1.93');
 create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb,updated_at timestamptz,primary key(user_id,item_id));
 create table private.player_wallets(user_id uuid primary key,gold bigint,silver bigint,updated_at timestamptz);insert into private.player_wallets values('${uid}',1000000,0,now());create table private.online_expeditions(user_id uuid,status text);
 create function private.village_life_user(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 or $1 is null then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
 create function private.sync_market_economy_from_latest_save(uuid) returns void language plpgsql as $$begin end$$;
 create function private.cloud_record_json(uuid) returns jsonb language sql as $$select jsonb_build_object('payload',payload) from public.game_saves where user_id=$1$$;
 create function private.persist_client_payload_with_server_economy(uuid,jsonb,text) returns void language plpgsql as $$begin update public.game_saves set payload=private.server_economy_payload($1,$2) where user_id=$1;end$$;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261010064836_skillbook_catalog_learning.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261010071703_catalog_skill_enhancement.sql',import.meta.url),'utf8'));
 const call=async(id:string,expected:number,generation=1)=>(await db.query<{result:any}>(`select public.enhance_catalog_skill($1,$2,'client','device',$3,$4) result`,[uid,generation,id,expected])).rows[0].result;
 await assert.rejects(call('fake',0),/SKILL_UNKNOWN/);await assert.rejects(call('sword_strike_c',0),/SKILL_NOT_LEARNED/);await assert.rejects(call('sword_strike_c',0,2),/GAME_SESSION_LOST/);
 await db.exec(`insert into private.learned_catalog_skills(user_id,skill_id) values('${uid}','sword_strike_c');insert into private.market_assets values('${uid}','skillbook:sword_strike_c',10,null,now());`);
 await assert.rejects(call('sword_strike_c',1),/SKILL_ENHANCEMENT_STALE/);
 let result=await call('sword_strike_c',0);assert.equal(result.enhancements.sword_strike_c,1);assert.equal(result.books.sword_strike_c,8);assert.equal(result.gold,999500);assert.equal(result.record.payload.skillEnhancements.sword_strike_c,1);
 result=await call('sword_strike_c',0);assert.equal(result.books.sword_strike_c,8);assert.equal(result.gold,999500);
 result=await call('sword_strike_c',1);assert.equal(result.enhancements.sword_strike_c,2);assert.equal(result.books.sword_strike_c,5);assert.equal(result.gold,998500);
 result=await call('sword_strike_c',2);assert.equal(result.enhancements.sword_strike_c,3);assert.equal(result.books.sword_strike_c,0);assert.equal(result.gold,996500);
 assert.equal((await call('sword_strike_c',2)).gold,996500);await assert.rejects(call('sword_strike_c',3),/SKILL_MAX_ENHANCEMENT/);
 await assert.rejects(call('sword_strike_c',-1),/SKILL_ENHANCEMENT_STALE/);await assert.rejects(call('sword_strike_c',null as any),/SKILL_ENHANCEMENT_STALE/);
 const canonical=(await db.query<{result:any}>(`select private.server_economy_payload($1,'{"skillEnhancements":{"sword_strike_c":99,"fake":3},"market":{}}') result`,[uid])).rows[0].result;
 assert.deepEqual(canonical.skillEnhancements,{sword_strike_c:3});
 for(const [i,grade] of ['c','b','a','s','sr','ssr'].entries()){
  const id='shield_'+grade;await db.exec(`insert into private.learned_catalog_skills(user_id,skill_id) values('${uid}','${id}');insert into private.market_assets values('${uid}','skillbook:${id}',10,null,now());update private.player_wallets set gold=1000000;`);
  let remaining=1000000;for(let level=0;level<3;level++){remaining-=500*2**i*2**level;const snapshot=await call(id,level);assert.equal(snapshot.gold,remaining);assert.equal(snapshot.enhancements[id],level+1);}
 }
 await db.exec(`insert into private.learned_catalog_skills(user_id,skill_id) values('${uid}','sword_strike_b'),('${uid}','sword_strike_ssr');insert into private.market_assets values('${uid}','skillbook:sword_strike_b',10,null,now()),('${uid}','skillbook:sword_strike_ssr',10,null,now());update private.player_wallets set gold=1000;`);
 await assert.rejects(call('sword_strike_ssr',0),/SKILL_GOLD_EMPTY/);
 await db.exec(`update private.market_assets set quantity=1 where item_id='skillbook:sword_strike_b';`);await assert.rejects(call('sword_strike_b',0),/SKILL_BOOK_EMPTY/);
 await db.exec(`update private.market_assets set quantity=10 where item_id='skillbook:sword_strike_b';insert into private.online_expeditions values('${uid}','ACTIVE');`);await assert.rejects(call('sword_strike_b',0),/SKILL_EXPEDITION_BLOCKED/);await db.exec('delete from private.online_expeditions');
 await db.exec(`create or replace function private.persist_client_payload_with_server_economy(uuid,jsonb,text) returns void language plpgsql as $$begin raise exception 'SAVE_FAILED';end$$;`);await assert.rejects(call('sword_strike_b',0),/SAVE_FAILED/);
 const state=(await db.query<{result:any}>(`select private.skill_book_snapshot($1) result`,[uid])).rows[0].result;assert.equal(state.books.sword_strike_b,10);assert.equal(state.enhancements.sword_strike_b,0);assert.equal(state.gold,1000);
 await db.exec('set role anon');await assert.rejects(call('sword_strike_b',0),/permission denied/);await db.exec('reset role');
 await assert.rejects(db.exec(`update private.learned_catalog_skills set enhancement_level=4 where skill_id='sword_strike_b'`),/check constraint/);
 }finally{await db.close();}});
