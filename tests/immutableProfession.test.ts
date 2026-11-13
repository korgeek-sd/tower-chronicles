import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPermanentClassApi,isPermanentClass} from '../src/online/permanentClass';
import {adoptPermanentClass,onboardingClassKey} from '../src/components/intro/firstTimeOnboardingState';
import type {OnlineSession} from '../src/online/auth';

const config={url:'https://example.supabase.co',publishableKey:'public-key'};
const userId='00000000-0000-4000-8000-000000000001';
const session:OnlineSession={userId,accessToken:'user-access-token',refreshToken:'test',expiresAt:Date.now()+360000,email:null};
const json=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});

test('read first class from server and insert only once with authenticated identity',async()=>{
 const requests:Array<{url:string;method:string;body?:string;headers?:HeadersInit}>=[];
 const request=async(input:RequestInfo|URL,options?:RequestInit)=>{
  const url=String(input),method=options?.method??'GET';
  requests.push({url,method,body:options?.body as string|undefined,headers:options?.headers});
  if(method==='GET')return json([{user_id:userId,class_id:'warrior'}]);
  return json([{user_id:userId,class_id:'warrior'}],201);
 };
 const api=createPermanentClassApi(config,async()=>session,request as typeof fetch);
 assert.equal(await api.load(userId),'warrior');
 assert.equal(await api.lock(userId,'warrior'),'warrior');
 assert.ok(requests[0].url.includes('user_id=eq.'+userId));
 assert.ok(requests[0].url.includes('select=user_id,class_id'));
 assert.deepEqual(JSON.parse(requests[1].body??''),{user_id:userId,class_id:'warrior'});
 assert.equal((requests[1].headers as Record<string,string>).Authorization,'Bearer '+session.accessToken);
 assert.ok(isPermanentClass('mage'));assert.equal(isPermanentClass('fighter'),false);
});

test('same choice is idempotent but a conflicting choice cannot replace server class',async()=>{
 let last='warrior';
 const request=async(_url:RequestInfo|URL,options?:RequestInit)=>{
  if(options?.method==='POST')return json({code:'23505'},409);
  return json([{user_id:userId,class_id:last}]);
 };
 const api=createPermanentClassApi(config,async()=>session,request as typeof fetch);
 assert.equal(await api.lock(userId,'warrior'),'warrior');
 await assert.rejects(api.lock(userId,'mage'),/이미 확정된 직업은 변경할 수 없습니다/);
 last='mage';
 await assert.rejects(api.lock(userId,'warrior'),/이미 확정된 직업은 변경할 수 없습니다/);
});

test('do not write if another Google account is currently authenticated',async()=>{
 let called=false;
 const request=async()=>{called=true;return json([]);};
 const api=createPermanentClassApi(config,async()=>session,request as typeof fetch);
 await assert.rejects(api.lock('00000000-0000-4000-8000-000000000002','archer'),/로그인 계정/);
 assert.equal(called,false);
});

test('server class overrides tampered local choice, preserving matching learned skills',()=>{
 const map=new Map<string,string>();
 const storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,v:string)=>{map.set(key,v);}};
 const key=onboardingClassKey(userId);
 map.set(key,JSON.stringify({classId:'warrior',picks:[1,...Array(9).fill(null)],order:[0]}));
 const same=adoptPermanentClass(userId,'warrior',storage);
 assert.equal(same.picks[0],1);
 const corrected=adoptPermanentClass(userId,'mage',storage);
 assert.equal(corrected.classId,'mage');
 assert.ok(corrected.picks.every(p=>p===null),'local skills from a different class must not leak into the server class');
 assert.equal(JSON.parse(map.get(key)!).classId,'mage');
});

test('database grants one immutable server row per authenticated Google account',()=>{
 const sql=readFileSync('supabase/migrations/20261114011000_immutable_account_classes.sql','utf8');
 assert.match(sql,/create table public\.game_initial_classes/i);
 assert.match(sql,/user_id uuid primary key references auth\.users\(id\)/i);
 assert.match(sql,/check \(class_id in \('warrior','mage','archer'\)\)/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.game_initial_classes from public,anon,authenticated/i);
 assert.match(sql,/grant select \(user_id,class_id\),insert \(user_id,class_id\)/i);
 assert.match(sql,/for select to authenticated[\s\S]*?auth\.uid\(\)/i);
 assert.match(sql,/for insert to authenticated[\s\S]*?auth\.uid\(\)/i);
 assert.doesNotMatch(sql,/grant.*update|grant.*delete/i);
 const screen=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const signup=readFileSync('src/components/intro/FirstTimeOnboarding.tsx','utf8');
 const main=readFileSync('src/main.tsx','utf8');
 assert.match(screen,/await lockPermanentClass\(userId,preview\)/);
 assert.match(screen,/await loadPermanentClass\(userId\)/);
 assert.match(screen,/adoptPermanentClass\(userId,serverClass,localStorage\)/);
 assert.match(signup,/await lockPermanentClass\(userId,selected\)/);
 assert.match(signup,/await onRegister\(validation\.nickname\)/);
 assert.ok(signup.indexOf('lockPermanentClass(userId,selected)')<signup.indexOf('onRegister(validation.nickname)'));
 assert.match(main,/loadPermanentClass\(userId\)/);
});
