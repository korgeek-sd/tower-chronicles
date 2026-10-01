import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNickname,createProfileApi} from '../src/online/playerProfiles.ts';
test('nickname normalization and validation',()=>{
 assert.deepEqual(validateNickname(' 탐험가12 '),{nickname:'탐험가12',error:null});
 assert.equal(validateNickname('탐험').nickname,'탐험');
 for(const value of ['a','a b','a_b','😀😀','관리자','ADMIN','abcdefghijklmn'])assert.ok(validateNickname(value).error);
});
const session={accessToken:'test-token',refreshToken:'test-refresh',expiresAt:Date.now()+100000,userId:'account-one',email:null};
test('profile API writes only the authenticated user and reads explicit public fields',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=createProfileApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async(url,init)=>{
  calls.push({url:String(url),init});return new Response(JSON.stringify([{user_id:'account-one',nickname:'탐험가'}]),{status:201});
 });
 assert.deepEqual(await api.register(' 탐험가 '),{userId:'account-one',nickname:'탐험가'});
 assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{user_id:'account-one',nickname:'탐험가'});
 assert.match(calls[0].url,/select=user_id,nickname/);
});
test('duplicate nickname is readable and concurrent same-account registration recovers',async()=>{
 const api=createProfileApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{code:'23505'}:[]),{status:init?.method==='POST'?409:200}));
 await assert.rejects(api.register('탐험가'),/이미 사용 중/);
});
test('signed out users cannot create a profile',async()=>{
 const api=createProfileApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>null,async()=>{throw Error('must not fetch');});
 await assert.rejects(api.register('탐험가'),/로그인/);
});
test('concurrent registration on the same account returns its already saved profile',async()=>{
 const api=createProfileApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async(_url,init)=>new Response(JSON.stringify(init?.method==='POST'?{code:'23505'}:[{user_id:'account-one',nickname:'기존모험가'}]),{status:init?.method==='POST'?409:200}));
 assert.deepEqual(await api.register('새모험가'),{userId:'account-one',nickname:'기존모험가'});
});
test('a profile response from another account is rejected',async()=>{
 const api=createProfileApi({url:'https://example.supabase.co',publishableKey:'public'},async()=>session,async()=>new Response(JSON.stringify([{user_id:'other-account',nickname:'탐험가'}]),{status:200}));
 await assert.rejects(api.load(),/확인하지 못/);
});
