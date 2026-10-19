import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const sessions=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
const client='11111111-1111-4111-8111-111111111111';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
 create table auth.users(id uuid primary key);insert into auth.users values('${user}'),('${other}');
 create table auth.sessions(id uuid primary key,user_id uuid);insert into auth.sessions values ${sessions.map(id=>`('${id}','${user}')`).join(',')};
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
 create table private.active_game_sessions(user_id uuid primary key,auth_session_id uuid,client_instance_id text,expires_at timestamptz);
 create table private.websocket_connection_leases(user_id uuid references auth.users(id),auth_session_id uuid,client_instance_id text,socket_kind text,platform text,connected_at timestamptz,updated_at timestamptz,expires_at timestamptz,primary key(user_id,auth_session_id,client_instance_id,socket_kind));
 revoke all on private.websocket_connection_leases from public,anon,authenticated;
 select set_config('test.uid','${user}',false),set_config('test.session','${sessions[0]}',false);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261019110000_presence_limits.sql',import.meta.url),'utf8'));
 return db;
}
const presence=(db:PGlite,id:string|null=client,kind:string|null='session',connected:boolean|null=true)=>db.query('select public.set_websocket_presence($1,$2,$3,$4)',[id,kind,'Web',connected]);
const count=async(db:PGlite)=>Number((await db.query<any>('select count(*) n from private.websocket_connection_leases')).rows[0].n);

test('presence rejects invalid authentication, null inputs, large IDs and unowned gameplay clients',async()=>{
 const db=await fixture();try{
  for(const id of [null,'','short','x'.repeat(81),'invalid space here'])await assert.rejects(()=>presence(db,id),/WEBSOCKET_PRESENCE_INVALID/);
  await assert.rejects(()=>presence(db,client,null),/WEBSOCKET_PRESENCE_INVALID/);
  await assert.rejects(()=>presence(db,client,'session',null),/WEBSOCKET_PRESENCE_INVALID/);
  await assert.rejects(()=>presence(db,client,'chat'),/GAME_SESSION_LOST/);
  await db.exec(`insert into private.active_game_sessions values('${user}','${sessions[0]}','${client}',now()+interval '90 seconds')`);
  await presence(db,client,'chat');await presence(db,client,'market');assert.equal(await count(db),2);
  await db.exec(`select set_config('test.uid','${other}',false)`);
  await assert.rejects(()=>presence(db),/AUTH_SESSION_INVALID/);
  await db.exec("select set_config('test.uid','',false)");await assert.rejects(()=>presence(db),/AUTH_REQUIRED/);
 }finally{await db.close();}
});

test('presence caps each session at six and each account at twelve while allowing existing renewals',async()=>{
 const db=await fixture();try{
  for(let s=0;s<2;s++){
   await db.exec(`select set_config('test.session','${sessions[s]}',false)`);
   for(let i=0;i<6;i++)await presence(db,`client-number-${s}-${i}-valid`);
   await assert.rejects(()=>presence(db,`client-number-${s}-overflow`),/WEBSOCKET_PRESENCE_LIMIT/);
  }
  assert.equal(await count(db),12);await presence(db,'client-number-1-0-valid');assert.equal(await count(db),12);
  await db.exec(`select set_config('test.session','${sessions[2]}',false)`);
  await assert.rejects(()=>presence(db,'client-third-session-valid'),/WEBSOCKET_PRESENCE_LIMIT/);
  assert.equal(await count(db),12);
 }finally{await db.close();}
});

test('presence rate window permits normal renewals, caps writes, then resets and removes expired rows',async()=>{
 const db=await fixture();try{
  for(let i=0;i<60;i++)await presence(db);
  await assert.rejects(()=>presence(db),/WEBSOCKET_PRESENCE_RATE_LIMIT/);assert.equal(await count(db),1);
  await db.exec("update private.websocket_presence_limits set window_started_at=now()-interval '61 seconds';update private.websocket_connection_leases set expires_at=now()-interval '1 second'");
  await presence(db,'new-client-after-expiry');assert.equal(await count(db),1);
  await presence(db,'new-client-after-expiry','session',false);assert.equal(await count(db),0);
  const perms=(await db.query<any>("select has_table_privilege('authenticated','private.websocket_presence_limits','INSERT') direct,has_function_privilege('anon','public.set_websocket_presence(text,text,text,boolean)','EXECUTE') anon,has_function_privilege('authenticated','public.set_websocket_presence(text,text,text,boolean)','EXECUTE') member")).rows[0];
  assert.equal(perms.direct,false);assert.equal(perms.anon,false);assert.equal(perms.member,true);
 }finally{await db.close();}
});

test('disconnect is scoped to the caller session and cannot remove another session row',async()=>{
 const db=await fixture();try{
  await presence(db);await db.exec(`select set_config('test.session','${sessions[1]}',false)`);
  await presence(db,client,'session',false);assert.equal(await count(db),1);
 }finally{await db.close();}
});
