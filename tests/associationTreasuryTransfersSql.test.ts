import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../supabase/migrations/20261014132000_association_leader_treasury_transfers_and_audit.sql',import.meta.url),'utf8');
const leader='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const guild='33333333-3333-4333-8333-333333333333';
const request=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');

test('leader treasury SQL requires a current verified leader, authoritative balances and append-only records',()=>{
 for(const marker of [
 'private.require_active_game_session','pg_advisory_xact_lock','private.sync_market_economy_from_latest_save',
 "m.role='LEADER'","g.leader_user_id=u","g.status='ACTIVE'",'for update of g',
 'WAREHOUSE_TREASURY_SHORTAGE','WAREHOUSE_LEADER_ONLY','WAREHOUSE_REQUEST_CONFLICT',
 'private.association_treasury_transfers','private.association_warehouse_ledger','signed_amount',
 'private.persist_server_association_to_save','private.broadcast_association_change',
 'p_withdrawals_only','limit 50','has_more',
 ])assert.ok(migration.includes(marker),marker);
 assert.doesNotMatch(migration,/contribution_point\s*=\s*contribution_point\+/);
});
test('leader transfers and full audit pagination enforce roles, balances, replay and contribution neutrality',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   'create schema private;create schema auth;create role anon;create role authenticated;',
   'create table auth.users(id uuid primary key);',
   'create table private.online_associations(association_id uuid primary key,leader_user_id uuid,status text,treasury_silver bigint,treasury_gold bigint,treasury_tickets bigint,updated_at timestamptz default now());',
   'create table private.online_association_members(association_id uuid,user_id uuid,role text);',
   'create table private.association_warehouse_ledger(entry_id bigint generated always as identity primary key,association_id uuid,actor_user_id uuid,operation text,currency_type text,amount bigint,balance_after bigint,detail text,created_at timestamptz default now(),constraint association_warehouse_ledger_operation_check check(operation in (\'DEPOSIT\',\'WAR_DECLARATION\')));',
   'create table private.player_wallets(user_id uuid primary key,silver bigint,gold bigint,updated_at timestamptz default now());',
   'create table private.village_life_players(user_id uuid primary key,products jsonb);',
   'create table private.online_expeditions(user_id uuid,status text);',
   'create table private.online_association_member_progression(association_id uuid,user_id uuid,contribution_point bigint);',
   'create table public.game_saves(user_id uuid primary key,payload jsonb);',
   'create table public.game_player_profiles(user_id uuid primary key,nickname text);',
   "create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$select $1$$;",
   'create function private.sync_market_economy_from_latest_save(uuid) returns bigint language sql as $$select 1::bigint$$;',
   'create function private.persist_server_association_to_save(uuid) returns jsonb language sql as $$select \'{}\'::jsonb$$;',
   'create function private.broadcast_association_change(uuid) returns void language plpgsql as $$begin end$$;',
   'create function private.association_activity(uuid,uuid,text,text) returns void language plpgsql as $$begin end$$;',
   'create function private.association_warehouse_json(uuid) returns jsonb language sql as $$select \'{"silver":999}\'::jsonb$$;',
   'create function private.cloud_record_json(uuid) returns jsonb language sql as $$select \'{"payload":{}}\'::jsonb$$;',
   "insert into auth.users values('"+leader+"'),('"+member+"');",
   "insert into private.online_associations values('"+guild+"','"+leader+"','ACTIVE',2000,900,50,now());",
   "insert into private.online_association_members values('"+guild+"','"+leader+"','LEADER'),('"+guild+"','"+member+"','MEMBER');",
   "insert into private.player_wallets values('"+leader+"',500,100,now()),('"+member+"',100,100,now());",
   "insert into private.village_life_players values('"+leader+"','{\"challenge_ticket\":2}'),('"+member+"','{\"challenge_ticket\":2}');",
   "insert into public.game_saves values('"+leader+"','{\"expedition\":null}'),('"+member+"','{\"expedition\":null}');",
   "insert into public.game_player_profiles values('"+leader+"','원정단장'),('"+member+"','일반단원');",
   "insert into private.online_association_member_progression values('"+guild+"','"+leader+"',400),('"+guild+"','"+member+"',400);"
  ].join('\n'));
  await db.exec(migration);
  const transfer=async(who:string,n:number,mode:string,coin:string,amount:number,note='')=>{
   const args=[who,'c','d',request(n),mode,coin,amount,note];
   const res=await db.query<{r:any}>('select public.transfer_association_treasury($1::uuid,1,$2,$3,$4::uuid,$5,$6,$7::bigint,$8) r',args);
   return res.rows[0].r;
  };
  await assert.rejects(()=>transfer(member,1,'WITHDRAW','SILVER',100),/WAREHOUSE_LEADER_ONLY/);
  const first=await transfer(leader,1,'WITHDRAW','SILVER',250,'원정단 운영비');
  assert.equal(first.replayed,false);
  assert.equal((await transfer(leader,1,'WITHDRAW','SILVER',250,'원정단 운영비')).replayed,true);
  await assert.rejects(()=>transfer(leader,1,'DEPOSIT','SILVER',250,'원정단 운영비'),/WAREHOUSE_REQUEST_CONFLICT/);
  assert.equal((await db.query<{b:number}>('select treasury_silver::int b from private.online_associations')).rows[0].b,1750);
  assert.equal((await db.query<{b:number}>('select silver::int b from private.player_wallets where user_id=$1::uuid',[leader])).rows[0].b,750);
  await transfer(leader,2,'DEPOSIT','SILVER',100,'임시 보관');
  assert.equal((await db.query<{b:number}>('select treasury_silver::int b from private.online_associations')).rows[0].b,1850);
  assert.equal((await db.query<{b:number}>('select silver::int b from private.player_wallets where user_id=$1::uuid',[leader])).rows[0].b,650);
  await assert.rejects(()=>transfer(leader,3,'WITHDRAW','GOLD',901),/WAREHOUSE_TREASURY_SHORTAGE/);
  await assert.rejects(()=>transfer(leader,4,'DEPOSIT','TICKET',3),/WAREHOUSE_BALANCE_SHORTAGE/);
  await transfer(leader,5,'WITHDRAW','TICKET',7,'공성전');
  assert.equal((await db.query<{b:number}>('select (products->>\'challenge_ticket\')::integer b from private.village_life_players where user_id=$1::uuid',[leader])).rows[0].b,9);
  assert.equal((await db.query<{b:number}>('select treasury_tickets::int b from private.online_associations')).rows[0].b,43);
  await transfer(leader,6,'DEPOSIT','GOLD',30);
  assert.equal((await db.query<{b:number}>('select gold::int b from private.player_wallets where user_id=$1::uuid',[leader])).rows[0].b,70);
  assert.equal((await db.query<{b:number}>('select treasury_gold::int b from private.online_associations')).rows[0].b,930);
  assert.equal((await db.query<{p:number}>('select contribution_point::int p from private.online_association_member_progression where user_id=$1::uuid',[leader])).rows[0].p,400);
  const audit=(await db.query<{r:any}>('select public.get_association_warehouse_history($1::uuid,1,$2,$3,null,true) r',[member,'c','d'])).rows[0].r;
  assert.equal(audit.ledger.length,2);
  assert.ok(audit.ledger.every((e:any)=>e.operation==='LEADER_WITHDRAW'&&e.actorName==='원정단장'));
  assert.ok(audit.ledger.some((e:any)=>e.detail.includes('원정단 운영비')&&e.amount===-250&&e.balanceAfter===1750));
  // An old transfer is never erased when more events are added; test cursor pagination as a guild member.
  for(let i=10;i<62;i++)await transfer(leader,i,'WITHDRAW','GOLD',1,'장부 검증');
  const page1=(await db.query<{r:any}>('select public.get_association_warehouse_history($1::uuid,1,$2,$3) r',[member,'c','d'])).rows[0].r;
  assert.equal(page1.ledger.length,50);assert.equal(page1.hasMore,true);
  const last=page1.ledger.at(-1).entryId;
  const page2=(await db.query<{r:any}>('select public.get_association_warehouse_history($1::uuid,1,$2,$3,$4::bigint,false) r',[member,'c','d',last])).rows[0].r;
  assert.ok(page2.ledger.length>0);assert.equal(page2.hasMore,false);
  assert.ok(page2.ledger.some((e:any)=>e.detail.includes('원정단 운영비')));
  const permissions=(await db.query<{anon:boolean;member:boolean}>("select has_function_privilege('anon','public.transfer_association_treasury(uuid,bigint,text,text,uuid,text,text,bigint,text)','execute') anon,has_function_privilege('authenticated','public.transfer_association_treasury(uuid,bigint,text,text,uuid,text,text,bigint,text)','execute') member")).rows[0];
  assert.equal(permissions.anon,false);assert.equal(permissions.member,true);
 }finally{await db.close();}
});
