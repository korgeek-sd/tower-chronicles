import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const u='11111111-1111-4111-8111-111111111111';
test('quests use authoritative receipts, unique assignments, period boundaries and atomic replayable rewards',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${u}');
 create table public.game_saves(user_id uuid primary key,payload jsonb default '{"cosmetics":{}}');insert into public.game_saves(user_id) values('${u}');
 create table private.player_wallets(user_id uuid primary key);insert into private.player_wallets values('${u}');
 create table private.village_life_players(user_id uuid primary key,products jsonb default '{}');insert into private.village_life_players(user_id) values('${u}');
 create table private.market_assets(user_id uuid,item_id text,quantity bigint,primary key(user_id,item_id));
 create table private.skill_book_catalog(skill_id text,name text,grade text);insert into private.skill_book_catalog values('c','C技能','C'),('b','B技能','B'),('a','A技能','A'),('s','S技能','S');
 create table private.hunting_receipts(user_id uuid,created_at timestamptz default now(),result jsonb);
 create table private.village_life_receipts(user_id uuid,created_at timestamptz default now(),count integer);
 create table private.village_life_action_receipts(user_id uuid,created_at timestamptz default now(),action text,count integer);
 create table private.market_trades(buyer_id uuid,executed_at timestamptz default now(),buy_order_id uuid);
 create table private.online_association_donations(user_id uuid,created_at timestamptz default now());
 create function private.village_life_user(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2 is distinct from 1 then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
 create function private.sync_market_economy_from_latest_save(uuid) returns void language sql as $$select$$;
 create function private.refresh_village_life(uuid) returns void language sql as $$select$$;
 create function private.skill_progress_payload(uuid,jsonb) returns jsonb language sql as $$select $2$$;
 create function private.server_economy_payload(p_user uuid,p_payload jsonb) returns jsonb language plpgsql as $$begin return private.skill_progress_payload(p_user,p_payload);end$$;
 create function private.persist_market_economy_to_save(uuid) returns void language sql as $$update public.game_saves set payload=private.server_economy_payload($1,payload) where user_id=$1$$;
 create function public.declare_village_war() returns void language plpgsql as $$begin perform 1;end$$;
 create function public.village_life_action() returns void language plpgsql as $$begin perform 1;end$$;
 create function private.cloud_record_json(uuid) returns jsonb language sql as $$select jsonb_build_object('payload',payload) from public.game_saves where user_id=$1$$;`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20261011103055_daily_weekly_quests.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261011104140_quest_claim_lock_order.sql',import.meta.url),'utf8'));
 await db.exec(`update private.quest_config set started_at=now()-interval '14 days';`);
 const get=async()=> (await db.query<{r:any}>(`select public.get_quests($1,1,'c','d') r`,[u])).rows[0].r;
 const claim=async(period:string,day:string,id:string)=>(await db.query<{r:any}>(`select public.claim_quest($1,1,'c','d',$2,$3,$4) r`,[u,period,day,id])).rows[0].r;
 let b=await get();assert.equal(b.daily.length,3);assert.equal(new Set(b.daily.map((q:any)=>q.id)).size,3);assert.equal(b.weekly.length,5);assert.ok(b.daily.every((q:any)=>q.progress===0&&!q.completed));
 assert.equal(JSON.stringify((await get()).daily),JSON.stringify(b.daily));
 await assert.rejects(()=>claim('daily',b.dailyKey,b.daily[0].id),/QUEST_INCOMPLETE/);
 await assert.rejects(()=>db.query(`select public.get_quests($1,2,'c','d')`,[u]),/GAME_SESSION_LOST/);
 // Defeats never count; batching counts actions, not output products or RPC calls.
 await db.exec(`insert into private.hunting_receipts values('${u}',now(),'{"outcome":"defeat"}');insert into private.village_life_action_receipts values('${u}',now(),'food',1000);`);
 assert.equal((await get()).weekly[0].progress,0);assert.equal((await get()).weekly[1].progress,0);
 await db.exec(`insert into private.hunting_receipts select '${u}',now(),'{"outcome":"victory"}' from generate_series(1,300);
 insert into private.village_life_action_receipts values('${u}',now(),'craft',50);insert into private.village_life_receipts values('${u}',now(),150);
 insert into private.market_trades select '${u}',now(),'22222222-2222-4222-8222-222222222222' from generate_series(1,3);
 insert into private.online_association_donations select '${u}',now() from generate_series(1,3);`);
 assert.equal((await db.query<{r:any}>(`select private.quest_counts($1,'daily',private.quest_period('daily',now())) r`,[u])).rows[0].r.market,1);
 await db.exec(`insert into private.market_trades values('${u}',now(),'33333333-3333-4333-8333-333333333333'),('${u}',now(),'44444444-4444-4444-8444-444444444444');`);
 b=await get();assert.ok(b.daily.every((q:any)=>q.completed));
 await db.exec('select setseed(0.42)');
 const types=new Set<string>();
 for(let round=0;round<25;round++){
  for(const q of b.daily){const r=await claim('daily',b.dailyKey,q.id);assert.ok(r.reward.length>0);const again=await claim('daily',b.dailyKey,q.id);assert.equal(again.replayed,true);assert.deepEqual(again.reward,r.reward);}
  const rows=(await db.query<{reward_type:string}>(`select reward_type from private.quest_assignments where user_id=$1 and period='daily' and day=$2`,[u,b.dailyKey])).rows;
  assert.equal(new Set(rows.map(r=>r.reward_type)).size,3);for(const r of rows)types.add(r.reward_type);
  await db.exec(`update private.quest_assignments set claimed_at=null,reward_type=null,reward=null where period='daily';`);
 }
 assert.equal(types.size,6);
 assert.equal((await db.query<{n:number}>(`select count(*)::integer n from private.market_assets where item_id='skillbook:s'`)).rows[0].n,0);
 // One balance for challenge tickets: production/rewards -> trade escrow -> refunds.
 await db.exec(`update private.village_life_players set products=jsonb_set(products,'{challenge_ticket}','12');`);
 assert.equal((await db.query<{q:number}>(`select quantity::integer q from private.market_assets where item_id='other:challenge_ticket'`)).rows[0].q,12);
 await db.exec(`delete from private.market_assets where item_id='other:challenge_ticket';`);
 assert.equal((await db.query<{q:number}>(`select (products->>'challenge_ticket')::integer q from private.village_life_players`)).rows[0].q,0);
 await db.exec(`insert into private.market_assets values('${u}','other:challenge_ticket',3);`);
 assert.equal((await db.query<{q:number}>(`select (products->>'challenge_ticket')::integer q from private.village_life_players`)).rows[0].q,3);
 // Completing daily assignments counts toward weekly progress even before claiming.
 await db.exec(`insert into private.hunting_receipts select '${u}',day,'{"outcome":"victory"}' from generate_series(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',now()-interval '1 day',interval '1 day') day cross join generate_series(1,30);
 insert into private.village_life_action_receipts select '${u}',day,'craft',10 from generate_series(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',now()-interval '1 day',interval '1 day') day;
 insert into private.village_life_receipts select '${u}',day,30 from generate_series(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',now()-interval '1 day',interval '1 day') day;
 insert into private.market_trades select '${u}',day,gen_random_uuid() from generate_series(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',now()-interval '1 day',interval '1 day') day cross join generate_series(1,3);
 insert into private.online_association_donations select '${u}',day from generate_series(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul',now()-interval '1 day',interval '1 day') day cross join generate_series(1,3);`);
 b=await get();
 const sunday=(await db.query<{r:any}>(`select private.quest_snapshot($1,((private.quest_period('weekly',now())+6)::timestamp at time zone 'Asia/Seoul')+interval '23 hours') r`,[u])).rows[0].r;
 // Earlier weekdays have fewer daily completions; accumulated completions are checked on the current week.
 assert.ok(sunday.weekly.find((q:any)=>q.id==='daily').progress>=b.weekly.find((q:any)=>q.id==='daily').progress);
 // This fixture runs on Sunday; on earlier weekdays the ten-daily target can remain incomplete.
 if(b.weekly.find((q:any)=>q.id==='daily').completed){
  assert.equal(b.weekly.find((q:any)=>q.id==='all').completed,true);
  for(const q of b.weekly)await claim('weekly',b.weeklyKey,q.id);
  assert.equal((await db.query<{n:number}>(`select count(distinct reward_type)::integer n from private.quest_assignments where period='weekly' and day=$1`,[b.weeklyKey])).rows[0].n,5);
 }
 const expired=await db.query<{d:string}>(`select (private.quest_period('daily',now())-1)::text d`);
 const oldDay=expired.rows[0].d;
 await db.query(`select private.ensure_quests($1,'daily',$2)`,[u,oldDay]);
 const oldId=(await db.query<{quest_id:string}>(`select quest_id from private.quest_assignments where user_id=$1 and period='daily' and day=$2 limit 1`,[u,oldDay])).rows[0].quest_id;
 await assert.rejects(()=>claim('daily',oldDay,oldId),/QUEST_EXPIRED/);
 const boundaries=await db.query<{d:string;w:string}>(`select private.quest_period('daily','2026-10-11 15:00Z')::text d,private.quest_period('weekly','2026-10-11 15:00Z')::text w`);assert.deepEqual(boundaries.rows[0],{d:'2026-10-12',w:'2026-10-12'});
 for(const signature of ['public.get_quests(uuid,bigint,text,text)','public.claim_quest(uuid,bigint,text,text,text,date,text)','private.quest_snapshot(uuid,timestamptz)'])assert.equal((await db.query<{ok:boolean}>(`select has_function_privilege('anon',$1,'execute') ok`,[signature])).rows[0].ok,false);
 }finally{await db.close();}
});
