import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const migration='../supabase/migrations/20261003151110_combat_engine_v2_online.sql';
async function setup(){const db=new PGlite();await db.exec(read('./combatV2DatabaseFixture.sql'));await db.exec(read(migration));await db.exec(read('../supabase/combat-v2-catalog.sql'));return db;}
test('SQL V2 percentage damage matches defense penetration and minimum damage',async()=>{
 const db=await setup();try{const r=await db.query<{a:number;b:number;c:number}>('select private.combat_v2_damage(100,100,1,1,1,0)::int a,private.combat_v2_damage(100,100,1,1,1,1)::int b,private.combat_v2_damage(1,9999,1,1,1,0)::int c');assert.deepEqual(r.rows[0],{a:50,b:100,c:1});}finally{await db.close();}
});
test('SQL V2 extends status duration without stacking and adds capped shields',async()=>{
 const db=await setup();try{
 const r=await db.query<{a:any}>('select private.combat_v2_apply_effect(private.combat_v2_apply_effect(\'[]\',\'fang_wound\',0,100,\'monster\'),\'fang_wound\',1,100,\'monster\') a');assert.equal(r.rows[0].a[0].stacks,1);assert.equal(r.rows[0].a[0].duration,6);assert.equal(r.rows[0].a[0].createdTurn,0);
 const shield=await db.query<{a:any}>('select private.combat_v2_apply_effect(private.combat_v2_apply_effect(\'[]\',\'test_shield\',0,10,\'player\'),\'iron_core_shield\',1,10,\'player\') a');assert.equal(shield.rows[0].a.reduce((n:number,x:any)=>n+x.currentShield,0),30);assert.equal(shield.rows[0].a.length,1);
 }finally{await db.close();}
});
test('SQL V2 periodic DOT bypasses shields and prevents lethal HOT recovery',async()=>{
 const db=await setup();try{
 const c={player_hp:4,player_max_hp:100,player_shield:30,player_turn:1,monster_hp:100,monster_max_hp:100,engine_runtime:{},player_effects:[{effectId:'poison',behavior:'PERIODIC_DAMAGE',amount:5,duration:2,stacks:1,createdTurn:0},{effectId:'regen',behavior:'PERIODIC_HEAL',amount:.1,duration:2,stacks:1,createdTurn:0}]};
 const r=await db.query<{a:any}>("select to_jsonb(private.combat_v2_periodic(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'player',1)) a",[JSON.stringify(c)]);assert.equal(r.rows[0].a.player_hp,0);assert.equal(r.rows[0].a.player_shield,30);
 }finally{await db.close();}
});
function combat(overrides={}){return {player_hp:180,player_max_hp:180,player_attack:18,player_defense:10,player_turn:1,monster_turn:0,monster_id:'test-multi',monster_hp:1000,monster_max_hp:1000,monster_attack:10,monster_defense:0,player_effects:[],monster_effects:[],player_shield:0,monster_shield:0,job_resource:0,job_flags:{},cooldowns:{},monster_cooldowns:{},crit_chance:.05,crit_damage:1.5,rng_seed:1,encounter_index:1,skill_power:1,engine_runtime:{},...overrides};}
test('SQL V2 hits emit outcomes, shields gate damage and killing blow cancels counter',async()=>{
 const db=await setup();try{
 let c=combat({monster_hp:1,monster_reactive_action:'counter'});
 let r=await db.query<{a:any}>("select to_jsonb(private.combat_v2_hit(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'player',1,1,1,1,true,0,null)) a",[JSON.stringify(c)]);assert.equal(r.rows[0].a.monster_hp,0);assert.equal(r.rows[0].a.player_hp,180);assert.equal(r.rows[0].a.engine_runtime.events[0].kind,'DIRECT_DAMAGE');
 c=combat({monster_effects:[{effectId:'guard',behavior:'STAT_MODIFIER',duration:2}],monster_shield:50});r=await db.query<{a:any}>("select to_jsonb(private.combat_v2_hit(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'player',1,1,1,1,true,0,null)) a",[JSON.stringify(c)]);assert.equal(r.rows[0].a.monster_hp,1000);assert.ok(r.rows[0].a.monster_shield<50);
 }finally{await db.close();}
});
test('SQL V2 job generator and spender match resource and exact cooldown semantics',async()=>{
 const db=await setup();try{
 const c=combat({job_id:'berserker'});const r=await db.query<{a:any}>("select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'berserker_skill_1',1)) a",[JSON.stringify(c)]);assert.equal(r.rows[0].a.job_resource,1);
 const s=await db.query<{a:any}>("select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'berserker_skill_3',2)) a",[JSON.stringify(combat({job_id:'berserker',job_resource:4}))]);assert.equal(s.rows[0].a.job_resource,1);assert.equal(s.rows[0].a.engine_runtime.playerReady['berserker_skill_3'],5);
 }finally{await db.close();}
});
const user='00000000-0000-0000-0000-000000000001',run='00000000-0000-0000-0000-000000000002';
async function seed(db:PGlite,overrides={}){
 await db.exec('truncate private.online_combat_states,private.online_expeditions,private.online_expedition_kills');
 await db.query("insert into private.online_expeditions(user_id,run_id,tower,floor,status,potion_lesser,potion_standard,potion_greater,potion_supreme,revival_count) values($1,$2,'ore',1,'ACTIVE',10,0,0,0,1)",[user,run]);
 const c=combat({user_id:user,run_id:run,phase:'PLAYER_TURN',action_nonce:0,state_version:1,turn_no:1,basic_hits:1,revival_count:1,potion_lesser:10,crit_chance:0,monster_id:'unknown',engine_runtime:{version:2,events:[]},...overrides});
 await db.query('insert into private.online_combat_states select * from jsonb_populate_record(null::private.online_combat_states,$1::jsonb)',[JSON.stringify(c)]);
}
async function rpc(db:PGlite,name:string,nonce:number,extra?:string){return (await db.query<{a:any}>(`select public.${name}($1::uuid,1::bigint,'client','device',$2::bigint${extra!==undefined?',$3::text':''}) a`,extra!==undefined?[user,nonce,extra]:[user,nonce])).rows[0].a;}
test('SQL V2 real RPCs preserve nonce authority, basic generation, turn cooldown and kill idempotency',async()=>{
 const db=await setup();try{
 await seed(db,{job_id:'contract_mercenary'});const first=await rpc(db,'apply_online_job_skill',1,'mercenary_skill_1');assert.equal(first.playerTurn,2);assert.equal(first.playerCooldowns['turn:mercenary_skill_1'],3);
 await assert.rejects(()=>rpc(db,'apply_online_job_skill',2,'mercenary_skill_1'),/COMBAT_SKILL_COOLDOWN/);
 await assert.rejects(()=>rpc(db,'apply_online_basic_attack',1),/COMBAT_ACTION_SEQUENCE_INVALID/);
 for(let n=2;n<=4;n++)await rpc(db,'apply_online_basic_attack',n);const fifth=await rpc(db,'apply_online_job_skill',5,'mercenary_skill_1');assert.equal(fifth.playerTurn,6);assert.equal(fifth.jobResource,3);
 await seed(db,{monster_hp:1});const kill=await rpc(db,'apply_online_basic_attack',1);assert.equal(kill.phase,'DEFEATED');assert.equal(kill.jobResource,0);await assert.rejects(()=>rpc(db,'apply_online_basic_attack',1),/COMBAT_PHASE_INVALID/);assert.equal((await db.query<{n:number}>('select count(*)::int n from private.online_expedition_kills')).rows[0].n,1);
 }finally{await db.close();}
});
test('SQL V2 potion count persists across actions, full HP overheals without crit, root blocks fleeing',async()=>{
 const db=await setup();try{
 await seed(db,{monster_attack:0});for(let n=1;n<=5;n++){const r=await rpc(db,'apply_online_potion',n,'healing_lesser');assert.equal(r.healingPotionUses,n);assert.ok(r.playerHp>180);assert.equal(r.combatEvents.find((x:any)=>x.kind==='HEAL').critical,false);}await assert.rejects(()=>rpc(db,'apply_online_potion',6,'healing_lesser'),/COMBAT_POTION_LIMIT/);
 await seed(db,{player_effects:[{effectId:'root',duration:1,createdTurn:0,behavior:'CONTROL'}]});await assert.rejects(()=>rpc(db,'apply_online_flee',1),/COMBAT_ROOTED/);
 }finally{await db.close();}
});
test('SQL V2 periodic death interrupts before HOT and revival resumes monster turn without shield',async()=>{
 const db=await setup();try{
 await seed(db,{player_hp:4,player_shield:30,monster_attack:0,player_effects:[{effectId:'poison',duration:2,stacks:1,createdTurn:0,behavior:'PERIODIC_DAMAGE',amount:5},{effectId:'regen',duration:3,stacks:1,createdTurn:0,behavior:'PERIODIC_HEAL',amount:.1}]});
 const dead=await rpc(db,'apply_online_flee',1);assert.equal(dead.playerHp,0);assert.equal(dead.pendingRevival,true);assert.equal(dead.monsterTurn,0);assert.equal(dead.revivalResumeTurn,'MONSTER_TURN');assert.equal(dead.fled,false);
 const revived=(await db.query<{a:any}>("select public.resolve_online_revival($1::uuid,1::bigint,'client','device',true) a",[user])).rows[0].a;assert.equal(revived.playerHp,53);assert.equal(revived.playerShield,0);assert.equal(revived.monsterTurn,1);assert.equal(revived.playerTurn,2);assert.equal(revived.pendingRevival,false);
 }finally{await db.close();}
});
test('SQL V2 revival during event cannot mint a second combat reward',async()=>{
 const db=await setup();try{
 await seed(db,{player_hp:0,monster_hp:0,pending_revival:true,phase:'PLAYER_DEAD'});await db.exec("update private.online_expeditions set confirmed_kills=1,pending_event='{\"state\":\"RESULT\"}'");
 const result=(await db.query<{a:any}>("select public.resolve_online_revival($1::uuid,1::bigint,'client','device',true) a",[user])).rows[0].a;assert.equal(result.confirmedKills,1);assert.equal(result.playerHp,54);assert.equal((await db.query<{n:number}>('select count(*)::int n from private.online_expedition_kills')).rows[0].n,0);
 }finally{await db.close();}
});
test('SQL V2 shared catalog is reproducible and private helpers cannot be executed by clients',async()=>{
 const db=await setup();try{
 const {combatCatalog,catalogSql}=await import('../scripts/generateCombatSqlCatalog.ts');assert.equal(read('../supabase/combat-v2-catalog.sql'),catalogSql);assert.deepEqual((await db.query<{a:any}>('select private.combat_v2_catalog() a')).rows[0].a,combatCatalog);
 const privileges=await db.query<{n:number}>("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'combat_v2_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))");assert.equal(privileges.rows[0].n,0);
 }finally{await db.close();}
});
test('SQL V2 weighted AI, immunity and one-shot phase progression use authored metadata',async()=>{
 const db=await setup();try{
 const data=(await db.query<{a:any}>('select private.combat_v2_catalog() a')).rows[0].a;
 data.monsters.custom={id:'custom',name:'custom',effectImmunities:['stun'],skills:[{id:'a',kind:'damage',cooldown:0,weight:1},{id:'b',kind:'damage',cooldown:0,weight:3}],aiRules:[],phases:[{id:'one'},{id:'two',when:{kind:'EVENT_FLAG',flag:'once'}},{id:'three',when:{kind:'EVENT_FLAG',flag:'once'}}]};
 await db.exec(`create or replace function private.combat_v2_catalog() returns jsonb language sql immutable set search_path='' as $fn$ select $data$${JSON.stringify(data)}$data$::jsonb $fn$;create or replace function private.server_roll(p_seed bigint,p_encounter bigint,p_nonce bigint,p_hit int) returns numeric language sql immutable as $$ select .9::numeric $$;`);
 const c=combat({monster_id:'custom',engine_runtime:{version:2,eventFlags:{once:true}}});const state=(await db.query<{a:any}>("select to_jsonb(private.combat_v2_phase(jsonb_populate_record(null::private.online_combat_states,$1::jsonb))) a",[JSON.stringify(c)])).rows[0].a;
 assert.equal(state.engine_runtime.phaseId,'two');assert.equal(state.engine_runtime.eventFlags.once,false);
 const immune=(await db.query<{a:any}>("select to_jsonb(private.combat_v2_effect(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'monster','stun','player')) a",[JSON.stringify(state)])).rows[0].a;assert.equal(immune.monster_effects.length,0);
 const decision=(await db.query<{a:any}>("select private.combat_v2_monster_decision(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),1) a",[JSON.stringify(state)])).rows[0].a;assert.equal(decision.action.id,'b');
 }finally{await db.close();}
});
test('SQL V2 prepared attack survives silence, stun cancels it, and cooldown blocks exact monster turns',async()=>{
 const db=await setup();try{
 let c=combat({monster_id:'test-charge',engine_runtime:{version:2,events:[]},monster_prepared_action:'charge',monster_effects:[{effectId:'silence',duration:1,behavior:'CONTROL',createdTurn:0}]});
 let r=(await db.query<{a:any}>("select private.resolve_server_monster_turn_v2(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),1) a",[JSON.stringify(c)])).rows[0].a;assert.equal(r.action.prepared,true);assert.equal(r.state.monster_prepared_action,null);assert.equal(r.state.engine_runtime.monsterReady.charge,4);
 c=r.state;c.monster_effects=[];
 for(let i=0;i<2;i++){r=(await db.query<{a:any}>("select private.resolve_server_monster_turn_v2(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),2) a",[JSON.stringify(c)])).rows[0].a;assert.equal(r.action.id,'basic');c=r.state;}
 r=(await db.query<{a:any}>("select private.resolve_server_monster_turn_v2(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),3) a",[JSON.stringify(c)])).rows[0].a;assert.equal(r.action.kind,'CHARGE');
 const stunned=(await db.query<{a:any}>("select to_jsonb(private.combat_v2_effect(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),'monster','stun','player')) a",[JSON.stringify(r.state)])).rows[0].a;assert.equal(stunned.monster_prepared_action,null);
 }finally{await db.close();}
});
test('SQL V2 counter death resumes the interrupted player action at the monster turn',async()=>{
 const db=await setup();try{
 await seed(db,{player_hp:1,monster_id:'test-reactive',monster_attack:100,monster_reactive_action:'counter'});
 const dead=await rpc(db,'apply_online_basic_attack',1);assert.equal(dead.pendingRevival,true);assert.equal(dead.monsterTurn,0);assert.equal(dead.revivalResumeTurn,'MONSTER_TURN');
 }finally{await db.close();}
});
test('SQL V2 potion allowance resets when a new expedition reuses the user row',async()=>{
 const db=await setup();try{
 await seed(db);await db.exec('update private.online_expeditions set healing_potion_uses=5');
 await db.query('update private.online_expeditions set run_id=$1',["00000000-0000-0000-0000-000000000003"]);
 assert.equal((await db.query<{n:number}>('select healing_potion_uses n from private.online_expeditions')).rows[0].n,0);
 }finally{await db.close();}
});
test('SQL V2 legacy migration preserves shield pools, ready turns and effect ownership',async()=>{
 const db=await setup();try{
 await seed(db,{job_resource:75,engine_runtime:{},cooldowns:{'turn:mercenary_skill_1':2},player_shield:90,player_effects:[{effectId:'regen',duration:2,stacks:3,createdTurn:0,behavior:'PERIODIC_HEAL',amount:.1}]});
 await db.exec(read('../supabase/combat-v2-cutover.sql'));
 const c=(await db.query<{a:any}>('select to_jsonb(c) a from private.online_combat_states c')).rows[0].a;
 assert.equal(c.job_resource,3);assert.equal(c.engine_runtime.playerReady.mercenary_skill_1,3);assert.equal(c.player_shield,90);assert.equal(c.player_effects[0].sourceActorId,'player');assert.equal(c.player_effects[0].stacks,1);assert.equal(c.player_effects[1].currentShield,90);assert.equal(c.state_version,2);
 await db.exec(read('../supabase/combat-v2-cutover.sql'));assert.equal((await db.query<{n:number}>('select state_version n from private.online_combat_states')).rows[0].n,2);
 }finally{await db.close();}
});

