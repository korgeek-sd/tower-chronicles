import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const u='11111111-1111-4111-8111-111111111111',req='22222222-2222-4222-8222-222222222222';
test('order receipt and escrow charge commit once, reject conflicting replays, and roll back together',async()=>{const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;
 create table auth.users(id uuid primary key);insert into auth.users values('${u}');
 create table private.test_wallet(user_id uuid primary key,silver bigint);insert into private.test_wallet values('${u}',1000);
 create table private.test_orders(id bigint generated always as identity,user_id uuid);
 create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2 is distinct from 1::bigint then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
 create function private.market_state_json(uuid) returns jsonb language sql as $$select jsonb_build_object('silver',silver,'orders',(select count(*) from private.test_orders where user_id=$1)) from private.test_wallet where user_id=$1$$;
 create function public.place_online_market_order(uuid,bigint,text,text,text,text,bigint,bigint) returns jsonb language plpgsql as $$begin
 if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;
 if (select silver from private.test_wallet where user_id=$1)<$7*$8 then raise exception 'INSUFFICIENT_SILVER';end if;
 update private.test_wallet set silver=silver-$7*$8 where user_id=$1;insert into private.test_orders(user_id) values($1);
 if current_setting('test.fail_after_charge',true)='yes' then raise exception 'AFTER_CHARGE';end if;
 return private.market_state_json($1);end$$;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261019130426_market_order_request_receipts.sql',import.meta.url),'utf8'));
 const call=async(id=req,qty=2,generation=1,side:string|null='BUY')=>(await db.query<{r:any}>("select public.place_online_market_order_v2($1,$2,'client','device',$3,'ticket:ore:1',$4,10,$5) r",[u,generation,id,side,qty])).rows[0].r;
 assert.deepEqual(await call(),{silver:980,orders:1});assert.deepEqual(await call(),{silver:980,orders:1});
 await assert.rejects(call(req,3),/MARKET_REQUEST_CONFLICT/);await assert.rejects(call(req,2,2),/GAME_SESSION_LOST/);await assert.rejects(call(req,2,1,null),/MARKET_SIDE_INVALID/);await assert.rejects(call(null as any),/MARKET_REQUEST_REQUIRED/);
 await db.exec("set test.fail_after_charge='yes'");const failed='33333333-3333-4333-8333-333333333333';await assert.rejects(call(failed),/AFTER_CHARGE/);
 assert.equal((await db.query<any>('select count(*)::int n from private.market_order_requests')).rows[0].n,1);assert.deepEqual(await call(),{silver:980,orders:1});
 await db.exec("set test.fail_after_charge='no'");assert.deepEqual(await call(failed),{silver:960,orders:2});
 const perms=(await db.query<any>("select has_table_privilege('authenticated','private.market_order_requests','SELECT') readable,has_function_privilege('anon','public.place_online_market_order_v2(uuid,bigint,text,text,uuid,text,text,bigint,bigint)','EXECUTE') callable")).rows[0];assert.equal(perms.readable,false);assert.equal(perms.callable,false);
 }finally{await db.close();}});
