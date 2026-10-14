import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const base=readFileSync(new URL('../supabase/migrations/20261014124500_guild_boss_rewards_contribution_auction.sql',import.meta.url),'utf8');
const extension=readFileSync(new URL('../supabase/migrations/20261014221800_guild_auction_leader_registration_recovery_relist.sql',import.meta.url),'utf8');
const membershipRecovery=readFileSync(new URL('../supabase/migrations/20261014224300_guild_auction_former_member_gear_recovery.sql',import.meta.url),'utf8');
const releaseEscrow=readFileSync(new URL('../supabase/migrations/20261014225900_guild_auction_release_escrow_uniqueness.sql',import.meta.url),'utf8');
const leader='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const guild='33333333-3333-4333-8333-333333333333';
const item=(n:number)=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
const request=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');
const gear=(n:number)=>JSON.stringify({id:item(n),kind:'association_supply_iron_sword',grade:'rare',enhancement:0});

test('guild leader-only registration escrows server gear; cancellation, unsold returns and boss relist work',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   'create schema private;create schema auth;create role anon;create role authenticated;',
   'create table auth.users(id uuid primary key);',
   'create table private.online_associations(association_id uuid primary key,status text,leader_user_id uuid);',
   'create table private.online_association_members(association_id uuid,user_id uuid,role text);',
   'create table private.online_association_member_progression(association_id uuid,user_id uuid,contribution_point bigint,updated_at timestamptz default now(),primary key(association_id,user_id));',
   'create table private.guild_boss_encounters(encounter_id uuid primary key,association_id uuid,kind text,boss_name text,remaining_hp bigint,defeated_at timestamptz);',
   'create table private.guild_boss_attacks(encounter_id uuid,user_id uuid,damage bigint);',
   'create table public.game_saves(user_id uuid primary key,payload jsonb);',
   'create table private.online_expeditions(user_id uuid,status text);',
   'create table private.player_wallets(user_id uuid primary key,silver bigint,updated_at timestamptz default now());',
   'create table private.village_life_players(user_id uuid primary key,products jsonb);',
   'create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb,updated_at timestamptz default now(),primary key(user_id,item_id));',
   'create table public.game_player_profiles(user_id uuid primary key,nickname text);',
   "create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language sql as $$select $1$$;",
   'create function private.broadcast_association_change(uuid) returns void language plpgsql as $$begin end$$;',
   'create function private.association_activity(uuid,uuid,text,text) returns void language plpgsql as $$begin end$$;',
   'create function private.sync_market_economy_from_latest_save(uuid) returns bigint language sql as $$select 1::bigint$$;',
   'create function private.refresh_village_life(uuid) returns jsonb language sql as $$select \'{}\'::jsonb$$;',
   'create function private.persist_server_association_to_save(uuid) returns jsonb language sql as $$select \'{}\'::jsonb$$;',
   'create function private.persist_market_economy_to_save(uuid) returns bigint language sql as $$select 1::bigint$$;',
   'create function private.cloud_record_json(uuid) returns jsonb language sql as $$select \'{"payload":{}}\'::jsonb$$;',
   "insert into auth.users values('"+leader+"'),('"+member+"');",
   "insert into private.online_associations values('"+guild+"','ACTIVE','"+leader+"');",
   "insert into private.online_association_members values('"+guild+"','"+leader+"','LEADER'),('"+guild+"','"+member+"','MEMBER');",
   "insert into private.online_association_member_progression values('"+guild+"','"+leader+"',7000,now()),('"+guild+"','"+member+"',7000,now());",
   "insert into public.game_saves values('"+leader+"','{\"equipped\":{\"weapon\":\""+item(3)+"\"},\"expedition\":null}'),('"+member+"','{\"equipped\":{},\"expedition\":null}');",
   "insert into private.player_wallets values('"+leader+"',0,now()),('"+member+"',0,now());",
   "insert into private.village_life_players values('"+leader+"','{}'),('"+member+"','{}');",
   "insert into public.game_player_profiles values('"+leader+"','길드장'),('"+member+"','길드원');",
   ...[1,2,3].map(i=>"insert into private.market_assets(user_id,item_id,quantity,gear) values('"+leader+"','equipment_v2:"+item(i)+"',1,'"+gear(i)+"');"),
   "insert into private.market_assets(user_id,item_id,quantity,gear) values('"+member+"','equipment_v2:"+item(4)+"',1,'"+gear(4)+"');"
  ].join('\n'));
  await db.exec(base);await db.exec(extension);await db.exec(membershipRecovery);await db.exec(releaseEscrow);
  const rpc=async(name:string,args:any[])=>(await db.query<{r:any}>('select public.'+name+'('+args.map((_,i)=>i===0?'$1::uuid':i===3?'$4::uuid':i===4&&name==='register_guild_auction_item'?'$5::text':i===4?'$5::uuid':i===5?'$6::bigint':'$'+(i+1)).join(',')+') r',args)).rows[0].r;
  const register=async(u:string,n:number,it:number,price:number)=>(await db.query<{r:any}>(
    'select public.register_guild_auction_item($1::uuid,1,$2,$3,$4::uuid,$5,$6::bigint) r',
    [u,'client','device',request(n),'equipment_v2:'+item(it),price])).rows[0].r;
  const recover=async(u:string,id:string)=>(await db.query<{r:any}>(
    'select public.recover_guild_auction_item($1::uuid,1,$2,$3,$4::uuid) r',[u,'client','device',id])).rows[0].r;
  const auction=(await db.query<{s:any}>('select private.guild_auction_state_json($1::uuid) s',[leader])).rows[0].s;
  assert.equal(auction.isLeader,true);assert.equal(auction.availableEquipment.length,2);
  assert.equal((await db.query<{s:any}>('select private.guild_auction_state_json($1::uuid) s',[member])).rows[0].s.isLeader,false);
  await assert.rejects(()=>register(member,99,4,100),/GUILD_AUCTION_LEADER_ONLY/);
  await assert.rejects(()=>register(leader,98,3,100),/GUILD_AUCTION_ITEM_EQUIPPED/);
  const first=await register(leader,1,1,200);
  assert.equal(first.replayed,false);
  assert.equal((await register(leader,1,1,200)).replayed,true);
  await assert.rejects(()=>register(leader,1,2,200),/GUILD_AUCTION_REQUEST_CONFLICT/);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.market_assets where user_id=$1::uuid and item_id=$2',[leader,'equipment_v2:'+item(1)])).rows[0].n,0);
  const firstId=first.listingId as string;
  assert.equal((await recover(leader,firstId)).replayed,false);
  assert.equal((await recover(leader,firstId)).replayed,true);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.market_assets where user_id=$1::uuid and item_id=$2',[leader,'equipment_v2:'+item(1)])).rows[0].n,1);
  const second=await register(leader,2,2,400);
  await db.query("update private.guild_auction_listings set started_at=now()-interval '25 hours',ends_at=now()-interval '1 hour' where listing_id=$1::uuid",[second.listingId]);
  assert.equal((await recover(leader,second.listingId)).replayed,false);
  const l=(await db.query<{r:any}>('select gear,returned_at,cancelled_at from private.guild_auction_listings where listing_id=$1::uuid',[second.listingId])).rows[0].r;
  const bossId='66666666-6666-4666-8666-666666666666';
  await db.exec("insert into private.guild_boss_encounters values('"+bossId+"','"+guild+"','WEEKLY','보스',0,now());");
  await db.query("insert into private.guild_auction_listings(association_id,source,gear,starting_bid,source_encounter_id,started_at,ends_at) values($1::uuid,'BOSS',$2::jsonb,1000,$3::uuid,now()-interval '25 hours',now()-interval '1 hour')",[guild,gear(7),bossId]);
  const bossListing=(await db.query<{id:string}>("select listing_id id from private.guild_auction_listings where source='BOSS'")).rows[0].id;
  await assert.rejects(async()=>{await db.query('select public.relist_guild_boss_auction_item($1::uuid,1,$2,$3,$4::uuid,$5::bigint)',[member,'c','d',bossListing,500])},/GUILD_AUCTION_LEADER_ONLY/);
  await db.query('select public.relist_guild_boss_auction_item($1::uuid,1,$2,$3,$4::uuid,$5::bigint)',[leader,'c','d',bossListing,500]);
  const updated=(await db.query<{status:string;price:number}>("select case when ends_at>now() then 'OPEN' else 'CLOSED' end status, starting_bid::int price from private.guild_auction_listings where listing_id=$1::uuid",[bossListing])).rows[0];
  assert.equal(updated.status,'OPEN');assert.equal(updated.price,500);
  const permissions=(await db.query<{anon:boolean;member:boolean}>("select has_function_privilege('anon','public.register_guild_auction_item(uuid,bigint,text,text,uuid,text,bigint)','EXECUTE') anon,has_function_privilege('authenticated','public.register_guild_auction_item(uuid,bigint,text,text,uuid,text,bigint)','EXECUTE') member")).rows[0];
  assert.equal(permissions.anon,false);assert.equal(permissions.member,true);
  // The original seller may reclaim their owned equipment even after leaving the guild.
  const afterLeaving=await register(leader,3,1,900);
  await db.query('delete from private.online_association_members where user_id=$1::uuid',[leader]);
  const former=await recover(leader,afterLeaving.listingId);
  assert.equal(former.replayed,false);assert.equal(former.state,null);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.market_assets where user_id=$1::uuid and item_id=$2',[leader,'equipment_v2:'+item(1)])).rows[0].n,1);
 }finally{await db.close();}
});