test('SR online skills execute approved damage, resource and effect duration',async()=>{
 const db=await setup();try{
  const invoke=async(job:string,id:string,extra={})=>(await db.query<{a:any}>("select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),$2,1)) a",[JSON.stringify(combat({job_id:job,crit_chance:0,...extra})),id])).rows[0].a;
  const poison=await invoke('mutagen_doctor','mutagen_doctor_skill_1');assert.equal(poison.job_resource,1);assert.equal(poison.monster_hp,971);assert.equal(poison.monster_effects[0].duration,3);
  const extended=await invoke('mutagen_doctor','mutagen_doctor_skill_1',{monster_effects:poison.monster_effects});assert.equal(extended.monster_effects[0].duration,6);
  const guard=await invoke('return_guardian','return_guardian_skill_2');assert.equal(guard.player_effects[0].duration,2);
  const burst=await invoke('boss_tracker','boss_tracker_skill_3',{job_resource:3});assert.equal(burst.job_resource,0);assert.equal(burst.monster_hp,916);
 }finally{await db.close();}
});

test('new online encounters preserve the expedition job for every SR kit',async()=>{
 const db=await setup();try{
  await db.exec(read('../supabase/migrations/20261005123000_preserve_all_job_ids_in_online_combat.sql'));
  await db.exec(`
   create unique index encounter_user on private.online_combat_states(user_id);
   create function private.server_authoritative_payload(uuid,jsonb) returns jsonb language sql as $$select $2$$;
   create function private.combat_equipment_stats(uuid,jsonb) returns jsonb language sql as $$select '{"hp":180,"attack":18,"defense":10,"weapon":"sword"}'::jsonb$$;
   create function private.combat_accessory_passive(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
   create function private.combat_skill_power(jsonb) returns numeric language sql as $$select 1::numeric$$;
   create function private.server_monster_hp(int) returns numeric language sql as $$select 1000::numeric$$;
   create function private.server_monster_attack(int) returns numeric language sql as $$select 10::numeric$$;
   create function private.server_monster_defense(int) returns numeric language sql as $$select 0::numeric$$;
   create function private.server_initial_monster_effects(text,bigint) returns jsonb language sql as $$select '[]'::jsonb$$;
  `);
  await db.query('insert into public.game_saves(user_id,payload) values($1,$2)',[user,'{}']);
  for(const id of ['berserker','mutagen_doctor','soulcaster','ascetic_fighter','field_engineer','green_crown_martyr','unity_apostle','deep_rescue_officer','boss_tracker','return_guardian','green_crown_inquisitor']){
   const runData={user_id:user,run_id:run,tower:'ore',floor:1,encounter_index:1,reward_seed:1,job_snapshot_id:id,equipment_snapshot:{}};
   const r=await db.query<{a:any}>(`select to_jsonb(private.server_start_encounter($1,jsonb_populate_record(null::private.online_expeditions,$2::jsonb),'{"id":"unknown","hpMultiplier":1,"attackMultiplier":1}',null::private.online_combat_states)) a`,[user,JSON.stringify(runData)]);
   assert.equal(r.rows[0].a.job_id,id);
   const skill=await db.query<{a:any}>(`select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),$2,1)) a`,[JSON.stringify(r.rows[0].a),id+'_skill_1']);
   assert.equal(skill.rows[0].a.job_resource,1,id);
  }
  await db.query("insert into private.online_expeditions(user_id,run_id,status,job_snapshot_id) values($1,$2,'ACTIVE','green_crown_inquisitor')",[user,run]);
  await db.exec('update private.online_combat_states set job_id=null');
  await db.exec(read('../supabase/migrations/20261006134507_preserve_catalog_job_at_encounter_start.sql'));
  assert.equal((await db.query<{job_id:string}>('select job_id from private.online_combat_states')).rows[0].job_id,'green_crown_inquisitor');
 }finally{await db.close();}
});

