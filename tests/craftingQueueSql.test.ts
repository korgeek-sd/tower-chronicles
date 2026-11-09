import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const user='11111111-1111-4111-8111-111111111111';
const rid=(i:number)=>'22222222-2222-4222-8222-'+String(i).padStart(12,'0');
const migration=readFileSync(new URL('../supabase/migrations/20261109140000_village_crafting_queue.sql',import.meta.url),'utf8');

test('database reserves inputs for 3 FIFO jobs; duplicate requests, claim and cancellation remain atomic',async()=>{
 const db=new PGlite();
 let stage='fixture setup';
 try {
  await db.exec(`
   create schema private;create schema auth;create role anon;create role authenticated;
   create table auth.users(id uuid primary key);insert into auth.users values('${user}');
   create table private.village_life_towns(id text primary key,kind text,is_active boolean);
   insert into private.village_life_towns values('city','city',true);
   create table private.village_life_players(
    user_id uuid primary key, location text default 'city',action_points integer default 100,
    day date default current_date,materials jsonb not null default '{"herb":100,"pepper":100,"potato":100,"wheat":100,"stone":100}',
    products jsonb not null default '{"potion":0,"attack_food":0,"defense_food":0,"experience_food":0,"challenge_ticket":0}',
    craft_mastery bigint default 0,life_masteries jsonb default '{"herb":100,"farm":100,"ticket":100}',
    craft_carry jsonb default '{}',food_turns jsonb default '{}',well_ready_at timestamptz
   );
   insert into private.village_life_players(user_id) values('${user}');
   create table private.village_life_action_receipts(user_id uuid not null,request_id uuid not null,town_id text,action text,item text,count integer,result jsonb,created_at timestamptz default now(),primary key(user_id,request_id));
   create table private.hunting_states(user_id uuid primary key,vitality integer default 100);
   insert into private.hunting_states(user_id) values('${user}');
   create function private.village_life_user(uuid,bigint,text,text) returns uuid language sql as $$select '${user}'::uuid$$;
   create function private.refresh_hunting_state(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
   create function private.refresh_village_life(uuid) returns void language plpgsql as $$begin end$$;
   create function private.village_life_snapshot(uuid) returns jsonb language sql as
    $$select jsonb_build_object('vitality',(select vitality from private.hunting_states where user_id=$1),
     'products',(select products from private.village_life_players where user_id=$1))$$;
   create function private.life_mastery_bonus(bigint) returns integer language sql as $$select 3$$;
   create function public.village_life_action(p_lease_id uuid,p_generation bigint,p_client_instance_id text,p_device_id text,
    p_request_id uuid,p_town_id text,p_action text,p_item text,p_count integer)
   returns jsonb language plpgsql as $$
   begin
    if p_action='craft' then return '{"quantity":1000}'::jsonb;end if;
    return '{}'::jsonb;
   end $$;
  `);
  const boundaries=['create function private.village_craft_queue_snapshot','create function public.get_village_craft_queue','create function public.enqueue_village_craft','create function public.claim_village_craft','create function public.cancel_village_craft','-- Disable the previous instant-craft path'];
  const pieces=[...boundaries.map((b,i)=>i===0?migration.slice(0,migration.indexOf(b)):migration.slice(migration.indexOf(boundaries[i-1]),migration.indexOf(b))),migration.slice(migration.indexOf(boundaries.at(-1)!))];
  for(let i=0;i<pieces.length;i++){stage='migration block '+i;await db.exec(pieces[i]);}
  const call=async(name:string,args:string[])=>{
   const parms=[user,1,'client','device',...args];
   const v=await db.query<{r:any}>(`select public.${name}(${parms.map((_,i)=>'$'+(i+1)).join(',')}) r`,parms);
   return v.rows[0].r;
  };
  const enqueue=(i:number,item:string)=>call('enqueue_village_craft',[rid(i),'city',item,'1']);
  stage='first enqueue';
  const first=await enqueue(1,'potion');
  assert.equal(first.result.quantity,1030);
  assert.equal(first.queue.length,1);
  assert.equal(first.state.vitality,99);
  assert.equal((await enqueue(1,'potion')).replayed,true);
  stage='second and third enqueue';
  await enqueue(2,'attack_food');await enqueue(3,'challenge_ticket');
  await assert.rejects(()=>enqueue(4,'potion'),/CRAFT_QUEUE_FULL/);
  const order=(await db.query<{item:string;starts_at:string;ends_at:string}>("select item,starts_at,ends_at from private.village_craft_queue where status='ACTIVE' order by starts_at")).rows;
  assert.deepEqual(order.map(r=>r.item),['potion','attack_food','challenge_ticket']);
  assert.equal(new Date(order[0].ends_at).getTime()<=new Date(order[1].starts_at).getTime(),true);
  await assert.rejects(()=>call('claim_village_craft',[rid(1)]),/CRAFT_NOT_READY/);
  stage='cancel second job';
  const cancelled=await call('cancel_village_craft',[rid(2)]);
  assert.equal(cancelled.queue.length,2);
  assert.equal(cancelled.state.vitality,98);
  assert.equal((await call('cancel_village_craft',[rid(2)])).replayed,true);
  await db.exec(`update private.village_craft_queue set starts_at=clock_timestamp()-interval '10 minutes',ends_at=clock_timestamp()-interval '1 minute' where job_id='${rid(1)}';`);
  stage='claim first job';
  const claimed=await call('claim_village_craft',[rid(1)]);
  assert.equal(claimed.result.quantity,1030);
  assert.equal(claimed.state.products.potion,1030);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from private.village_life_action_receipts where action='craft'")).rows[0].n,1,'quest receipt must be written once at claim');
  assert.equal((await call('claim_village_craft',[rid(1)])).replayed,true);
  assert.equal((await db.query<{n:number}>("select count(*)::int n from private.village_craft_queue where status='ACTIVE'")).rows[0].n,1);
  await assert.rejects(()=>call('village_life_action',[rid(5),'city','craft','potion','1']),/CRAFT_QUEUE_REQUIRED/);
 }catch(e){throw new Error('Craft queue test failed at '+stage+': '+String(e),{cause:e});}finally{await db.close();}
});
