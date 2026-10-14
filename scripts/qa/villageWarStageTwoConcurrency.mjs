import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const target=process.env.VILLAGE_WAR_TEST_DATABASE_URL;
if(!target)throw Error('VILLAGE_WAR_TEST_DATABASE_URL required');
const url=new URL(target);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!='/village_war_stage_two_test')throw Error('Only isolated local stage two DB accepted');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const user=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const req=n=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
const clients=[];async function connect(){const c=new pg.Client({connectionString:target});await c.connect();clients.push(c);return c;}
const a=await connect(),b=await connect(),c=await connect();
try{
 // Bootstrap is deliberately limited to a brand-new named local test DB.
 if(!(await c.query("select to_regclass('private.war_test_marker') r")).rows[0].r){
  await c.query(read('../../tests/villageWarStageOneFixture.sql').replace('create role anon;create role authenticated;',''));
  const catalog=read('../../supabase/migrations/20261011194500_hunting_catalog_combat.sql');
  await c.query(catalog.slice(catalog.indexOf('create or replace function private.hunting_skill_spec'),catalog.indexOf('CREATE OR REPLACE FUNCTION private.refresh_hunting_state')));
  const math=read('../../supabase/migrations/20261008100000_hunting_six_stats.sql');
  await c.query(math.slice(math.indexOf('create or replace function private.hunting_damage'),math.indexOf('revoke all on function private.hunting_damage')));
  await c.query(read('../../supabase/migrations/20261014040726_village_war_stage_one.sql'));
  await c.query(read('../../supabase/migrations/20261014054540_village_war_stage_two.sql'));
  await c.query(read('../../supabase/migrations/20261014062204_village_war_interval_boundary.sql'));
 }
 assert.equal((await c.query('select value from private.war_test_marker')).rows[0].value,'isolated-village-war-test');
 await c.query(`create table if not exists private.qa_clock(t timestamptz);truncate private.qa_clock;insert into private.qa_clock values('2026-10-17T13:01:00Z');create or replace function private.village_war_clock() returns timestamptz language sql volatile as $$select t from private.qa_clock$$;create or replace function private.village_war_random() returns float8 language sql as $$select .4::float8$$;update private.village_war_settings set enabled=true;insert into private.village_war_declarations values('2026-10-12','city','22222222-2222-4222-8222-222222222222') on conflict do nothing;`);
 async function reset(){
  await c.query('truncate private.village_war_receipts,private.village_war_actor_state,private.village_war_fronts,private.village_war_events cascade');
  await c.query(`update private.village_life_players set products='{"challenge_ticket":10}';update private.qa_clock set t='2026-10-17T13:01:00Z';`);
  const s=(await c.query("select public.get_village_war_state($1,1,'client','device','city') s",[user(3)])).rows[0].s;
  await c.query(`select public.claim_empty_village_war_front($1,1,'client','device',$2,'city',1,0,$3)`,[user(3),req(1),s.eventId]);
  await c.query(`select public.claim_empty_village_war_front($1,1,'client','device',$2,'city',2,0,$3)`,[user(4),req(2),s.eventId]);
  return s.eventId;
 }
 const attack=(client,u,id,e,front=1)=>client.query("select public.attack_village_war_front($1,1,'client','device',$2,'city',$3,1,$4) r",[user(u),req(id),front,e]);
 const tickets=async u=>Number((await c.query("select products->>'challenge_ticket' t from private.village_life_players where user_id=$1",[user(u)])).rows[0].t);
 let e=await reset();await a.query('begin');await attack(a,1,10,e);await assert.rejects(()=>attack(b,2,11,e),/WAR_FRONT_BUSY/);await a.query('commit');assert.equal(await tickets(1),9);assert.equal(await tickets(2),10);console.log('PASS held occupied front: immediate rejection, one debit');
 e=await reset();await a.query('begin');await attack(a,1,12,e,1);await b.query('begin');await attack(b,2,13,e,2);await b.query('commit');await a.query('commit');assert.equal(await tickets(1),9);assert.equal(await tickets(2),9);console.log('PASS independent fronts complete concurrently under shared event locks');
 e=await reset();await a.query('begin');await attack(a,1,14,e);await c.query("update private.qa_clock set t='2026-10-17T14:01:00Z'");await assert.rejects(()=>b.query('select private.settle_village_war($1)',[e]),/WAR_EVENT_BUSY/);await a.query('commit');await b.query('select private.settle_village_war($1)',[e]);assert.ok((await c.query('select settled_at from private.village_war_events where event_id=$1',[e])).rows[0].settled_at);console.log('PASS settlement rejects active attack lock and succeeds after commit');
 e=await reset();await a.query('begin');await a.query('select * from private.village_war_events where event_id=$1 for update',[e]);await assert.rejects(()=>attack(b,1,15,e),/WAR_ACTOR_BUSY|WAR_EVENT_BUSY/);await a.query('rollback');assert.equal(await tickets(1),10);console.log('PASS exclusive settlement lock prevents late attack debit');
 e=await reset();await a.query('begin');await attack(a,1,16,e);await assert.rejects(()=>attack(b,1,16,e),/WAR_REQUEST_BUSY/);await a.query('commit');const replay=(await attack(b,1,16,e)).rows[0].r;assert.equal(replay.replayed,true);assert.equal(await tickets(1),9);console.log('PASS concurrent identical UUID charges and rewards once');
 e=await reset();await a.query('begin');await a.query('select * from private.village_life_players where user_id=$1 for update',[user(1)]);await assert.rejects(()=>attack(b,1,17,e),/WAR_ACTOR_BUSY/);await a.query('rollback');assert.equal(await tickets(1),10);assert.equal(Number((await c.query('select count(*) n from private.village_war_battles')).rows[0].n),0);console.log('PASS wallet contention rolls back actor, record and defender damage');
}finally{for(const client of clients){try{await client.query('rollback');}catch{}await client.end();}}
