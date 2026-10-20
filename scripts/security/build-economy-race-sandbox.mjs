// Generate a temporary, account-guarded SQL sandbox. No live gameplay tables are modified.
import {readFileSync,writeFileSync} from 'node:fs';
const [account,sourcePath,outputPath]=process.argv.slice(2);
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(account??''))throw Error('Disposable Auth user UUID required');
const publicDriver=process.argv.includes('--public-driver'); // Requires explicit approval before application.
const prefix='tc_race_'+account.replaceAll('-','').slice(0,8),driver=prefix+'_driver';
const namespaces=Object.fromEntries(['auth','private','public','realtime'].map(s=>[s,prefix+'_'+s]));
const rewrite=s=>s.replace(/\b(auth|private|public|realtime)(?=\.)/g,m=>namespaces[m]).replaceAll('tc-market-mutations',prefix+'-mutations');
const input=JSON.parse(readFileSync(sourcePath,'utf8'));
const required=new Set(['require_active_game_session','place_online_market_order','cancel_online_market_order','close_market_order','market_order_mail','deliver_market_asset','server_bank_action','settle_server_bank_loan','process_server_bank_due']);
if(input.length!==required.size)throw Error('Expected nine live function definitions');
for(const f of input)if(!required.delete(f.name)||!/^CREATE OR REPLACE FUNCTION (public|private)\./.test(f.definition))throw Error('Invalid function snapshot');
let fixture=readFileSync(new URL('./economy-race-fixture.sql',import.meta.url),'utf8');
fixture=fixture.replace('create schema auth; create schema private; create schema realtime;','');
const tableNames=[...fixture.matchAll(/create table\s+([a-z_]+\.[a-z_]+)/gi)].map(m=>rewrite(m[1]));
const q=namespaces.private,p=namespaces.public,h=namespaces.auth;
const sql=Object.values(namespaces).map(s=>`create schema ${s};revoke all on schema ${s} from public,anon,authenticated;`).join('\n')+'\n'+rewrite(fixture)+'\n'+input.map(f=>rewrite(f.definition.trimEnd())+';').join('\n')+`
create table ${q}.qa_meta as select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() lease,gen_random_uuid() bank,gen_random_uuid() loan,gen_random_uuid() request,'other:${prefix}'::text item;
create function ${publicDriver?'public.'+driver:q+'.qa_driver'}(p_action text,p_quantity integer default 10,p_delay_ms integer default 0,p_expired boolean default false,p_fail boolean default false)
returns jsonb language plpgsql security ${publicDriver?'definer':'invoker'} set search_path='' as $driver$
declare m ${q}.qa_meta%rowtype;actor uuid;v_order uuid;r jsonb:='{}';started timestamptz:=clock_timestamp();did_lock boolean;
begin
 ${publicDriver?"if auth.uid() is distinct from '"+account+"'::uuid or not exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id') then raise exception 'QA_FORBIDDEN' using errcode='42501';end if;":"if current_user not in ('postgres','supabase_admin') then raise exception 'QA_OWNER_REQUIRED' using errcode='42501';end if;"}
 if p_action is null or p_action not in('reset_market','reset_bank','sell','buy','cancel','auto','repay','probe','snapshot') or p_quantity is null or p_quantity not between 1 and 10 or p_delay_ms is null or p_delay_ms not between 0 and 3000 then raise exception 'QA_INPUT_INVALID';end if;
 select * into m from ${q}.qa_meta;
 if p_action='probe' then
  did_lock:=pg_try_advisory_xact_lock(hashtextextended('${prefix}-mutations',0));
  return jsonb_build_object('busy',not did_lock,'backend',pg_backend_pid());
 end if;
 if p_action in('reset_market','reset_bank') then
  truncate ${tableNames.join(',')} restart identity cascade;
  insert into ${h}.users values(m.a),(m.b);insert into ${h}.sessions values(m.a,m.a),(m.b,m.b);
  insert into ${q}.active_game_sessions values(m.a,m.lease,1,m.a,'device','client',now()+interval '1 hour'),(m.b,m.lease,1,m.b,'device','client',now()+interval '1 hour');
  insert into ${p}.game_saves(user_id) values(m.a),(m.b);
  insert into ${q}.player_wallets(user_id,silver) values(m.a,10000),(m.b,case when p_action='reset_market' then 10000 else 100000 end);
  if p_action='reset_market' then insert into ${q}.market_assets(user_id,item_id,quantity) values(m.a,m.item,10);
  else
   insert into ${q}.server_banks(id,owner_id,name,rate,durations,vault) values(m.bank,m.a,'isolated bank',10,array[5],0);
   insert into ${q}.server_bank_loans(id,bank_id,borrower_id,ticket_id,tickets,principal,interest,rate,duration,issued_at,maturity_at,grace_at)
   values(m.loan,m.bank,m.b,'ticket:ore:1',1,50000,5000,10,5,now()-interval '6 days',now()-interval '1 hour',now()+case when p_expired then interval '-1 second' else interval '23 hours' end);
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='snapshot' then
  return jsonb_build_object(
   'market',jsonb_build_object(
    'wallet',(select coalesce(sum(silver),0) from ${q}.player_wallets),
    'escrow',(select coalesce(sum(limit_price*remaining_quantity),0) from ${q}.market_orders where side='BUY' and status in('OPEN','PARTIAL')),
    'fees',(select coalesce(sum(seller_fee_silver),0) from ${q}.market_trades),
    'traded',(select coalesce(sum(quantity),0) from ${q}.market_trades),
    'orders',(select count(*) from ${q}.market_orders),
    'stock',(select coalesce(sum(quantity),0) from ${q}.market_assets where item_id=m.item)+(select coalesce(sum(remaining_quantity),0) from ${q}.market_orders where side='SELL' and status in('OPEN','PARTIAL'))+(select coalesce(sum(attachment_quantity),0) from ${q}.game_mail where attachment_item_id=m.item and claimed_at is null)),
   'bank',jsonb_build_object(
    'wallet',(select silver from ${q}.player_wallets where user_id=m.b),'vault',(select vault from ${q}.server_banks where id=m.bank),
    'status',(select status from ${q}.server_bank_loans where id=m.loan),
    'tickets',(select coalesce(sum(quantity),0) from ${q}.market_assets where user_id=m.b and item_id='ticket:ore:1'),
    'collateral',(select coalesce(sum(quantity),0) from ${q}.server_bank_collateral where bank_id=m.bank),
    'ledger',(select count(*) from ${q}.server_bank_ledger where loan_id=m.loan),
    'receipts',(select count(*) from ${q}.server_bank_requests where user_id=m.b)));
 end if;
 actor:=case when p_action in('sell','cancel') then m.a else m.b end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',actor,'role','authenticated')::text,true);
 perform set_config('test.persist_failure',case when p_fail then 'on' else 'off' end,true);
 begin
  if p_action='auto' then
   did_lock:=pg_try_advisory_xact_lock(hashtextextended('${prefix}-mutations',0));
   if did_lock and p_delay_ms>0 then perform pg_sleep(p_delay_ms/1000.0);end if;
   r:=jsonb_build_object('processed',${q}.process_server_bank_due());
  else
   perform pg_advisory_xact_lock(hashtextextended('${prefix}-mutations',0));
   if p_delay_ms>0 then perform pg_sleep(p_delay_ms/1000.0);end if;
   if p_action='sell' then r:=${p}.place_online_market_order(m.lease,1,'client','device',m.item,'SELL',100,10);
   elsif p_action='buy' then r:=${p}.place_online_market_order(m.lease,1,'client','device',m.item,'BUY',100,p_quantity);
   elsif p_action='cancel' then select order_id into v_order from ${q}.market_orders where user_id=m.a and side='SELL' order by created_at limit 1;r:=${p}.cancel_online_market_order(m.lease,1,'client','device',v_order);
   elsif p_action='repay' then r:=${p}.server_bank_action(m.lease,1,'client','device',m.request,'REPAY',jsonb_build_object('loanId',m.loan));end if;
  end if;
 exception when others then return jsonb_build_object('ok',false,'code',sqlstate,'error',sqlerrm,'started',started,'finished',clock_timestamp(),'backend',pg_backend_pid());end;
 return jsonb_build_object('ok',true,'result',r,'started',started,'finished',clock_timestamp(),'backend',pg_backend_pid());
end $driver$;
revoke all on function ${publicDriver?'public.'+driver:q+'.qa_driver'}(text,integer,integer,boolean,boolean) from public,anon,authenticated;
${publicDriver?'grant execute on function public.'+driver+'(text,integer,integer,boolean,boolean) to authenticated;':''}
`;
writeFileSync(outputPath,sql);
const checks=process.argv.indexOf('--checks-out');
if(checks>=0)writeFileSync(process.argv[checks+1],readFileSync(new URL('./economy-race-orderings.sql',import.meta.url),'utf8').replaceAll('__QA_PRIVATE__',q));
console.log(JSON.stringify({prefix,driver,schemas:namespaces}));
