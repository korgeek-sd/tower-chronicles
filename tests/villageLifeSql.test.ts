import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const u='11111111-1111-4111-8111-111111111111',v='66666666-6666-4666-8666-666666666666';
const migration=new URL('../supabase/migrations/20261007163810_village_life.sql',import.meta.url);
test('village life validates session/location, persists stock/materials, replays safely and resets at Seoul midnight',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);
 create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
 insert into auth.users values('${u}'),('${v}');`);
 await db.exec(readFileSync(migration,'utf8'));
 const call=async(name:string,user=u,args:any[]=[])=>{const params=[user,1,'c','d',...args];return (await db.query<{r:any}>(`select public.${name}(${params.map((_,i)=>'$'+(i+1)).join(',')}) r`,params)).rows[0].r;};
 const get=()=>call('get_village_life');const travel=(id:string)=>call('travel_village',u,[id]);
 let n=0;const gather=(id:string,resource='herb',count=1,request=`22222222-2222-4222-8222-${String(++n).padStart(12,'0')}`,user=u)=>call('gather_village',user,[request,id,resource,count]);
 let s=await get();assert.equal(s.location,'city');assert.equal(s.actionPoints,100);assert.equal(s.towns.length,11);
 await assert.rejects(()=>gather('herb-1'),/LOCATION_MISMATCH/);
 await assert.rejects(()=>travel('bad'),/TOWN_INVALID/);
 await travel('herb-1');assert.equal((await get()).location,'herb-1');
 await assert.rejects(()=>gather('herb-1','farm'),/RESOURCE_INVALID/);
 await assert.rejects(()=>gather('herb-1','herb',0),/COUNT_INVALID/);
 const req='33333333-3333-4333-8333-333333333333';const r=await gather('herb-1','herb',10,req);
 assert.equal(r.state.actionPoints,90);assert.equal(r.state.materials.herb,100);assert.equal(r.result.gains.herb,100);
 assert.equal(r.state.towns.find((t:any)=>t.id==='herb-1').herbRemaining,29900);
 await travel('city');const replay=await gather('herb-1','herb',10,req);assert.equal(replay.replayed,true);assert.equal(replay.state.location,'city');assert.equal(replay.state.materials.herb,100);
 await assert.rejects(()=>gather('herb-1','herb',1,req),/REQUEST_CONFLICT/);
 await call('travel_village',v,['herb-1']);const other=await gather('herb-1','herb',1,undefined,v);assert.equal(other.state.towns.find((t:any)=>t.id==='herb-1').herbRemaining,29890);
 await db.exec(`update private.village_life_players set day=day-1,action_points=0 where user_id='${u}';update private.village_life_towns set day=day-1,herb_remaining=0,farm_remaining=0;`);
 s=await get();assert.equal(s.actionPoints,100);assert.equal(s.materials.herb,100);assert.equal(s.towns.find((t:any)=>t.id==='herb-1').herbRemaining,30000);
 await travel('farm-1');const farm=await gather('farm-1','farm',100);assert.equal(farm.state.actionPoints,0);assert.equal(Object.values(farm.result.gains).reduce((a:any,b:any)=>a+b,0),1000);
 assert.ok(Object.keys(farm.result.gains).every(k=>['pepper','potato','wheat'].includes(k)));
 await assert.rejects(()=>gather('farm-1','farm'),/ACTION_POINTS_EMPTY/);
 await db.exec(`update private.village_life_players set action_points=100 where user_id='${u}';update private.village_life_towns set day=(now() at time zone 'Asia/Seoul')::date,farm_remaining=5 where id='farm-1';`);
 await assert.rejects(()=>gather('farm-1','farm'),/TOWN_STOCK_EMPTY/);assert.equal((await get()).actionPoints,100);
 await travel('city');const before=(await get()).towns.find((t:any)=>t.id==='city');await gather('city','herb');const after=(await get()).towns.find((t:any)=>t.id==='city');assert.equal(after.farmRemaining,before.farmRemaining);assert.equal(after.herbRemaining,before.herbRemaining-10);
 for(const signature of ['get_village_life(uuid,bigint,text,text)','travel_village(uuid,bigint,text,text,text)','gather_village(uuid,bigint,text,text,uuid,text,text,integer)'])assert.equal((await db.query<{ok:boolean}>(`select has_function_privilege('anon',$1,'EXECUTE') ok`,[signature])).rows[0].ok,false);
 assert.equal((await db.query<{ok:boolean}>(`select has_table_privilege('authenticated','private.village_life_players','UPDATE') ok`)).rows[0].ok,false);
 await assert.rejects(()=>db.query(`select public.get_village_life($1,2,'c','d')`,[u]),/GAME_SESSION_LOST/);
 await assert.rejects(()=>db.query(`select public.get_village_life($1,null,'c','d')`,[u]),/GAME_SESSION_LOST/);
 }finally{await db.close();}
});
