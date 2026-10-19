import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',borrower='22222222-2222-4222-8222-222222222222',stranger='33333333-3333-4333-8333-333333333333';
const sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',lease='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function fixture(){const db=new PGlite();await db.exec(readFileSync(new URL('./serverBankFixture.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261019113009_server_bank_authority.sql',import.meta.url),'utf8').split('-- Scheduler integration')[0]);
 for(const u of [owner,borrower,stranger])await db.query(`insert into auth.users values($1);`,[u]);
 for(const u of [owner,borrower,stranger]){await db.query(`insert into auth.sessions values($1,$1)`,[u]);await db.query(`insert into private.active_game_sessions values($1,$2,1,'client','device',now()+interval '1 hour',$1)`,[u,lease]);await db.query('insert into public.game_saves(user_id) values($1)',[u]);await db.query('insert into private.player_wallets(user_id,silver) values($1,5000000)',[u]);await db.query("insert into private.market_assets(user_id,item_id,quantity) values($1,'ticket:ore:1',20),($1,'ticket:gem:1',10)",[u]);}
 await db.query("insert into private.premium_accounts values($1,now()+interval '30 days')",[owner]);return db;}
async function as(db:PGlite,u:string){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u})]);}
async function act(db:PGlite,u:string,action:string,params:any,id=crypto.randomUUID()){await as(db,u);return (await db.query<any>(`select public.server_bank_action($1,1,'client','device',$2,$3,$4) r`,[lease,id,action,params])).rows[0].r;}
async function create(db:PGlite){return act(db,owner,'CREATE',{name:'검증 은행',amount:1000000,rate:10,durations:[5,10]});}
async function balance(db:PGlite,u:string){return Number((await db.query<any>('select silver from private.player_wallets where user_id=$1',[u])).rows[0].silver);}
async function qty(db:PGlite,u=borrower,item='ticket:ore:1'){return Number((await db.query<any>('select quantity from private.market_assets where user_id=$1 and item_id=$2',[u,item])).rows[0]?.quantity??0);}
async function due(db:PGlite,id:string,expired=false){await db.query(`update private.server_bank_loans set maturity_at=now()-interval '1 hour',grace_at=now()+interval '23 hours',issued_at=now()-interval '6 days' where id=$1`,[id]);if(expired)await db.query("update private.server_bank_loans set grace_at=now()-interval '1 second' where id=$1",[id]);}

test('bank create/borrow/replay are atomic and preserve total silver and exact collateral',async()=>{const db=await fixture();try{
 const id=crypto.randomUUID(),params={name:'검증 은행',amount:1000000,rate:10,durations:[5,10]};const b=await act(db,owner,'CREATE',params,id);await act(db,owner,'CREATE',params,id);assert.equal(await balance(db,owner),4000000);
 await assert.rejects(()=>act(db,owner,'CREATE',{...params,amount:2000000},id),/BANK_REQUEST_CONFLICT/);
 const request=crypto.randomUUID(),p={bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:2,duration:5};const loan=await act(db,borrower,'BORROW',p,request);await act(db,borrower,'BORROW',p,request);
 assert.equal(await balance(db,borrower),5100000);assert.equal(await qty(db),18);assert.equal(loan.state.directory[0].vault,900000);
 assert.equal(await balance(db,owner)+await balance(db,borrower)+loan.state.directory[0].vault,10000000);
 await assert.rejects(()=>act(db,borrower,'REPAY',{loanId:loan.result.loanId}),/BANK_NOT_MATURE/);
 await due(db,loan.result.loanId);const rep=await act(db,borrower,'REPAY',{loanId:loan.result.loanId});assert.equal(await balance(db,borrower),4990000);assert.equal(await qty(db),20);assert.equal(rep.state.directory[0].vault,1010000);
 await assert.rejects(()=>act(db,borrower,'REPAY',{loanId:loan.result.loanId}),/BANK_LOAN_CLOSED/);assert.equal(await qty(db),20);
 }finally{await db.close();}});

test('failed debit or persist rolls back vault, collateral, receipt and ledger together',async()=>{const db=await fixture();try{
 const b=await create(db),p={bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:2,duration:5};
 await db.query("update private.market_assets set quantity=1 where user_id=$1 and item_id='ticket:ore:1'",[borrower]);
 await assert.rejects(()=>act(db,borrower,'BORROW',p),/BANK_TICKET_SHORTAGE/);assert.equal((await createSnapshot(db)).vault,1000000);
 await db.query("update private.market_assets set quantity=20 where user_id=$1 and item_id='ticket:ore:1'",[borrower]);
 await db.exec("select set_config('test.persist_failure','on',false)");await assert.rejects(()=>act(db,borrower,'BORROW',{...p,tickets:2}),/TEST_PERSIST_FAILURE/);
 assert.equal(await balance(db,borrower),5000000);assert.equal(await qty(db),20);assert.equal((await createSnapshot(db)).loans,0);assert.equal((await createSnapshot(db)).vault,1000000);
 }finally{await db.close();}});
async function createSnapshot(db:PGlite){const r=(await db.query<any>('select (select count(*) from private.server_bank_loans)::int loans,(select vault from private.server_banks) vault')).rows[0];return {loans:r.loans,vault:Number(r.vault)};}

test('server tick repays once, returns the same ticket type and persists the borrower save',async()=>{const db=await fixture();try{
 const b=await create(db);const l=await act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:gem:1',tickets:3,duration:5});await due(db,l.result.loanId);
 await db.exec('select private.process_server_bank_due();select private.process_server_bank_due();');assert.equal(await balance(db,borrower),4985000);assert.equal(await qty(db,borrower,'ticket:gem:1'),10);
 const status=(await db.query<any>('select status from private.server_bank_loans')).rows[0].status;assert.equal(status,'REPAID');assert.equal((await createSnapshot(db)).vault,1015000);
 }finally{await db.close();}});

