import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('premium purchase charges once, extends, rejects insufficient funds and settles daily tickets once',async()=>{
 const db=new PGlite(),u='11111111-1111-4111-8111-111111111111',r='22222222-2222-4222-8222-222222222222';
 try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${u}');create function auth.uid() returns uuid language sql as $$select '${u}'::uuid$$;
 create table public.game_saves(user_id uuid primary key,payload jsonb);insert into public.game_saves values('${u}','{"expedition":null}');create table private.player_wallets(user_id uuid primary key,gold bigint,updated_at timestamptz);insert into private.player_wallets values('${u}',2500,now());create table private.appearance_ticket_wallets(user_id uuid primary key,quantity bigint);
 create function private.village_life_user(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;return auth.uid();end$$;
 create function private.sync_market_economy_from_latest_save(uuid) returns void language plpgsql as $$begin end$$;create function private.persist_market_economy_to_save(uuid) returns void language plpgsql as $$begin end$$;create function private.cloud_record_json(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;`);
 await db.exec(readFileSync(new URL('../supabase/premium-account.sql',import.meta.url),'utf8').split('-- Integration')[0]);
 const buy=async(id:string,g=1)=>(await db.query<any>(`select public.buy_premium_account($1, $2, 'client','device',$3) value`,[u,g,id])).rows[0].value;
 await assert.rejects(()=>buy(r,2),/GAME_SESSION_LOST/);
 const first=await buy(r);assert.equal(first.gold,1500);assert.equal(first.active,true);
 assert.equal((await buy(r)).expiresAt,first.expiresAt);assert.equal((await buy(r)).gold,1500);
 const second=await buy('33333333-3333-4333-8333-333333333333');assert.equal(second.gold,500);assert.equal(second.expiresAt-first.expiresAt,30*86400000);
 await assert.rejects(()=>buy('44444444-4444-4444-8444-444444444444'),/PREMIUM_GOLD_SHORTAGE/);
 await db.exec(`update private.premium_accounts set next_reward_at=now()-interval '2 days';select private.settle_premium_rewards('${u}');select private.settle_premium_rewards('${u}');`);
 assert.equal(Number((await db.query<any>('select quantity from private.appearance_ticket_wallets')).rows[0].quantity),15);
 assert.equal((await db.query<any>(`select private.premium_fee_bps('${u}') fee`)).rows[0].fee,500);
 await db.exec(`update private.premium_accounts set expires_at=now()-interval '1 second'`);
 assert.equal((await db.query<any>(`select private.premium_fee_bps('${u}') fee`)).rows[0].fee,1000);
 assert.equal((await db.query<any>(`select has_function_privilege('anon','public.buy_premium_account(uuid,bigint,text,text,uuid)','EXECUTE') ok`)).rows[0].ok,false);
 }finally{await db.close();}
});
