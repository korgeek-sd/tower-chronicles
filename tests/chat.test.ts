import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChatBody,mergeChatMessages,createChatApi,type ChatMessage} from '../src/online/chat.ts';
const session={accessToken:'token',refreshToken:'refresh',expiresAt:Date.now()+100000,userId:'mine',email:null};
const row={id:'one',user_id:'mine',nickname:'탐험가',body:'안녕하세요',created_at:'2026-10-01T00:00:00Z',client_id:'request-one'};
test('chat accepts Unicode and rejects empty, oversized and invisible/control text',()=>{
 assert.equal(validateChatBody(' 안녕하세요 ').body,'안녕하세요');
 assert.equal(validateChatBody('😀'.repeat(200)).error,null);
 for(const value of ['', '  ', 'a'.repeat(201),'안녕\n하세요','안녕\u200b하세요','\u202Eabc'])assert.ok(validateChatBody(value).error);
});
test('history/realtime/send overlap deduplicates and preserves newest bounded history',()=>{
 const m=(id:string,time:number):ChatMessage=>({id,userId:'mine',nickname:'탐험가',body:id,createdAt:new Date(time).toISOString(),clientId:id});
 const messages=Array.from({length:60},(_,i)=>m(String(i),i));
 const merged=mergeChatMessages(messages,[messages[59],m('60',60)]);
 assert.equal(merged.length,50);assert.equal(merged[0].id,'11');assert.equal(merged.at(-1)?.id,'60');
});
test('send derives identity on server and sends only body and idempotency key',async()=>{
 let sent:any;
 const api=createChatApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async(_url,init)=>{sent=JSON.parse(String(init?.body));return new Response(JSON.stringify([row]),{status:201});});
 assert.equal((await api.send(' 안녕하세요 ','request-one')).nickname,'탐험가');
 assert.deepEqual(sent,{body:'안녕하세요',client_id:'request-one'});
});
test('duplicate request loads confirmed original rather than posting twice',async()=>{
 const api=createChatApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{code:'23505'}:[row]),{status:init?.method==='POST'?409:200}));
 assert.equal((await api.send('안녕하세요','request-one')).id,'one');
});
test('signed-out send performs no request and rate errors are readable',async()=>{
 const config={url:'https://example.supabase.co',publishableKey:'public'};
 await assert.rejects(createChatApi(config,async()=>null,async()=>{throw Error('must not fetch');}).send('안녕','key'),/로그인/);
 const api=createChatApi(config,async()=>session,async()=>new Response(JSON.stringify({message:'CHAT_RATE_LIMIT'}),{status:400}));
 await assert.rejects(api.send('안녕','key'),/2초/);
});
test('realtime waits for WAL ready, accepts confirmed inserts, ignores broadcasts and cleans up',async()=>{
 const {createChatSubscription}=await import('../src/online/chat.ts');
 const original={WebSocket:globalThis.WebSocket,window:(globalThis as any).window,document:(globalThis as any).document};
 class FakeSocket extends EventTarget{
  static OPEN=1;static CLOSED=3;readyState=1;sent:any[]=[];static instance:FakeSocket;
  constructor(_url:string){super();FakeSocket.instance=this;}
  send(value:string){this.sent.push(JSON.parse(value));}
  close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
  emit(frame:any){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(frame)}));}
 }
 (globalThis as any).WebSocket=FakeSocket;(globalThis as any).window=new EventTarget();(globalThis as any).document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 const statuses:string[]=[],received:ChatMessage[]=[],presence:boolean[]=[];
 let stop=()=>{};
 try{
  stop=createChatSubscription({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,v=>presence.push(v),'mine',m=>received.push(m),s=>statuses.push(s));
  await new Promise(resolve=>setImmediate(resolve));
  const ws=FakeSocket.instance;ws.dispatchEvent(new Event('open'));
  const join=ws.sent[0];assert.equal(join[3],'phx_join');assert.equal(join[4].access_token,'token');
  ws.emit([join[0],join[1],join[2],'phx_reply',{status:'ok'}]);assert.deepEqual(statuses,['connecting']);
  ws.emit([join[0],null,join[2],'system',{extension:'postgres_changes',status:'ok'}]);assert.equal(statuses.at(-1),'subscribed');
  ws.emit([join[0],null,join[2],'broadcast',{event:'message',payload:row}]);assert.equal(received.length,0);
  ws.emit([join[0],null,join[2],'postgres_changes',{data:{type:'INSERT',table:'game_chat_messages',record:row}}]);assert.equal(received.length,1);
  stop();assert.equal(ws.readyState,3);assert.equal(presence.at(-1),false);
  ws.emit([join[0],null,join[2],'postgres_changes',{data:{type:'INSERT',table:'game_chat_messages',record:row}}]);assert.equal(received.length,1);
 }finally{stop();Object.assign(globalThis,original);}
});
