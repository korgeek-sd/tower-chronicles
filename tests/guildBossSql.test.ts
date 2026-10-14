import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PGlite} from '@electric-sql/pglite';
import {GuildBossPanel} from '../src/components/association/GuildBossPanel';

const migration=readFileSync(new URL('../supabase/migrations/20261014113600_guild_boss_daily_weekly.sql',import.meta.url),'utf8');
const fix=readFileSync(new URL('../supabase/migrations/20261014114800_guild_boss_daily_limit_binding.sql',import.meta.url),'utf8');
const u='11111111-1111-4111-8111-111111111111';
const v='22222222-2222-4222-8222-222222222222';
const g='33333333-3333-4333-8333-333333333333';
const id=(i:number)=>'55555555-5555-4555-8555-'+String(i).padStart(12,'0');

test('guild boss SQL uses RLS, session auth, server-owned equipment and learned skills',()=>{
 for(const part of ['enable row level security','private.require_active_game_session','for update','unique(user_id,request_id)','private.combat_equipment_stats','private.hunting_skill_spec','private.learned_catalog_skills','private.hunting_damage',"time zone 'Asia/Seoul'"])assert.ok(migration.includes(part),part);
 assert.match(fix,/t\.day_kst=v_attack_day/);
});
test('boss entry renders in headquarters and has daily and weekly tabs',()=>{
 const file=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
 assert.match(file,/\['boss','보스전'\]/);assert.match(file,/GuildBossPanel/);
 const html=renderToStaticMarkup(React.createElement(GuildBossPanel,{lease:{leaseId:'test',generation:1,expiresAt:'',clientInstanceId:'test'},associationId:'guild',expedition:false}));
 assert.match(html,/일일 보스/);assert.match(html,/주간 보스/);assert.match(html,/불러오는 중/);
});
test('guild boss SQL keeps shared damage, daily quota, idempotency and KST cycle boundaries',async()=>{
 const db=new PGlite();
 try{
  await db.exec([
   'create schema private;create schema auth;create role anon;create role authenticated;',
   'create table auth.users(id uuid primary key);',
   'create table private.online_associations(association_id uuid primary key,status text);',
   'create table private.online_association_members(association_id uuid,user_id uuid primary key);',
   'create table public.game_saves(user_id uuid primary key,payload jsonb);',
   'create table public.game_player_profiles(user_id uuid primary key,nickname text);',
   'create table private.online_expeditions(user_id uuid,status text);',
   'create table private.hunting_states(user_id uuid primary key,skills text[],stat_allocation jsonb);',
   'create table private.learned_catalog_skills(user_id uuid,skill_id text,enhancement_level integer);',
   'create table private.skill_book_catalog(skill_id text,name text);',
   "create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;",
   "create function private.combat_equipment_stats(uuid,jsonb) returns jsonb language sql as $$select '{\"hp\":180,\"attack\":50,\"defense\":10,\"critChance\":0,\"critDamage\":1.5,\"armorPenetration\":0,\"weapon\":\"sword\"}'::jsonb$$;",
   'create function private.hunting_damage(numeric,numeric,numeric,numeric) returns numeric language sql immutable as $$select greatest(1,floor(greatest(0,$1)*$3*100/(100+greatest(0,$2))))$$;',
   "create function private.hunting_skill_spec(text) returns jsonb language sql immutable as $$select case when $1='sword_mastery_c' then '{\"family\":\"sword_mastery\",\"type\":\"passive\",\"weapon\":\"sword\",\"power\":3}'::jsonb else null end$$;",
   'create function private.broadcast_association_change(uuid) returns void language plpgsql as $$begin end$$;',
   "insert into auth.users values('"+u+"'),('"+v+"');",
   "insert into private.online_associations values('"+g+"','ACTIVE');",
   "insert into private.online_association_members values('"+g+"','"+u+"'),('"+g+"','"+v+"');",
   "insert into public.game_saves values('"+u+"','{\"equipped\":{},\"expedition\":null}'),('"+v+"','{\"equipped\":{},\"expedition\":null}');",
   "insert into public.game_player_profiles values('"+u+"','검객'),('"+v+"','궁수');",
   "insert into private.hunting_states values('"+u+"',array['sword_mastery_c','heavy'],'{}'),('"+v+"',array['heavy'],'{}');",
   "insert into private.learned_catalog_skills values('"+u+"','sword_mastery_c',2);"
  ].join('\n'));
  await db.exec(migration);await db.exec(fix);
  const dates=await db.query<{day:string;week:string}>('select private.guild_boss_cycle_start($1,$2::timestamptz) day,private.guild_boss_cycle_start($3,$4::timestamptz) week',['DAILY','2026-10-14T15:00:00Z','WEEKLY','2026-10-18T00:00:00Z']);
  assert.equal(new Date(dates.rows[0].day).toISOString(),'2026-10-14T15:00:00.000Z');
  assert.equal(new Date(dates.rows[0].week).toISOString(),'2026-10-16T15:00:00.000Z');
  const st=(await db.query<{s:any}>('select private.guild_boss_state_json($1::uuid) s',[u])).rows[0].s;
  assert.equal(st.bosses.length,2);
  const boss=st.bosses.find((x:any)=>x.kind==='DAILY');
  assert.equal(boss.maxHp,2400);assert.equal(boss.attacksLeft,5);
  await db.exec("update private.guild_boss_encounters set max_hp=100000,remaining_hp=100000 where kind='DAILY';");
  const attack=async(who:string,i:number,kind='DAILY')=>(await db.query<{r:any}>('select public.attack_guild_boss($1::uuid,1,$2,$3,$4::uuid,$5::text) r',[who,'c','d',id(i),kind])).rows[0].r;
  const first=await attack(u,1);
  assert.equal(first.replayed,false);assert.ok(first.result.damage>0);assert.equal(first.result.attacksLeft,4);
  assert.ok(first.result.combat.turns.length>0);
  assert.equal((await attack(u,1)).replayed,true);
  await attack(v,20);
  for(let i=2;i<=5;i++)await attack(u,i);
  await assert.rejects(()=>attack(u,6),/GUILD_BOSS_ATTACK_LIMIT/);
  assert.equal((await attack(u,7,'WEEKLY')).result.attacksLeft,4);
  await db.query("update private.guild_boss_attacks set day_kst=(now() at time zone 'Asia/Seoul')::date-1 where user_id=$1::uuid and encounter_id=$2::uuid",[u,boss.encounterId]);
  assert.equal((await attack(u,8)).result.attacksLeft,4);
  const row=(await db.query<{remaining_hp:number;total_attacks:number}>('select remaining_hp,total_attacks from private.guild_boss_encounters where encounter_id=$1::uuid',[boss.encounterId])).rows[0];
  assert.ok(row.remaining_hp>=0);assert.equal(row.total_attacks,7);
  const priv=(await db.query<{anon:boolean;member:boolean}>("select has_function_privilege('anon','public.attack_guild_boss(uuid,bigint,text,text,uuid,text)','EXECUTE') anon,has_function_privilege('authenticated','public.attack_guild_boss(uuid,bigint,text,text,uuid,text)','EXECUTE') member")).rows[0];
  assert.equal(priv.anon,false);assert.equal(priv.member,true);
 }finally{await db.close();}
});
