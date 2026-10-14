import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
export const user=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const request=(n:number)=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
let shared:PGlite|null=null;
test.after(async()=>{await shared?.close();});
export async function fixture(){
 const first=!shared;const db=shared??(shared=new PGlite());
 if(!first)await db.exec('drop schema private cascade;drop schema auth cascade;drop schema public cascade;create schema public');
 await db.exec(read('./villageWarStageOneFixture.sql').replace(first?'__unused__':'create role anon;create role authenticated;',''));
 const catalog=read('../supabase/migrations/20261011194500_hunting_catalog_combat.sql');
 await db.exec(catalog.slice(catalog.indexOf('create or replace function private.hunting_skill_spec'),catalog.indexOf('CREATE OR REPLACE FUNCTION private.refresh_hunting_state')));
 const stats=read('../supabase/migrations/20261008100000_hunting_six_stats.sql');
 const start=stats.indexOf('create or replace function private.hunting_damage');
 await db.exec(stats.slice(start,stats.indexOf('revoke all on function private.hunting_damage',start)));
 await db.exec(read('../supabase/migrations/20261014040726_village_war_stage_one.sql'));
 await db.exec(read('../supabase/migrations/20261014054540_village_war_stage_two.sql'));
 await db.exec(`create table private.qa_clock(t timestamptz);insert into private.qa_clock values('2026-10-17T13:00:00Z');create or replace function private.village_war_clock() returns timestamptz language sql volatile as $$select t from private.qa_clock$$;update private.village_war_settings set enabled=true;`);
 return db;
}
async function state(db:PGlite,u=3,town='city'){return (await db.query<any>(`select public.get_village_war_state($1,1,'client','device',$2) result`,[user(u),town])).rows[0].result;}
async function claim(db:PGlite,n:number,front:number,u=3,town='city'){const s=await state(db,u,town);return (await db.query<any>(`select public.claim_empty_village_war_front($1,1,'client','device',$2,$3,$4,0,$5) result`,[user(u),request(n),town,front,s.eventId])).rows[0].result;}
test('stage two integrates seconds and caps exact early victory even on a late first read',async()=>{const db=await fixture();try{
 const s=await state(db);await db.exec(`insert into private.village_war_intervals(event_id,front_id,association_id,starts_at) select '${s.eventId}',n,'33333333-3333-4333-8333-333333333333','2026-10-17T13:00:00Z' from generate_series(1,5)n; update private.qa_clock set t='2026-10-17T13:55:00Z';`);
 const end=await state(db);assert.equal(end.phase,'ENDED');assert.equal(end.winnerAssociationId,'33333333-3333-4333-8333-333333333333');assert.equal(Date.parse(end.settledAt),Date.parse('2026-10-17T13:30:00Z'));assert.equal(Number(end.scores[0].points),150);assert.deepEqual((await state(db)).scores,end.scores);
 await assert.rejects(()=>claim(db,1,1),/WAR_ENDED|WAR_PHASE_INVALID/);
 assert.equal((await db.query<any>(`select products->>'challenge_ticket' t from private.village_life_players where user_id=$1`,[user(3)])).rows[0].t,'2');
}finally{/* shared fixture is closed once after all tests */}});
test('stage two transfers score intervals and preserves owner on an exact tie',async()=>{const db=await fixture();try{
 const s=await state(db);await db.exec(`update private.village_war_events set owner_association_id='22222222-2222-4222-8222-222222222222' where event_id='${s.eventId}';insert into private.village_war_intervals(event_id,front_id,association_id,starts_at,ends_at) values('${s.eventId}',1,'22222222-2222-4222-8222-222222222222','2026-10-17T13:00:00Z','2026-10-17T13:00:30Z'),('${s.eventId}',1,'33333333-3333-4333-8333-333333333333','2026-10-17T13:00:30Z','2026-10-17T13:01:00Z');update private.qa_clock set t='2026-10-17T14:05:00Z';`);
 const end=await state(db);assert.equal(end.winnerAssociationId,null);assert.equal(end.ownerAssociationId,'22222222-2222-4222-8222-222222222222');assert.ok(end.scores.every((x:any)=>Number(x.points)===.5));
}finally{/* shared fixture is closed once after all tests */}});
test('stage two attack keeps defender resources, records real rounds and replays reward once',async()=>{const db=await fixture();try{
 await claim(db,10,1,3);const s=await state(db,2);await db.exec(`insert into private.village_war_declarations values('2026-10-12','city','22222222-2222-4222-8222-222222222222');`);
 const call=()=>db.query<any>(`select public.attack_village_war_front($1,1,'client','device',$2,'city',1,1,$3) result`,[user(2),request(11),s.eventId]);
 const first=(await call()).rows[0].result;assert.ok(first.result.battle.turns.length>0);assert.ok(first.result.battle.turns.length<=100);assert.equal(first.result.ticketsSpent,1);assert.equal(first.state.tickets,1);
 const again=(await call()).rows[0].result;assert.equal(again.replayed,true);assert.deepEqual(again.result,first.result);assert.equal(again.state.tickets,1);
 assert.equal((await db.query<any>('select count(*)::int n from private.village_war_battles')).rows[0].n,1);
}finally{/* shared fixture is closed once after all tests */}});