test('SSR online kits execute all skills and preserve critical, recovery and resource rules',async()=>{
 const db=await setup();try{
  await db.exec(read('../supabase/migrations/20261007022840_register_ssr_combat_skills.sql'));
  await db.exec(read('../supabase/migrations/20261007022840_register_ssr_combat_skills.sql'));
  const invoke=async(job:string,i:number,extra={})=>(await db.query<{a:any}>("select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),$2,1)) a",[JSON.stringify(combat({job_id:job,crit_chance:0,player_hp:90,job_resource:4,...extra})),job+'_skill_'+i])).rows[0].a;
  for(const job of ['dragonblood_knight','sealed_archivist','corpse_tuner','self_alchemist','black_carriage_gambler','false_saint_proxy','hundred_battle_returnee'])for(let i=1;i<=3;i++){const r=await invoke(job,i);assert.ok(r.player_hp>0,job);if(i===3)assert.equal(r.job_resource,job==='black_carriage_gambler'?0:1,job);}
  const alchemy=await invoke('self_alchemist',2,{player_hp:1,job_resource:0});assert.equal(alchemy.player_hp,1);assert.equal(alchemy.job_resource,2);
  const crit=await invoke('black_carriage_gambler',2,{job_resource:0});assert.equal(crit.monster_hp,925);assert.equal(crit.job_resource,1);
  const low=await invoke('hundred_battle_returnee',3);const high=await invoke('hundred_battle_returnee',3,{player_hp:180});assert.ok(low.monster_hp<high.monster_hp);assert.equal(low.player_hp,153);
 }finally{await db.close();}
});

