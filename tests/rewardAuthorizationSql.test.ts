import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const user='00000000-0000-0000-0000-000000000001',session='00000000-0000-0000-0000-000000000002',lease='00000000-0000-0000-0000-000000000003';
async function setup(){const db=new PGlite();await db.exec(read('./rewardAuthorizationBaseline.sql'));await db.exec(read('../supabase/migrations/20261019124233_reward_session_input_hardening.sql'));await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session})]);await db.query('insert into auth.sessions values ($1,$2)',[session,user]);await db.query("insert into private.active_game_sessions values($1,$2,1,$3,'client','device',now()+interval '1 hour')",[user,lease,session]);return db;}
test('reward session guard rejects each missing lease component and accepts the exact live owner',async()=>{const db=await setup();try{
 const valid=[lease,1,'client','device'];
 assert.equal((await db.query<{u:string}>('select private.require_active_game_session($1,$2,$3,$4) u',valid)).rows[0].u,user);
 for(let i=0;i<4;i++){const args=[...valid];args[i]=null as any;await assert.rejects(db.query('select private.require_active_game_session($1,$2,$3,$4)',args),/GAME_SESSION_LOST/);}
 await assert.rejects(db.query('select private.require_active_game_session($1,2,$2,$3)',[lease,'client','device']),/GAME_SESSION_LOST/);
 await db.query('delete from auth.sessions');await assert.rejects(db.query('select private.require_active_game_session($1,$2,$3,$4)',valid),/AUTH_SESSION_INVALID/);
}finally{await db.close();}});
test('cloud-save guard rejects null lease values before any save mutation',async()=>{const db=await setup();try{
 for(let i=0;i<4;i++){const a:any[]=[lease,1,'client','device'];a[i]=null;await assert.rejects(db.query("select public.save_game_state($1,$2,$3,0,1,'test','{}',null,$4)",a),/GAME_SESSION_LOST/);}
 assert.equal((await db.query<{n:number}>('select count(*)::int n from public.game_saves')).rows[0].n,0);
}finally{await db.close();}});
test('expedition settlement rejects null or unknown outcomes even when no run is present',async()=>{const db=await setup();try{
 for(const outcome of [null,'victory',''])await assert.rejects(db.query('select public.settle_online_expedition_v2($1,1,$2,$3,$4,null)',[lease,'client','device',outcome]),/EXPEDITION_RECEIPT_INVALID/);
 assert.deepEqual((await db.query<{r:any}>('select public.settle_online_expedition_v2($1,1,$2,$3,$4,null) r',[lease,'client','device','returned'])).rows[0].r,{});
}finally{await db.close();}});