test('catalog PvP rotates real actives, spends MP, applies enhancement and caps 100 rounds',async()=>{const db=await fixture();try{
 await db.exec(`create or replace function private.village_war_random() returns double precision language sql as $$select .4::float8$$;`);
 const snap=(skills:any[],attack=10,hp=10000)=>({name:'시험',maxHp:hp,maxMp:100,stats:{hp,attack,defense:10,critChance:0,critDamage:1.5,armorPenetration:0,weapon:'sword'},skills,loadout:[]});
 const a=snap([{id:'sword_strike_c',enhancement:3},{id:'sword_wound_c',enhancement:0}]);const b=snap([]);
 const result=(await db.query<any>('select private.village_war_combat($1,$2,10000,100) r',[a,b])).rows[0].r;
 assert.equal(result.turns.length,100);assert.match(result.turns[0].lines[0],/sword_strike_c/);assert.match(result.turns[1].lines[0],/sword_wound_c/);assert.ok(result.attackerMp<100);assert.ok(result.defenderHp<10000);
 const forged=snap([{id:'staff_flame_ssr',enhancement:3}]);const ignored=(await db.query<any>('select private.village_war_combat($1,$2,10000,100) r',[forged,b])).rows[0].r;assert.equal(ignored.defenderHp,10000);
}finally{/* shared fixture is closed once after all tests */}});
test('defense reward and damage are exactly once; capture restores new defender and closes ownership',async()=>{const db=await fixture();try{
 await db.exec(`create or replace function private.village_war_random() returns double precision language sql as $$select .4::float8$$;insert into private.learned_catalog_skills values('${user(2)}','sword_strike_c',0);update private.hunting_states set skills='{sword_strike_c}' where user_id='${user(2)}';insert into private.village_war_declarations values('2026-10-12','city','22222222-2222-4222-8222-222222222222');`);
 await claim(db,50,1,3);const s=await state(db,2);await db.exec(`update private.village_war_fronts set hp=10000,max_hp=10000,snapshot=jsonb_set(jsonb_set(snapshot,'{maxHp}','10000'),'{stats,defense}','10000') where event_id='${s.eventId}' and front_id=1;`);
 const call=async(n:number)=>(await db.query<any>(`select public.attack_village_war_front($1,1,'client','device',$2,'city',1,1,$3) r`,[user(2),request(n),s.eventId])).rows[0].r;
 const first=await call(51);assert.equal(first.result.battle.outcome,'DEFENDED');assert.equal(first.result.battle.defenderReward,1);assert.ok(first.state.fronts[0].hp<10000);assert.equal(first.state.fronts[0].defenderEpoch,1);assert.equal(first.state.fronts[0].revision,2);
 await call(51);assert.equal((await db.query<any>(`select products->>'challenge_ticket' t from private.village_life_players where user_id=$1`,[user(3)])).rows[0].t,'2');
 await assert.rejects(()=>call(52),/WAR_ATTACK_COOLDOWN/);
 await db.exec(`update private.qa_clock set t='2026-10-17T13:00:31Z';update private.village_war_fronts set hp=1 where event_id='${s.eventId}' and front_id=1;`);
 const capture=await call(53);assert.equal(capture.result.battle.outcome,'CAPTURE');assert.equal(capture.state.fronts[0].defenderUserId,user(2));assert.equal(capture.state.fronts[0].hp,capture.state.fronts[0].maxHp);assert.equal(capture.state.fronts[0].mp,capture.state.fronts[0].maxMp);assert.equal(capture.state.fronts[0].defenderEpoch,2);assert.equal(capture.result.battle.defenderReward,0);
 assert.equal((await db.query<any>('select count(*)::int n from private.village_war_intervals where ends_at is not null')).rows[0].n,1);
 const score=capture.state.scores.find((x:any)=>x.associationId==='33333333-3333-4333-8333-333333333333');assert.equal(Number(score.points),31/60);
 await assert.rejects(()=>db.query(`select public.attack_village_war_front($1,1,'client','device',$2,'city',1,1,$3)`,[user(4),request(54),s.eventId]),/WAR_DEFENDER_CHANGED/);
}finally{/* shared fixture is closed once after all tests */}});

