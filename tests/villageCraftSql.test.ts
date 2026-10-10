import {initialHuntingState,resolveHunt,damage} from '../src/game/hunting/model';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const u='11111111-1111-4111-8111-111111111111';
const migration=new URL('../supabase/migrations/20261007171148_village_crafting.sql',import.meta.url);
test('server craft/use/well/hunt transactions validate, carry, replay and consume exactly once',async()=>{const db=new PGlite();try{
await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${u}');
create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin if $2<>1 then raise exception 'GAME_SESSION_LOST';end if;return $1;end$$;
create table public.game_saves(user_id uuid primary key,payload jsonb);insert into public.game_saves values('${u}','{"expedition":null,"equipped":{},"testStats":{"hp":100,"attack":20,"defense":10,"critChance":0}}');
create table private.player_wallets(user_id uuid primary key,silver bigint default 0,updated_at timestamptz);insert into private.player_wallets(user_id) values('${u}');
create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb,updated_at timestamptz,primary key(user_id,item_id));create table private.online_expeditions(user_id uuid,status text);
create function private.sync_market_economy_from_latest_save(uuid) returns void language plpgsql as $$begin end$$;
create function private.persist_client_payload_with_server_economy(uuid,jsonb,text) returns void language plpgsql as $$begin end$$;
create function private.persist_market_economy_to_save(uuid) returns void language plpgsql as $$begin end$$;
create function private.cloud_record_json(uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
create function private.combat_equipment_stats(uuid,jsonb) returns jsonb language sql as $$select $2->'testStats'$$;`);
for(const f of ['20261007130000_instant_hunting.sql','20261007163810_village_life.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
await db.exec(readFileSync(migration,'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261007172125_village_dismantle_lock_order.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261007172410_hunting_prebattle_recovery.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261008100000_hunting_six_stats.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261009143756_hunting_world_map.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261010114553_hunting_long_term_progression.sql',import.meta.url),'utf8'));
let seq=0;const id=()=>`22222222-2222-4222-8222-${String(++seq).padStart(12,'0')}`;
const call=async(name:string,args:any[]=[])=>{const ps=[u,1,'c','d',...args];return (await db.query<{r:any}>(`select public.${name}(${ps.map((_,i)=>'$'+(i+1)).join(',')}) r`,ps)).rows[0].r;};
const get=()=>call('get_village_life');const action=(kind:string,item:string,count=1,request=id(),town='city')=>call('village_life_action',[request,town,kind,item,count]);
await get();await assert.rejects(()=>action('craft','potion'),/MATERIALS_EMPTY/);
await db.exec(`update private.village_life_players set materials='{"herb":1000,"pepper":1000,"potato":1000,"wheat":1000,"stone":1000}',craft_mastery=1000 where user_id='${u}';`);
const request=id(),r=await action('craft','attack_food',10,request);assert.equal(r.result.quantity,11);assert.equal(r.state.actionPoints,90);assert.equal(r.state.materials.pepper,900);assert.equal(r.state.craftMastery,1010);
const repeat=await action('craft','attack_food',10,request);assert.equal(repeat.replayed,true);assert.equal(repeat.state.products.attack_food,11);await assert.rejects(()=>action('craft','potion',10,request),/REQUEST_CONFLICT/);
const used=await action('food','attack_food',2);assert.equal(used.state.foodTurns.attack_food,60);assert.equal(used.state.products.attack_food,9);assert.equal(used.state.actionPoints,90);
await assert.rejects(()=>action('food','potion'),/RECIPE_INVALID/);await assert.rejects(()=>action('craft','potion',101),/COUNT_INVALID/);
await call('travel_village',['farm-1']);await assert.rejects(()=>action('craft','potion',1,id(),'farm-1'),/RECIPE_LOCATION/);await call('travel_village',['city']);
await action('craft','potion',1);assert.equal((await get()).products.potion,1100);const stock=(await get()).towns.find((t:any)=>t.id==='city').herbRemaining;assert.equal(stock,30000);
await db.exec(`update private.village_life_players set products=products||'{"defense_food":1,"experience_food":1}'::jsonb;`);await action('food','defense_food');await action('food','experience_food');
const hreq=id();const hunt=await call('hunt_once',[hreq,'plains']);assert.equal(hunt.result.player.attack,22);assert.equal(hunt.result.player.defense,11);assert.equal(hunt.result.exp,110);assert.ok(hunt.result.potionsUsed>0);assert.equal(hunt.state.currentHp,100);assert.equal((await get()).foodTurns.attack_food,59);
await call('hunt_once',[hreq,'plains']);assert.equal((await get()).foodTurns.attack_food,59);const after=(await get()).products.potion;assert.equal(after,1100-hunt.result.potionsUsed);
await db.exec(`update private.village_life_players set products=products||'{"potion":0}'::jsonb;update private.hunting_states set current_hp=1;`);const low=await call('hunt_once',[id(),'mine']);assert.equal(low.result.startHp,1);assert.equal(low.state.currentHp,1);
await db.exec(`update private.village_life_players set products=products||'{\"potion\":200}'::jsonb;`);const refilled=await call('hunt_once',[id(),'plains']);assert.equal(refilled.result.startHp,100,'newly crafted potions must heal before the next fight');assert.equal((await get()).products.potion,200-refilled.result.potionsUsed);
await db.exec(`update public.game_saves set payload=jsonb_set(payload,'{testStats,hp}','150');`);const equipped=await call('hunt_once',[id(),'plains']);assert.equal(equipped.result.startHp,150,'larger equipment HP also heals before battle');
// Exact server/guest turn parity with deterministic crit endpoints and all six stats.
for(const critical of [0,1]){
 const fighter={hp:180,attack:30,defense:7,critChance:critical,critDamage:2,armorPenetration:.5};
 await db.query(`update public.game_saves set payload=jsonb_set(payload,'{testStats}',$1::jsonb)`,[JSON.stringify(fighter)]);
 await db.exec(`update private.hunting_states set current_hp=180,skills=array['heavy','guard','quick'];update private.village_life_players set products='{"potion":0}',food_turns='{}';`);
 const server=await call('hunt_once',[id(),'mine']);
 const guest=resolveHunt(initialHuntingState(0),'mine',fighter,['heavy','guard','quick'],0,()=>.5);
 assert.deepEqual(server.result.player,guest.result.player);
 assert.deepEqual(server.result.turns,guest.result.turns);
 assert.equal(server.result.outcome,guest.result.outcome);
 assert.equal(server.state.currentHp,guest.state.currentHp);
}
for(const pen of [-1,0,.5,1,2]){
 const sqlHit=(await db.query<{hit:number}>(`select private.hunting_damage(100,100,1,$1)::integer hit`,[pen])).rows[0].hit;
 assert.equal(sqlHit,damage(100,100,1,pen));
}
await db.exec(`update private.hunting_states set skills=array[]::text[],current_hp=180;`);
const waiting=await call('hunt_once',[id(),'plains']);assert.equal(waiting.result.monsterHp,90);assert.ok(waiting.result.turns[0].lines[0].includes('대기'));
assert.equal((await db.query<{ok:boolean}>("select has_function_privilege('authenticated','private.hunting_damage(numeric,numeric,numeric,numeric)','EXECUTE') ok")).rows[0].ok,false);
const wreq=id();await action('well','well',1,wreq);assert.equal((await get()).health.hp,null);assert.equal((await action('well','well',1,wreq)).replayed,true);await assert.rejects(()=>action('well','well'),/WELL_COOLDOWN/);
await db.exec(`insert into private.market_assets values('${u}','equipment_v2:drop',1,'{"grade":"rare","tier":3}',now());`);const dis=await call('dismantle_online_equipment',['drop']);assert.equal(dis.splitStones,6);assert.equal((await get()).materials.stone,1006);await action('craft','challenge_ticket');assert.equal((await get()).products.challenge_ticket,1);
await db.exec(`update private.village_life_players set action_points=0,day=day-1;`);assert.equal((await get()).actionPoints,100);assert.equal((await get()).craftMastery,1012);
assert.equal((await db.query<{ok:boolean}>("select has_function_privilege('anon','public.village_life_action(uuid,bigint,text,text,uuid,text,text,text,integer)','EXECUTE') ok")).rows[0].ok,false);
await assert.rejects(()=>db.query(`select public.village_life_action($1,null,'c','d',$2,'city','craft','potion',1)`,[u,id()]),/GAME_SESSION_LOST/);

 await db.exec(`update private.hunting_states set vitality=100,current_hp=100000,skills=array['heavy','quick'];create or replace function private.combat_equipment_stats(uuid,jsonb) returns jsonb language sql as $$select '{"hp":100000,"attack":10000,"defense":1000,"critChance":0,"critDamage":1.5,"armorPenetration":0}'::jsonb$$;`);
 for(const [map,xp,silver] of [['plains',100,35],['forest',250,55],['mine',600,80],['fortress',1400,110],['ruins',3000,150]] as const){const req=id();const r=await call('hunt_once',[req,map]);assert.equal(r.result.mapId,map);assert.equal(r.result.outcome,'victory');assert.equal(r.result.exp,xp);assert.equal(r.result.silver,silver);const replay=await call('hunt_once',[req,map]);assert.equal(replay.replayed,true);assert.equal(replay.state.vitality,r.state.vitality);}
}finally{await db.close();}});
