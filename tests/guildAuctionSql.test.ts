import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migration=readFileSync(new URL('../supabase/migrations/20261014124500_guild_boss_rewards_contribution_auction.sql',import.meta.url),'utf8');
const u='11111111-1111-4111-8111-111111111111';
const v='22222222-2222-4222-8222-222222222222';
const guild='33333333-3333-4333-8333-333333333333';
const eid='44444444-4444-4444-8444-444444444444';
const request=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');

test('raids produce one guild auction, bids escrow and refund contribution, winner claims exactly once',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   'create schema private; create schema auth; create role anon; create role authenticated;',
   'create table auth.users(id uuid primary key);',
   'create table private.online_associations(association_id uuid primary key,status text not null);',
   'create table private.online_association_members(association_id uuid,user_id uuid primary key);',
   'create table private.online_association_member_progression(association_id uuid,user_id uuid,contribution_point bigint,updated_at timestamptz default now(),primary key(association_id,user_id));',
   'create table private.guild_boss_encounters(encounter_id uuid primary key,association_id uuid,kind text,boss_name text,remaining_hp bigint,defeated_at timestamptz);',
   'create table private.guild_boss_attacks(encounter_id uuid,user_id uuid,damage bigint);',
   'create table public.game_saves(user_id uuid primary key,payload jsonb);',
   'create table private.online_expeditions(user_id uuid,status text);',
   'create table private.player_wallets(user_id uuid primary key,silver bigint,updated_at timestamptz default now());',
   'create table private.village_life_players(user_id uuid primary key,products jsonb);',
   'create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb,primary key(user_id,item_id));',
   "create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$select $1$$;",
   'create function private.broadcast_association_change(uuid) returns void language plpgsql as $$begin end$$;',
   'create function private.association_activity(uuid,uuid,text,text) returns void language plpgsql as $$begin end$$;',
   'create function private.sync_market_economy_from_latest_save(uuid) returns bigint language sql as $$select 1::bigint$$;',
   'create function private.refresh_village_life(uuid) returns jsonb language sql as $$select \'{}\'::jsonb$$;',
   'create function private.persist_server_association_to_save(uuid) returns jsonb language sql as $$select \'{}\'::jsonb$$;',
   'create function private.cloud_record_json(uuid) returns jsonb language sql as $$select \'{"payload":{}}\'::jsonb$$;',
   "insert into auth.users values('"+u+"'),('"+v+"');",
   "insert into private.online_associations values('"+guild+"','ACTIVE');",
   "insert into private.online_association_members values('"+guild+"','"+u+"'),('"+guild+"','"+v+"');",
   "insert into private.online_association_member_progression values('"+guild+"','"+u+"',5000,now()),('"+guild+"','"+v+"',6000,now());",
   "insert into public.game_saves values('"+u+"','{\"expedition\":null}'),('"+v+"','{\"expedition\":null}');",
   "insert into private.player_wallets values('"+u+"',0,now()),('"+v+"',0,now());",
   "insert into private.village_life_players values('"+u+"','{}'),('"+v+"','{}');",
   "insert into private.guild_boss_encounters values('"+eid+"','"+guild+"','WEEKLY','테스트 보스',1,null);"
  ].join('\n'));
  await db.exec(migration);
  await db.exec("update private.guild_boss_encounters set remaining_hp=0,defeated_at=now() where encounter_id='"+eid+"';");
  let row=(await db.query<{listing_id:string}>('select listing_id from private.guild_auction_listings')).rows;
  assert.equal(row.length,1);
  const listing=row[0].listing_id;
  await db.exec("update private.guild_boss_encounters set remaining_hp=0 where encounter_id='"+eid+"';");
  assert.equal((await db.query<{n:number}>('select count(*)::integer n from private.guild_auction_listings')).rows[0].n,1);
  const bid=async(user:string,n:number,amount:number)=>(await db.query<{r:any}>('select public.bid_guild_auction($1::uuid,1,$2,$3,$4::uuid,$5::uuid,$6::bigint) r',[user,'c','d',request(n),listing,amount])).rows[0].r;
  assert.equal((await bid(u,1,4000)).replayed,false);
  assert.equal((await bid(u,1,4000)).replayed,true);
  await assert.rejects(()=>bid(v,2,3999),/GUILD_AUCTION_BID_TOO_LOW/);
  await bid(v,3,4500);
  assert.equal((await db.query<{p:number}>('select contribution_point::int p from private.online_association_member_progression where user_id=$1::uuid',[u])).rows[0].p,5000);
  assert.equal((await db.query<{p:number}>('select contribution_point::int p from private.online_association_member_progression where user_id=$1::uuid',[v])).rows[0].p,1500);
  await bid(v,4,5000);
  assert.equal((await db.query<{p:number}>('select contribution_point::int p from private.online_association_member_progression where user_id=$1::uuid',[v])).rows[0].p,1000);
  await db.query("update private.guild_auction_listings set started_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where listing_id=$1::uuid",[listing]);
  await assert.rejects(()=>bid(u,5,5500),/GUILD_AUCTION_CLOSED/);
  const claim=async(user:string)=>(await db.query<{r:any}>('select public.claim_guild_auction_item($1::uuid,1,$2,$3,$4::uuid) r',[user,'c','d',listing])).rows[0].r;
  await assert.rejects(()=>claim(u),/GUILD_AUCTION_NOT_WINNER/);
  assert.equal((await claim(v)).replayed,false);
  assert.equal((await claim(v)).replayed,true);
  const assets=(await db.query<{n:number}>('select count(*)::int n from private.market_assets where user_id=$1::uuid',[v])).rows[0].n;
  assert.equal(assets,1);
  await db.exec("insert into private.guild_boss_attacks values('"+eid+"','"+v+"',100);");
  const reward=async()=>(await db.query<{r:any}>('select public.claim_guild_boss_reward($1::uuid,1,$2,$3,$4::uuid) r',[v,'c','d',eid])).rows[0].r;
  const first=await reward();
  assert.equal(first.replayed,false);assert.equal(first.contribution,100);assert.equal(first.silver,10000);
  assert.equal((await reward()).replayed,true);
  assert.equal((await db.query<{s:number}>('select silver::int s from private.player_wallets where user_id=$1::uuid',[v])).rows[0].s,10000);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.guild_boss_reward_claims')).rows[0].n,1);
  const life=(await db.query<{products:any}>('select products from private.village_life_players where user_id=$1::uuid',[v])).rows[0].products;
  assert.equal(life.potion,30);assert.equal(life.vitality_potion,1);
 }finally{await db.close();}
});