test('settlement runs offline, tie breaks by fronts and public clients cannot call private helpers',async()=>{const db=await fixture();try{
 await db.exec(`update private.qa_clock set t='2026-10-17T12:56:00Z';insert into private.village_war_owners values('city','22222222-2222-4222-8222-222222222222',null);`);
 const s=await state(db,2);await db.query(`select public.place_village_war_defender($1,1,'client','device',$2,'city',1,0,$3)`,[user(2),request(80),s.eventId]);
 await db.exec(`update private.qa_clock set t='2026-10-17T14:01:00Z';select private.settle_village_wars();`);
 const e=(await db.query<any>('select settled_at,winner_association_id from private.village_war_events where event_id=$1',[s.eventId])).rows[0];assert.ok(e.settled_at);assert.equal(e.winner_association_id,'22222222-2222-4222-8222-222222222222');
 const access=(await db.query<any>(`select has_function_privilege('anon','public.attack_village_war_front(uuid,bigint,text,text,uuid,text,int,bigint,uuid)','EXECUTE') anon,has_function_privilege('authenticated','private.village_war_combat(jsonb,jsonb,numeric,numeric)','EXECUTE') helper`)).rows[0];assert.equal(access.anon,false);assert.equal(access.helper,false);
}finally{/* shared fixture is closed once after all tests */}});
test('all authored skill families use actual server power, MP and effects symmetrically',async()=>{const db=await fixture();try{
 await db.exec(`create or replace function private.village_war_random() returns double precision language sql as $$select .4::float8$$;`);
 const specs=(await db.query<any>(`select private.hunting_skill_spec('sword_strike_c') s`)).rows[0].s;assert.equal(specs.power,75);
 const catalog=JSON.parse(read('../src/game/hunting/catalogSkillSpecs.json'));
 for(const [id,spec] of Object.entries(catalog) as [string,any][]){
  const snap={name:id,maxHp:1000,maxMp:1000,stats:{attack:40,defense:10,critChance:0,critDamage:1.5,armorPenetration:0,weapon:spec.weapon==='any'?'sword':spec.weapon},skills:[{id,enhancement:3}],loadout:[]};
  const target={...snap,name:'대상',skills:[]};
  const a=(await db.query<any>('select private.village_war_fighter($1,400,100) a',[snap])).rows[0].a;
  const b=(await db.query<any>('select private.village_war_fighter($1,1000,1000) a',[target])).rows[0].a;
  const step=(await db.query<any>('select private.village_war_step($1,$2,1) s',[a,b])).rows[0].s;
  assert.ok(Array.isArray(step.lines),id);
  if(spec.type==='active'){
   const usable=spec.mp<=100;
   assert.equal(step.a.mp,usable?spec.family==='restore'?Math.min(1000,100+Math.round(spec.power*1.15)):100-spec.mp:100,id);
   if(usable&&spec.family==='heal')assert.ok(step.a.hp>400,id);
   if(usable&&spec.family==='shield')assert.ok(step.a.shield>0,id);
   if(usable&&spec.family==='prepare')assert.ok(step.a.prep>0,id);
   if(usable&&['sword_strike','sword_wound','bow_shot','bow_volley','staff_flame','staff_rift'].includes(spec.family))assert.ok(step.b.hp<1000,id);
  }else if(spec.family==='return_oath'){assert.equal(a.snapshot.maxHp,1173);assert.equal(a.oath,true);}
 }
}finally{/* shared fixture is closed once after all tests */}});

