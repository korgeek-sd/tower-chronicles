import test from 'node:test';import assert from 'node:assert/strict';import {createServerBankApi} from '../src/online/bank';
const config={url:'https://server.example',publishableKey:'public'},lease={leaseId:'lease',generation:1,clientInstanceId:'client',expiresAt:''};
const session={accessToken:'access',refreshToken:'refresh',userId:'user',expiresAt:Date.now()+1000000,email:null};
function storage():Storage{const m=new Map<string,string>();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>{m.set(k,v);},removeItem:k=>{m.delete(k);},clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};}
const result={state:{userId:'user',serverNow:123,directory:[],loans:[]},record:{payload:{silver:12}}};
test('ambiguous network failure persists the exact financial request across reload and retries its ID',async()=>{
 const s=storage(),bodies:any[]=[];let fail=true;
 const request=(async(_url,opts)=>{bodies.push(JSON.parse(opts!.body as string));if(fail)throw Error('NETWORK');return new Response(JSON.stringify(result));}) as typeof fetch;
 let api=createServerBankApi(config,async()=>session,s,request,()=> 'device');
 await assert.rejects(()=>api.mutate('user',lease,'DEPOSIT',{amount:50}),/NETWORK/);
 const pending=api.pending('user');assert.ok(pending);
 api=createServerBankApi(config,async()=>session,s,request,()=> 'device');
 await assert.rejects(()=>api.mutate('user',lease,'WITHDRAW',{amount:50}),/미확정/);
 fail=false;await api.retry('user',{...lease,generation:2});assert.equal(bodies[0].p_request_id,bodies[1].p_request_id);assert.equal(bodies[1].p_generation,2);assert.equal(bodies[1].p_device_id,'device');assert.equal(api.pending('user'),null);
});
test('server rejection clears only failed intent while 5xx retains its retry receipt',async()=>{
 const s=storage();let status=400;
 const api=createServerBankApi(config,async()=>session,s,(async()=>new Response('BANK_SILVER_SHORTAGE',{status})) as typeof fetch,()=> 'device');
 await assert.rejects(()=>api.mutate('user',lease,'DEPOSIT',{amount:500}),/실버/);assert.equal(api.pending('user'),null);
 status=503;await assert.rejects(()=>api.mutate('user',lease,'DEPOSIT',{amount:500}));assert.ok(api.pending('user'));
});
test('account change or malformed success never applies another account response',async()=>{
 const s=storage();let current=session;
 const api=createServerBankApi(config,async()=>current,s,(async()=>{current={...session,userId:'other'};return new Response(JSON.stringify(result));}) as typeof fetch,()=> 'device');
 await assert.rejects(()=>api.mutate('user',lease,'DEPOSIT',{amount:1}),/계정/);assert.ok(api.pending('user'));
 current=session;const malformed=createServerBankApi(config,async()=>current,s,(async()=>new Response('{}')) as typeof fetch,()=> 'device');await assert.rejects(()=>malformed.retry('user',lease),/응답/);assert.ok(malformed.pending('user'));
});
