import test from 'node:test';import assert from 'node:assert/strict';import {createMarketOrderApi} from '../src/online/marketOrderRequests';
const config={url:'https://server.example',publishableKey:'public'},lease={leaseId:'lease',generation:1,clientInstanceId:'client',expiresAt:''};
const session={accessToken:'access',refreshToken:'refresh',userId:'user',expiresAt:Date.now()+100000,email:null};
const input={itemId:'ticket:ore:1',side:'BUY' as const,limitPrice:10,quantity:2,displayName:'1층 도전권'};
const state={wallet:{silver:980,gold:0,revision:2},orders:[],assets:[],storage:[],trades:[]};
const store=():Storage=>{const m=new Map<string,string>();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>{m.set(k,v);},removeItem:k=>{m.delete(k);},clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};};
test('ambiguous order keeps exact ID across reload and a refreshed lease',async()=>{
 const storage=store(),bodies:any[]=[];let failed=true;
 const request=(async(url,opts)=>{assert.ok(String(url).endsWith('place_online_market_order_v2'));bodies.push(JSON.parse(opts!.body as string));if(failed)throw Error('NETWORK');return new Response(JSON.stringify(state));}) as typeof fetch;
 let api=createMarketOrderApi(config,async()=>session,storage,request,()=> 'device');
 await assert.rejects(api.submit(lease,input),/NETWORK/);assert.equal((await api.pending())?.input.displayName,'1층 도전권');
 api=createMarketOrderApi(config,async()=>session,storage,request,()=> 'device');
 await assert.rejects(api.submit(lease,{...input,quantity:3}),/미확정/);
 failed=false;await api.retry({...lease,generation:2});assert.equal(bodies[0].p_request_id,bodies[1].p_request_id);assert.equal(bodies[1].p_generation,2);assert.equal(await api.pending(),null);
 await api.submit(lease,input);assert.notEqual(bodies[1].p_request_id,bodies[2].p_request_id);
});
test('simultaneous double click sends one request and returns one intent',async()=>{
 let count=0;let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const api=createMarketOrderApi(config,async()=>session,store(),(async()=>{count++;await gate;return new Response(JSON.stringify(state));}) as typeof fetch,()=> 'device');
 const one=api.submit(lease,input),two=api.submit(lease,input);await new Promise(r=>setTimeout(r,0));assert.equal(count,1);release();assert.deepEqual(await one,await two);
});
test('authentication loss and uncertain HTTP errors retain the original order ID',async()=>{
 for(const [status,body] of [[401,'AUTH_REQUIRED'],[400,'GAME_SESSION_LOST'],[403,'AUTH_SESSION_INVALID'],[503,'upstream'],[400,'MARKET_REQUEST_CONFLICT'],[200,'{}']] as const){
  const api=createMarketOrderApi(config,async()=>session,store(),(async()=>new Response(body,{status})) as typeof fetch,()=> 'device');
  await assert.rejects(api.submit(lease,input));assert.ok(await api.pending());
 }
 const api=createMarketOrderApi(config,async()=>session,store(),(async()=>new Response('INSUFFICIENT_SILVER',{status:400})) as typeof fetch,()=> 'device');await assert.rejects(api.submit(lease,input),/실버/);assert.equal(await api.pending(),null);
});
test('account switch never applies a response or reuses another account intent',async()=>{
 let current=session;const storage=store();
 const api=createMarketOrderApi(config,async()=>current,storage,(async()=>{current={...session,userId:'other'};return new Response(JSON.stringify(state));}) as typeof fetch,()=> 'device');
 await assert.rejects(api.submit(lease,input),/계정/);assert.equal(await api.pending(),null);current=session;assert.ok(await api.pending());
});
test('storage failure prevents any order dispatch',async()=>{
 const storage=store();storage.setItem=()=>{throw Error('STORAGE');};let count=0;
 const api=createMarketOrderApi(config,async()=>session,storage,(async()=>{count++;return new Response('{}');}) as typeof fetch,()=> 'device');await assert.rejects(api.submit(lease,input),/보관하지 못했습니다/);assert.equal(count,0);
});
