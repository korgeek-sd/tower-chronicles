import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_VERSION} from '../src/storage/repository.ts';
import {readSupabaseConfig} from '../src/online/config.ts';
import {decodeJwtPayload} from '../src/online/auth.ts';
import {stableStringify} from '../src/online/cloudSave.ts';

const b64=(value:string)=>Buffer.from(value).toString('base64url');

test('RELEASE 0.1.48: app version and online public config are explicit',()=>{
 assert.equal(APP_VERSION,'0.1.48');
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
