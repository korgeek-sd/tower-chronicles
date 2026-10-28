import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const u='11111111-1111-4111-8111-111111111111',v='22222222-2222-4222-8222-222222222222';
const read=(name:string)=>readFileSync('supabase/migrations/'+name,'utf8');
test('growth RPC returns own current loadout, matches combat authority, rejects invalid access and changes no rows',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema private;create role anon;create role authenticated;
 create table public.game_saves(user_id uuid primary key,payload jsonb);
 create table private.hunting_states(user_id uuid primary key,experience bigint,stat_allocation jsonb);
 create table private.market_assets(user_id uuid,item_id text,quantity bigint,gear jsonb);
 create table private.player_association_seals(user_id uuid,level integer);
 create table private.player_guardian_seals(user_id uuid,level integer);
 create table private.collection_equipment_registrations(user_id uuid,set_id text);
 create table private.appearance_ownership(user_id uuid,appearance_id text);
 create table private.village_life_players(user_id uuid,food_turns jsonb);
 create function private.require_active_game_session(uuid,bigint,text,text) returns uuid language plpgsql as $$begin
 if $1 is distinct from '${u}'::uuid or $2 is distinct from 7::bigint or $3 is distinct from 'client' or $4 is distinct from 'device' then raise exception 'GAME_SESSION_LOST';end if;
 return '${u}'::uuid;end$$;
 create function private.association_seal_bonus_json(int) returns jsonb language sql as $$select jsonb_build_object('hpPercent',$1,'attackPercent',$1/2.0,'defensePercent',$1/2.0)$$;
 create function private.guardian_seal_bonus_json(int) returns jsonb language sql as $$select jsonb_build_object('hpPercent',$1/2.0,'attackPercent',0,'defensePercent',$1)$$;
 create function private.appearance_equipped_effect(uuid,jsonb) returns jsonb language sql as $$select '{"id":"attack","value":2}'::jsonb$$;
 insert into public.game_saves values('${u}','{"equipped":{"weapon":"current","ring":"foreign","helmet":"wrong-slot"},"expedition":{"equipment":{"weapon":"locked"}},"currentJobId":"warrior","cosmetics":{"selectedAppearanceId":"corsair"}}'),('${v}','{}');
 insert into private.hunting_states values('${u}',12345,'{"attack":4,"hp":2,"defense":3,"mp":2}'),('${v}',999999,'{"attack":500}');
 insert into private.market_assets values
 ('${u}','equipment_v2:current',1,'{"id":"current","kind":"association_supply_iron_sword","grade":"rare","enhancement":0}'),
 ('${u}','equipment_v2:locked',1,'{"id":"locked","kind":"outer_guard_longbow","grade":"legendary","enhancement":0}'),
 ('${v}','equipment_v2:foreign',1,'{"id":"foreign","kind":"expedition_merit_ring","grade":"legendary","enhancement":0}'),
 ('${u}','equipment_v2:wrong-slot',1,'{"id":"wrong-slot","kind":"expedition_merit_ring","grade":"rare","enhancement":0}');
 insert into private.player_association_seals values('${u}',12),('${v}',30);
 insert into private.player_guardian_seals values('${u}',7),('${v}',30);
 insert into private.collection_equipment_registrations values('${u}','own-set'),('${v}','foreign-set');
 insert into private.appearance_ownership values('${u}','corsair'),('${v}','foreign-appearance');
 insert into private.village_life_players values('${u}','{"attack_food":3}'),('${v}','{"attack_food":99}');`);
 const fixed=read('20261008142245_fixed_equipment_catalog.sql').match(/create or replace function private\.fixed_equipment_stats[\s\S]+?\$\$;/i)![0];
 const combat=read('20261027231000_guardian_seal_and_multi_seal.sql').match(/CREATE OR REPLACE FUNCTION private\.combat_equipment_stats[\s\S]+?end \$function\$;/i)![0];
 await db.exec(fixed);await db.exec(combat);
 await db.exec(read('20261028092848_character_growth_overview.sql'));
 const tables=['public.game_saves','private.hunting_states','private.market_assets','private.player_association_seals','private.player_guardian_seals','private.collection_equipment_registrations','private.appearance_ownership','private.village_life_players'];
 const snapshot=async()=>Promise.all(tables.map(table=>db.query(`select * from ${table} order by user_id`)));
 const before=await snapshot();
 await db.exec('set role authenticated');
 const call=`select public.get_character_growth($1,7,'client','device') r`;
 const result=(await db.query<any>(call,[u])).rows[0].r;
 assert.equal(result.experience,12345);assert.equal(result.maxMp,120);
 assert.equal(result.currentJobId,'warrior');assert.equal(result.selectedAppearanceId,'corsair');
 assert.deepEqual(result.equipment.map((e:any)=>e.item.id),['current']);
 assert.deepEqual(result.equipment[0].stats,{attack:14,defense:6});
 assert.deepEqual(result.collection,{applied:false,registeredSetIds:['own-set'],unlockedAppearanceIds:['corsair']});
 assert.deepEqual(result.foodTurns,{attack_food:3});
 assert.equal(result.seals.association.level,12);assert.equal(result.seals.guardian.level,7);
 await assert.rejects(db.query(call,[v]),/GAME_SESSION_LOST/);
 await assert.rejects(db.query(`select public.get_character_growth($1,6,'client','device')`,[u]),/GAME_SESSION_LOST/);
 await assert.rejects(db.query(`select public.get_character_growth($1,7,'wrong-client','device')`,[u]),/GAME_SESSION_LOST/);
 await db.exec('reset role');
 const expected=(await db.query<any>(`select private.combat_equipment_stats(user_id,jsonb_set(payload,'{expedition}',jsonb_build_object('equipment',payload->'equipped'))) s from public.game_saves where user_id=$1`,[u])).rows[0].s;
 assert.deepEqual(result.stats,expected);assert.ok(Math.abs(result.stats.attack-26*1.06*1.02)<1e-9);
 assert.deepEqual(await snapshot(),before);
 await db.exec('set role anon');await assert.rejects(db.query(call,[u]),/permission denied/);
 await db.exec('reset role');await db.query('delete from public.game_saves where user_id=$1',[u]);
 await db.exec('set role authenticated');await assert.rejects(db.query(call,[u]),/CLOUD_SAVE_REQUIRED/);
 }finally{await db.close();}
});
