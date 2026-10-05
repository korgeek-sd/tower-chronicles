import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {JOB_CATALOG} from '../src/game/jobs/catalog';

test('server selection permits all owned catalog jobs while retaining ownership and expedition guards',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE SCHEMA private; CREATE ROLE anon; CREATE ROLE authenticated;
   CREATE TABLE private.online_expeditions(user_id uuid,status text);
   CREATE TABLE public.game_saves(user_id uuid,payload jsonb);
   CREATE TABLE private.player_job_entitlements(user_id uuid,job_id text);
   CREATE TABLE private.player_job_selection(user_id uuid PRIMARY KEY,current_job_id text,updated_at timestamptz);
   CREATE FUNCTION private.require_active_game_session(uuid,bigint,text,text) RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
   CREATE FUNCTION private.persist_client_payload_with_server_economy(uuid,jsonb,text) RETURNS void LANGUAGE sql AS $$SELECT$$;
   CREATE FUNCTION private.cloud_record_json(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('job',current_job_id) FROM private.player_job_selection WHERE user_id=$1$$;
   INSERT INTO public.game_saves VALUES('00000000-0000-0000-0000-000000000001','{}');`);
  const original=readFileSync(new URL('../supabase/migrations/20260926102000_finalize_server_authority_v0151.sql',import.meta.url),'utf8');
  await db.exec(original.slice(original.indexOf('create or replace function public.select_online_job('),original.indexOf('grant execute on function public.select_online_job')));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261005061203_b_rank_job_selection.sql',import.meta.url),'utf8'));
  const migration=readFileSync(new URL('../supabase/migrations/20261005073737_all_owned_job_selection.sql',import.meta.url),'utf8');
  await db.exec(migration);
  const select=(id:string|null)=>db.query("SELECT public.select_online_job(NULL,1,'client','device',$1) AS result",[id]);
  await assert.rejects(select('executor'),/JOB_NOT_OWNED/);
  for(const job of JOB_CATALOG){
   await db.query("INSERT INTO private.player_job_entitlements VALUES('00000000-0000-0000-0000-000000000001',$1)",[job.id]);
   const r=await select(job.id);assert.deepEqual((r.rows[0] as any).result,{job:job.id});
  }
  await assert.rejects(select('invalid_job'),/JOB_COMBAT_NOT_READY/);
  await select(null);
  await db.exec("INSERT INTO private.online_expeditions VALUES('00000000-0000-0000-0000-000000000001','ACTIVE')");
  await assert.rejects(select('hunter'),/JOB_CHANGE_DURING_EXPEDITION/);
 }finally{await db.close();}
});
