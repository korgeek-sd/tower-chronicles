import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {readSupabaseConfig} from '../src/online/config.ts';
import {decodeJwtPayload} from '../src/online/auth.ts';
import {stableStringify} from '../src/online/cloudSave.ts';
import {decideCloudSync} from '../src/online/cloudSync.ts';
import {GAME_SESSION_HEARTBEAT_MS,GAME_SESSION_TAKEOVER_GRACE_MS,GAME_SESSION_TTL_MS,getClientInstanceId,platformLabel} from '../src/online/gameSession.ts';

const b64=(value:string)=>Buffer.from(value).toString('base64url');

test('RELEASE 0.1.51: app version and online public config are explicit',()=>{
 assert.equal(APP_VERSION,'0.1.51');
 assert.deepEqual(readSupabaseConfig({
  VITE_SUPABASE_URL:'https://project-ref.supabase.co/',
  VITE_SUPABASE_PUBLISHABLE_KEY:'public-key',
 } as any),{url:'https://project-ref.supabase.co',publishableKey:'public-key'});
 assert.equal(readSupabaseConfig({VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''} as any),null);
 assert.equal(readSupabaseConfig({VITE_SUPABASE_URL:'javascript:alert(1)',VITE_SUPABASE_PUBLISHABLE_KEY:'x'} as any),null);
});

test('ONLINE 01: JWT identity decoding reads sub/email/exp without trusting malformed tokens',()=>{
 const token=b64(JSON.stringify({alg:'none'}))+'.'+b64(JSON.stringify({sub:'user-1',email:'a@example.com',exp:123}))+'.sig';
 assert.deepEqual(decodeJwtPayload(token),{sub:'user-1',email:'a@example.com',exp:123});
 assert.equal(decodeJwtPayload('broken'),null);
});

test('ONLINE 02: canonical save serialization ignores object insertion order',()=>{
 const a={z:1,a:{d:4,b:2},list:[{y:2,x:1}]};
 const b={list:[{x:1,y:2}],a:{b:2,d:4},z:1};
 assert.equal(stableStringify(a),stableStringify(b));
});


test('ONLINE 03: automatic cloud sync chooses push, pull and noop without manual transfer controls',()=>{
 const remote={revision:2,payloadHash:'remote'} as any;
 assert.equal(decideCloudSync('local',null,null,'user-1'),'push');
 assert.equal(decideCloudSync('remote',remote,null,'user-1'),'noop');
 assert.equal(decideCloudSync('local',remote,null,'user-1'),'pull');
 assert.equal(decideCloudSync('local',remote,{userId:'user-1',revision:2,payloadHash:'remote',updatedAt:''},'user-1'),'push');
 assert.equal(decideCloudSync('local',{...remote,revision:3},{userId:'user-1',revision:2,payloadHash:'remote',updatedAt:''},'user-1'),'pull');
});


test('ONLINE 04: active gameplay lease uses conservative heartbeat, TTL and takeover windows',()=>{
 assert.equal(GAME_SESSION_HEARTBEAT_MS,20_000);
 assert.equal(GAME_SESSION_TTL_MS,90_000);
 assert.equal(GAME_SESSION_TAKEOVER_GRACE_MS,3_000);
 assert.equal(platformLabel('Mozilla/5.0 (Linux; Android 16)'), 'Android');
 assert.equal(platformLabel('Mozilla/5.0 (Windows NT 10.0)'), 'Windows');
 const map=new Map<string,string>();
 const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear(),key:(i:number)=>Array.from(map.keys())[i]??null,get length(){return map.size;}} as Storage;
 const first=getClientInstanceId(storage),second=getClientInstanceId(storage);
 assert.equal(first,second);
 assert.ok(first.length>10);
});