test('mixed legacy and learned catalog presets preserve the complete active order',async()=>{const db=await fixture();
 const snap={name:'혼합',maxHp:180,maxMp:100,stats:{weapon:'sword'},skills:[{id:'sword_strike_c',enhancement:1}],loadout:['heavy','sword_strike_c','guard']};
 const p=(await db.query<any>('select private.village_war_prepare($1) s',[snap])).rows[0].s;
 assert.deepEqual(p.activeSkills.map((x:any)=>x.id),snap.loadout);
});
test('exact early cutoff releases a defender attacking another town before cron ticks',async()=>{const db=await fixture();
 await claim(db,90,1,3);const s=await state(db);await db.exec(`insert into private.village_war_intervals(event_id,front_id,association_id,starts_at) select '${s.eventId}',n,'33333333-3333-4333-8333-333333333333','2026-10-17T13:00:00Z' from generate_series(2,5)n;update private.qa_clock set t='2026-10-17T13:30:01Z';`);
 const other=await state(db,3,'herb-1');assert.equal(other.myDefendingFront,null);
 const result=await claim(db,91,1,3,'herb-1');assert.equal(result.result.ticketsSpent,1);
});

test('DOT starts next round and legacy guard halves exactly one incoming attack',async()=>{const db=await fixture();
 await db.exec(`create or replace function private.village_war_random() returns float8 language sql as $$select .4::float8$$;`);
 const snap=(id:string)=>({name:id,maxHp:1000,maxMp:100,stats:{attack:40,defense:0,weapon:'sword',critChance:0},skills:id==='sword_wound_c'?[{id,enhancement:0}]:[],loadout:[id]});
 const fighter=async(id:string)=>(await db.query<any>('select private.village_war_fighter($1,1000,100) a',[snap(id)])).rows[0].a;
 const a=await fighter('sword_wound_c'),b={...await fighter('guard'),hp:400};
 const hit=(await db.query<any>('select private.village_war_step($1,$2,1) s',[a,b])).rows[0].s;
 const defended=(await db.query<any>('select private.village_war_step($1,$2,1) s',[hit.b,hit.a])).rows[0].s;
 assert.equal(defended.a.hp,hit.b.hp,'DOT must not tick on the application round');
 assert.equal(defended.a.shield,0,'legacy guard is damage reduction, not a max-HP shield');
 const damage=(await db.query<any>('select private.village_war_damage($1,100,1) f',[defended.a])).rows[0].f;
 assert.equal(damage.hp,defended.a.hp-50);
 const twice=(await db.query<any>('select private.village_war_damage($1,100,1) f',[damage])).rows[0].f;
 assert.equal(twice.hp,damage.hp-100);
});

test('threshold sweep reconstructs a rate change before a delayed settlement',async()=>{const db=await fixture();const s=await state(db);
 await db.exec(`insert into private.village_war_intervals(event_id,front_id,association_id,starts_at,ends_at) select '${s.eventId}',n,'33333333-3333-4333-8333-333333333333','2026-10-17T13:00:00Z','2026-10-17T13:14:00Z' from generate_series(1,3)n;insert into private.village_war_intervals(event_id,front_id,association_id,starts_at) select '${s.eventId}',n,'33333333-3333-4333-8333-333333333333','2026-10-17T13:14:00Z' from generate_series(1,5)n;update private.qa_clock set t='2026-10-17T13:55:00Z';`);
 const end=await state(db);assert.equal(Date.parse(end.settledAt),Date.parse('2026-10-17T13:35:36Z'));assert.equal(Number(end.scores[0].points),150);
});