test('insufficient funds enter grace; expiration forfeits once and blocks new loans for 15 days',async()=>{const db=await fixture();try{
 const b=await create(db);const l=await act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:2,duration:5});await due(db,l.result.loanId);await db.query('update private.player_wallets set silver=0 where user_id=$1',[borrower]);
 await db.exec('select private.process_server_bank_due()');assert.equal((await db.query<any>('select status,reminders from private.server_bank_loans')).rows[0].status,'GRACE_PERIOD');
 await due(db,l.result.loanId,true);
 await assert.rejects(()=>act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5}),/BANK_PENALIZED/);
 await db.exec('select private.process_server_bank_due();select private.process_server_bank_due()');
 assert.equal(Number((await db.query<any>('select quantity from private.server_bank_collateral')).rows[0].quantity),2);assert.equal(await qty(db),18);assert.equal(await balance(db,borrower),0);
 await assert.rejects(()=>act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5}),/BANK_PENALIZED/);
 const claim=crypto.randomUUID();await act(db,owner,'CLAIM_COLLATERAL',{ticketId:'ticket:ore:1'},claim);await act(db,owner,'CLAIM_COLLATERAL',{ticketId:'ticket:ore:1'},claim);assert.equal(await qty(db,owner),22);
 }finally{await db.close();}});

test('bank RPCs enforce server lease, premium, ownership, input and expedition boundaries',async()=>{const db=await fixture();try{
 await assert.rejects(()=>act(db,borrower,'CREATE',{name:'비회원 은행',amount:1000000,rate:10,durations:[5]}),/BANK_PREMIUM_REQUIRED/);
 const b=await create(db);
 await assert.rejects(()=>act(db,owner,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5}),/BANK_SELF_LOAN/);
 await assert.rejects(()=>act(db,stranger,'WITHDRAW',{amount:1000}),/BANK_NOT_OWNER/);
 await assert.rejects(()=>act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1.5,duration:5}),/BANK_INPUT_INVALID/);
 await db.query("update public.game_saves set payload=payload||'{\"expedition\":{}}'::jsonb where user_id=$1",[borrower]);
 await assert.rejects(()=>act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5}),/BANK_EXPEDITION_ACTIVE/);
 await db.query("update private.active_game_sessions set generation=2 where user_id=$1",[owner]);await assert.rejects(()=>act(db,owner,'WITHDRAW',{amount:100}),/GAME_SESSION_LOST/);
 const rights=(await db.query<any>("select has_function_privilege('anon','public.server_bank_action(uuid,bigint,text,text,uuid,text,jsonb)','EXECUTE') anon,has_table_privilege('authenticated','private.server_banks','UPDATE') direct,has_function_privilege('authenticated','private.process_server_bank_due()','EXECUTE') cron")).rows[0];assert.deepEqual(rights,{anon:false,direct:false,cron:false});
 }finally{await db.close();}});

test('competing requests cannot spend the same remaining vault and duplicate request IDs issue one loan',async()=>{const db=await fixture();try{
 const b=await create(db),id=crypto.randomUUID(),p={bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:2,duration:5};await as(db,borrower);
 const request=(requestId:string,params:any)=>db.query<any>("select public.server_bank_action($1,1,'client','device',$2,'BORROW',$3) r",[lease,requestId,params]);
 const same=await Promise.all([request(id,p),request(id,p)]);assert.equal(same[0].rows[0].r.result.loanId,same[1].rows[0].r.result.loanId);assert.equal((await createSnapshot(db)).loans,1);
 const results=await Promise.allSettled([request(crypto.randomUUID(),{...p,tickets:15}),request(crypto.randomUUID(),{...p,tickets:15})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await createSnapshot(db)).vault,150000);assert.equal(await qty(db),3);
 }finally{await db.close();}});

test('late scheduler defaults rich borrowers after grace instead of charging after the deadline',async()=>{const db=await fixture();try{
 const b=await create(db),l=await act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5});await due(db,l.result.loanId,true);const before=await balance(db,borrower);
 await db.exec('select private.process_server_bank_due();select private.process_server_bank_due()');assert.equal(await balance(db,borrower),before);assert.equal(await qty(db),19);assert.equal((await db.query<any>('select status from private.server_bank_loans')).rows[0].status,'DEFAULTED');assert.equal((await createSnapshot(db)).vault,950000);
 }finally{await db.close();}});

test('owner deposit/withdraw conserve silver; other borrowers cannot repay or inspect a private loan',async()=>{const db=await fixture();try{
 const b=await create(db);await act(db,owner,'DEPOSIT',{amount:500000});await act(db,owner,'WITHDRAW',{amount:200000});assert.equal(await balance(db,owner),3700000);assert.equal((await createSnapshot(db)).vault,1300000);
 await assert.rejects(()=>act(db,owner,'WITHDRAW',{amount:2000000}),/BANK_VAULT_SHORTAGE/);assert.equal(await balance(db,owner),3700000);
 const l=await act(db,borrower,'BORROW',{bankId:b.result.bankId,ticketId:'ticket:ore:1',tickets:1,duration:5});await assert.rejects(()=>act(db,stranger,'REPAY',{loanId:l.result.loanId}),/BANK_LOAN_NOT_FOUND/);
 await as(db,stranger);const state=(await db.query<any>("select public.get_server_bank($1,1,'client','device') r",[lease])).rows[0].r;assert.equal(state.state.loans.length,0);assert.equal(state.state.ledger.length,0);assert.equal(state.state.myBank,null);
 }finally{await db.close();}});