test('remaining C online kits execute fifteen skills and use attack healing and percent shields',async()=>{
 const db=await setup();try{
  const before=(await db.query<{a:any}>('select private.combat_v2_catalog() a')).rows[0].a;
  await db.exec(read('../supabase/migrations/20261007041705_register_remaining_c_combat_skills.sql'));
  await db.exec(read('../supabase/migrations/20261007041705_register_remaining_c_combat_skills.sql'));
  const after=(await db.query<{a:any}>('select private.combat_v2_catalog() a')).rows[0].a;assert.deepEqual(after,before);assert.equal(Object.keys(after.jobs).length,48);
  const invoke=async(job:string,i:number,extra={})=>(await db.query<{a:any}>("select to_jsonb(private.combat_v2_job_skill(jsonb_populate_record(null::private.online_combat_states,$1::jsonb),$2,1)) a",[JSON.stringify(combat({job_id:job,crit_chance:0,player_hp:90,job_resource:4,...extra})),job+'_skill_'+i])).rows[0].a;
  for(const job of ['excavator','reclaimer','green_crown_pilgrim','porter','guide'])for(let i=1;i<=3;i++){
   const r=await invoke(job,i);assert.ok(r.player_hp>0,job);
   assert.equal(r.job_resource,i===3?(job==='excavator'?1:2):4,job);
   if(i===1){assert.ok(r.monster_hp<1000);assert.equal(r.engine_runtime.playerReady[job+'_skill_1'],2);}
  }
  assert.equal((await invoke('reclaimer',2)).player_hp,99);
  assert.equal((await invoke('reclaimer',3)).player_hp,104);
  assert.equal((await invoke('green_crown_pilgrim',3)).player_hp,124);
  const prayer=await invoke('green_crown_pilgrim',2);
  assert.deepEqual(prayer.player_effects.map((x:any)=>[x.effectId,x.duration]),[['c_attack_15',3],['c_defense_25',3]]);
  assert.equal((await invoke('green_crown_pilgrim',3,{player_effects:prayer.player_effects})).player_hp,129);
  assert.equal((await invoke('porter',2,{player_max_hp:1000})).player_shield,180);
  assert.equal((await invoke('porter',3,{player_max_hp:1000})).player_shield,300);
  const excavator=await invoke('excavator',3);assert.equal(excavator.monster_effects[0].effectId,'stun');assert.equal(excavator.monster_effects[0].duration,1);
  const guide=await invoke('guide',3);assert.equal(guide.monster_effects[0].effectId,'silence');assert.equal(guide.monster_effects[0].duration,1);
 }finally{await db.close();}
});
