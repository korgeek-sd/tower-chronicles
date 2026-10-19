import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const leader='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
const guild='33333333-3333-4333-8333-333333333333',foreign='44444444-4444-4444-8444-444444444444';
const request=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');
function functionSql(source:string,name:string){
 const start=source.toLowerCase().indexOf('create or replace function '+name+'(');
 assert.ok(start>=0,name);
 const body=source.slice(start),marker=/as\s+(\$[a-z_]*\$)/i.exec(body)!;
 const end=body.indexOf(marker[1],marker.index+marker[0].length)+marker[1].length;
 return body.slice(0,end)+';';
}
async function setup(){
 const db=new PGlite();
 try {
 await db.exec(read('./guildMaterialDatabaseFixture.sql'));
 const source=read('../supabase/migrations/20261015013000_guild_village_material_tax_auction.sql');
 // Load the actual material subsystem; unrelated gather/combat functions use separate fixtures.
 await db.exec(source.slice(0,source.indexOf('create or replace function private.guild_materials_state')));
 for(const name of ['private.guild_materials_state','public.get_guild_materials','public.set_guild_village_tax','public.transfer_guild_material','public.register_guild_material_auction','public.recover_guild_material_auction'])await db.exec(functionSql(source,name));
 await db.exec(source.slice(source.indexOf('revoke all on function public.get_guild_materials')));
 await db.exec(read('../supabase/migrations/20261015014500_guild_material_expedition_guard.sql'));
 const patch=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(p=>p.endsWith('_guild_material_request_hardening.sql'));
 if(patch)await db.exec(read('../supabase/migrations/'+patch));
 await db.query('insert into auth.users values($1),($2)',[leader,member]);
 await db.query("insert into private.online_associations values($1,$2,'ACTIVE','mine'),($3,$4,'ACTIVE','foreign')",[guild,leader,foreign,member]);
 await db.query("insert into private.online_association_members values($1,$2,'LEADER'),($3,$4,'LEADER')",[guild,leader,foreign,member]);
 await db.query("insert into public.game_saves values($1,'{\"expedition\":null}'),($2,'{\"expedition\":null}')",[leader,member]);
 await db.query("insert into private.village_life_players values($1,'{\"herb\":50}','{}'),($2,'{\"herb\":50}','{}')",[leader,member]);
 await db.query("insert into private.guild_material_stock values($1,'herb',1000),($2,'herb',2000)",[guild,foreign]);
 return db;
 }catch(error){await db.close();throw error;}
}
const register=async(db:PGlite,u=leader,n=1,material:string|null='herb',qty=100,price=50)=>(await db.query<{r:any}>(
 'select public.register_guild_material_auction($1::uuid,1,\'client\',\'device\',$2::uuid,$3,$4,$5) r',[u,request(n),material,qty,price])).rows[0].r;
const transfer=async(db:PGlite,n:number,direction:string|null,material:string|null='herb',qty=10)=>(await db.query<{r:any}>(
 'select public.transfer_guild_material($1::uuid,1,\'client\',\'device\',$2::uuid,$3,$4,$5) r',[leader,request(n),direction,material,qty])).rows[0].r;
const stock=async(db:PGlite)=>(await db.query<{n:number}>('select quantity::int n from private.guild_material_stock where association_id=$1 and material=\'herb\'',[guild])).rows[0].n;

test('material auction registration, retries and returns change only the owning guild once',async()=>{
 const db=await setup();try{
  assert.equal((await register(db)).replayed,false);
  assert.equal((await register(db)).replayed,true);
  assert.equal(await stock(db),900);
  await assert.rejects(register(db,leader,1,'herb',101),/GUILD_MATERIAL_REQUEST_CONFLICT/);
  const listing=(await db.query<{id:string}>('select listing_id id from private.guild_auction_listings')).rows[0].id;
  await assert.rejects(db.query('select public.recover_guild_material_auction($1,1,\'client\',\'device\',$2)',[member,listing]),/GUILD_MATERIAL_AUCTION_INVALID/);
  for(let i=0;i<2;i++)await db.query('select public.recover_guild_material_auction($1,1,\'client\',\'device\',$2)',[leader,listing]);
  assert.equal(await stock(db),1000);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.guild_material_ledger')).rows[0].n,2);
  await db.query("update private.online_association_members set role='MEMBER' where user_id=$1",[leader]);
  await assert.rejects(register(db,leader,2),/GUILD_LEADER_ONLY/);
 }finally{await db.close();}
});
test('material mutations reject missing enum inputs before stock changes',async()=>{
 const db=await setup();try{
  await assert.rejects(transfer(db,2,null),/GUILD_MATERIAL_INPUT_INVALID/);
  await assert.rejects(transfer(db,3,'DEPOSIT',null),/GUILD_MATERIAL_INPUT_INVALID/);
  await assert.rejects(register(db,leader,4,null),/GUILD_MATERIAL_INPUT_INVALID/);
  assert.equal(await stock(db),1000);
 }finally{await db.close();}
});
test('a ledger failure rolls back auction escrow and permits the same request to succeed later',async()=>{
 const db=await setup();try{
  await db.exec("create function private.fail_ledger() returns trigger language plpgsql as $$begin raise exception 'INJECTED_LEDGER_FAILURE';end$$;create trigger fail_ledger before insert on private.guild_material_ledger for each row execute function private.fail_ledger();");
  await assert.rejects(register(db),/INJECTED_LEDGER_FAILURE/);
  assert.equal(await stock(db),1000);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from private.guild_auction_listings')).rows[0].n,0);
  await db.exec('drop trigger fail_ledger on private.guild_material_ledger');
  assert.equal((await register(db)).replayed,false);
  assert.equal(await stock(db),900);
 }finally{await db.close();}
});
test('material transfers bind receipts to direction and keep personal plus guild inventory constant',async()=>{
 const db=await setup();try{
  assert.equal((await transfer(db,10,'DEPOSIT')).replayed,false);
  assert.equal((await transfer(db,10,'DEPOSIT')).replayed,true);
  assert.equal(await stock(db),1010);
  await assert.rejects(transfer(db,10,'WITHDRAW'),/GUILD_MATERIAL_REQUEST_CONFLICT/);
  assert.equal((await transfer(db,11,'WITHDRAW')).replayed,false);
  assert.equal((await transfer(db,11,'WITHDRAW')).replayed,true);
  assert.equal(await stock(db),1000);
  const own=(await db.query<{n:number}>("select (materials->>'herb')::int n from private.village_life_players where user_id=$1",[leader])).rows[0].n;
  assert.equal(own,50);
  await assert.rejects(transfer(db,12,'DEPOSIT','herb',51),/GUILD_MATERIAL_PERSONAL_SHORT/);
  await assert.rejects(transfer(db,13,'WITHDRAW','herb',1001),/GUILD_MATERIAL_STOCK_SHORT/);
  assert.equal(await stock(db),1000);
 }finally{await db.close();}
});
test('the patch retains authenticated RPC execution and denies anonymous execution and direct stock access',async()=>{
 const db=await setup();try{
  const result=(await db.query<{anon:boolean;client:boolean;direct:boolean}>("select has_function_privilege('anon','public.register_guild_material_auction(uuid,bigint,text,text,uuid,text,bigint,bigint)','execute') anon,has_function_privilege('authenticated','public.register_guild_material_auction(uuid,bigint,text,text,uuid,text,bigint,bigint)','execute') client,has_table_privilege('authenticated','private.guild_material_stock','select,insert,update,delete') direct")).rows[0];
  assert.deepEqual(result,{anon:false,client:true,direct:false});
 }finally{await db.close();}
});
