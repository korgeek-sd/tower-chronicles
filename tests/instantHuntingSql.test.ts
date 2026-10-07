import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const user='11111111-1111-4111-8111-111111111111',request='22222222-2222-4222-8222-222222222222';
const sql=()=>readFileSync(new URL('../supabase/migrations/20261007130000_instant_hunting.sql',import.meta.url),'utf8');
test('server hunting is atomic, idempotent, validates vitality/map/session and persists rewards',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create table auth.users(id uuid primary key);create table public.game_saves(user_id uuid primary key,payload jsonb);
 create table private.online_expeditions(user_id uuid,status text);create table private.player_wallets(user_id uuid primary key,silver bigint,updated_at timestamptz);
 create table private.market_assets(user_id uuid,item_id text,quantity bigint,updated_at timestamptz,primary key(user_id,item_id));
 create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
 create function private.sync_market_economy_from_latest_save(uuid) returns void language sql as $$select$$;
 create function private.combat_equipment_stats(uuid,jsonb) returns jsonb language sql as $$select '{"hp":180,"attack":18,"defense":7,"weapon":"sword","critChance":0.05}'::jsonb$$;
 create function private.persist_client_payload_with_server_economy(uuid,jsonb,text) returns bigint language sql as $$select 1::bigint$$;
 create function private.cloud_record_json(uuid) returns jsonb language sql as $$select jsonb_build_object('revision',1)$$;
 insert into auth.users values('${user}');insert into public.game_saves values('${user}','{"equipped":{},"expedition":null}');insert into private.player_wallets values('${user}',0,now());`);
 await db.exec(sql());
 const body=(await db.query<{definition:string}>("select pg_get_functiondef('public.hunt_once(uuid,bigint,text,text,uuid,text)'::regprocedure) definition")).rows[0].definition;
 assert.ok(body.indexOf('from public.game_saves where user_id=u for update')<body.indexOf('perform private.sync_market_economy_from_latest_save(u)'),'save lock must precede wallet sync');
 const hunt=async(id:string,map='plains',generation=1)=>(await db.query<{r:any}>(`select public.hunt_once($1::uuid,$2::bigint,'c','d',$3::uuid,$4::text) r`,[user,generation,id,map])).rows[0].r;
 const r=await hunt(request);assert.equal(r.state.vitality,99);assert.equal(r.result.outcome,'victory');assert.equal(r.result.monsterHp,0);assert.ok(r.result.turns.some((t:any)=>t.lines.some((l:string)=>l.includes('강타'))));
 const replay=await hunt(request);assert.equal(replay.replayed,true);assert.equal(replay.state.vitality,99);
 assert.equal((await db.query<{silver:number}>('select silver::integer from private.player_wallets')).rows[0].silver,35);
 await assert.rejects(()=>hunt(request,'mine'),/REQUEST_CONFLICT/);
 await assert.rejects(()=>hunt('33333333-3333-4333-8333-333333333333','bad'),/HUNT_MAP_INVALID/);
 await assert.rejects(()=>hunt(request,'plains',2),/GAME_SESSION_LOST/);
 await db.exec(`update private.hunting_states set vitality=0,recovered_at=now();`);
 await assert.rejects(()=>hunt('44444444-4444-4444-8444-444444444444'),/VITALITY_EMPTY/);
 assert.equal((await db.query<{silver:number}>('select silver::integer from private.player_wallets')).rows[0].silver,35);
 await db.exec(`update private.hunting_states set vitality=98,recovered_at=now()-interval '11 minutes';`);
 const recovered=(await db.query<{r:any}>(`select public.get_hunting_state('${user}',1,'c','d') r`)).rows[0].r;assert.equal(recovered.vitality,100);
 await db.exec(`insert into private.online_expeditions values('${user}','ACTIVE');`);
 await assert.rejects(()=>hunt('55555555-5555-4555-8555-555555555555'),/HUNT_EXPEDITION_ACTIVE/);
 assert.equal((await db.query<{allowed:boolean}>(`select has_function_privilege('anon','public.hunt_once(uuid,bigint,text,text,uuid,text)','EXECUTE') allowed`)).rows[0].allowed,false);
 }finally{await db.close();}
});
