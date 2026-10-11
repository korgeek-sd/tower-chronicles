import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../supabase/migrations/20261011220000_village_war_declarations.sql',import.meta.url),'utf8');
const leader='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const guild='33333333-3333-4333-8333-333333333333';
const id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`;

test('server declaration costs exactly 100 tickets, is once per guild/town/week, rejects non-leaders, and replays safely',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;
   create table auth.users(id uuid primary key);insert into auth.users values('${leader}'),('${member}');
   create table private.online_associations(association_id uuid primary key,name text,status text);
   insert into private.online_associations values('${guild}','테스트 길드','ACTIVE');
   create table private.online_association_members(association_id uuid,user_id uuid,role text);
   insert into private.online_association_members values('${guild}','${leader}','LEADER'),('${guild}','${member}','MEMBER');
   create table private.village_life_towns(id text primary key);
   insert into private.village_life_towns values ('city'),('herb-1'),('herb-2');
   create table private.village_life_players(user_id uuid primary key,products jsonb);
   insert into private.village_life_players values
    ('${leader}','{"challenge_ticket":250}'),('${member}','{"challenge_ticket":400}');
   create table private.test_phase(phase text);insert into private.test_phase values('BIDDING');
   create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$select $1$$;
   create function private.occupation_window(timestamptz) returns jsonb language sql as $$
    select jsonb_build_object('cycleKey','2026-10-12','phase',phase,
     'bidClosesAt','2026-10-16T13:00:00Z','battleStartsAt','2026-10-17T13:00:00Z')
     from private.test_phase $$;`);
  await db.exec(migration);
  const args=(u:string,...rest:(string|number)[])=>[u,1,'client','device',...rest];
  const call=async(fn:string,ps:(string|number)[])=>{const p=ps.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select public.${fn}(${p}) result`,ps)).rows[0].result;};
  const state=await call('get_village_war_declarations',args(leader));
  assert.equal(state.tickets,250);assert.equal(state.myRole,'LEADER');assert.equal(state.declarations.length,0);
  const first=await call('declare_village_war',args(leader,id(1),'herb-1'));
  assert.equal(first.replayed,false);assert.equal(first.state.tickets,150);
  assert.equal(first.state.declarations[0].associationName,'테스트 길드');
  const replay=await call('declare_village_war',args(leader,id(1),'herb-1'));
  assert.equal(replay.replayed,true);assert.equal(replay.state.tickets,150);
  await assert.rejects(()=>call('declare_village_war',args(leader,id(1),'city')),/WAR_REQUEST_CONFLICT/);
  await assert.rejects(()=>call('declare_village_war',args(leader,id(2),'herb-1')),/WAR_ALREADY_DECLARED/);
  await assert.rejects(()=>call('declare_village_war',args(member,id(3),'city')),/WAR_LEADER_REQUIRED/);
  const second=await call('declare_village_war',args(leader,id(4),'city'));
  assert.equal(second.state.tickets,50);assert.equal(second.state.declarations.length,2);
  await assert.rejects(()=>call('declare_village_war',args(leader,id(5),'herb-2')),/WAR_TICKETS_SHORT/);
  assert.equal((await call('get_village_war_declarations',args(leader))).tickets,50);
  await db.exec("update private.test_phase set phase='BATTLE';");
  await assert.rejects(()=>call('declare_village_war',args(leader,id(6),'herb-2')),/WAR_DECLARATION_CLOSED/);
  assert.equal((await call('get_village_war_declarations',args(leader))).declarations.length,2);
 }finally{await db.close();}
});
test('RPC private state is hidden and mutation is callable only through authenticated function grant',()=>{
 assert.match(migration,/alter table private\.village_war_declarations enable row level security/);
 assert.match(migration,/alter table private\.village_war_declaration_receipts enable row level security/);
 assert.match(migration,/revoke all on private\.village_war_declarations from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.declare_village_war\(uuid,bigint,text,text,uuid,text\) to authenticated/);
 assert.match(migration,/private\.require_active_game_session\(/);
});
