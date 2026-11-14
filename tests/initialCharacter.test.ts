import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialCharacterApi} from '../src/online/initialCharacter';
import type {OnlineSession} from '../src/online/auth';

const config={url:'https://example.supabase.co',publishableKey:'public-key'};
const userId='00000000-0000-4000-8000-000000000001';
const session:OnlineSession={userId,accessToken:'access-token',refreshToken:'refresh-token',expiresAt:Date.now()+360000,email:null};
const json=(payload:unknown,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});

test('nickname and class are sent in one authenticated transaction, with no provisional class write',async()=>{
 const calls:Array<{url:string;method?:string;body:unknown;authorization:unknown}>=[];
 const request=async(input:RequestInfo|URL,options?:RequestInit)=>{
  calls.push({url:String(input),method:options?.method,body:JSON.parse(options?.body as string),authorization:(options?.headers as Record<string,string>).Authorization});
  return json([{user_id:userId,nickname:'새모험가',class_id:'archer'}]);
 };
 const register=createInitialCharacterApi(config,async()=>session,request as typeof fetch);
 assert.deepEqual(await register('새모험가','archer'),{userId,nickname:'새모험가'});
 assert.equal(calls.length,1,'no separate early class commit is permitted');
 assert.equal(calls[0].url,config.url+'/rest/v1/rpc/register_initial_character');
 assert.equal(calls[0].method,'POST');
 assert.equal(calls[0].authorization,'Bearer '+session.accessToken);
 assert.deepEqual(calls[0].body,{p_nickname:'새모험가',p_class_id:'archer'});
});

test('failed nickname registration keeps class editable for another attempt',async()=>{
 const choices:string[]=[];
 const request=async(_input:RequestInfo|URL,options?:RequestInit)=>{
  const body=JSON.parse(options?.body as string) as {p_class_id:string};
  choices.push(body.p_class_id);
  if(choices.length===1)return json({code:'23505'},409);
  return json([{user_id:userId,nickname:'새모험가',class_id:body.p_class_id}]);
 };
 const register=createInitialCharacterApi(config,async()=>session,request as typeof fetch);
 await assert.rejects(register('새모험가','warrior'),/이미 사용 중인 닉네임/);
 assert.deepEqual(await register('새모험가','mage'),{userId,nickname:'새모험가'});
 assert.deepEqual(choices,['warrior','mage']);
});

test('invalid name and missing authentication are rejected before any write',async()=>{
 let writes=0;
 const request=async()=>{writes++;return json([]);};
 const register=createInitialCharacterApi(config,async()=>session,request as typeof fetch);
 await assert.rejects(register('a','mage'),/2~12자/);
 const noSession=createInitialCharacterApi(config,async()=>null,request as typeof fetch);
 await assert.rejects(noSession('새모험가','archer'),/Google 로그인/);
 assert.equal(writes,0);
});

test('registration must validate the account and class returned by the server',async()=>{
 const request=async()=>json([{user_id:userId,nickname:'새모험가',class_id:'warrior'}]);
 const register=createInitialCharacterApi(config,async()=>session,request as typeof fetch);
 await assert.rejects(register('새모험가','mage'),/일치하지 않습니다/);
});

test('database RPC permits provisional class changes only until nickname registration',()=>{
 const migration=readFileSync('supabase/migrations/20261114134937_atomic_initial_character_registration.sql','utf8');
 assert.match(migration,/security definer/i);
 assert.match(migration,/SET search_path TO ''/i);
 assert.match(migration,/v_uid uuid := auth\.uid\(\)/i);
 assert.match(migration,/from auth\.users u where u\.id=v_uid for update/i);
 assert.match(migration,/from public\.game_player_profiles p where p\.user_id=v_uid/i);
 assert.match(migration,/v_existing_name=p_nickname and v_existing_class=p_class_id/i);
 assert.match(migration,/on conflict\(user_id\) do update set class_id=excluded\.class_id/i);
 assert.match(migration,/insert into public\.game_player_profiles\(user_id,nickname\)/i);
 assert.match(migration,/revoke all on function public\.register_initial_character\(text,text\)/i);
 assert.match(migration,/grant execute on function public\.register_initial_character\(text,text\)\s+to authenticated/i);
 assert.doesNotMatch(migration,/grant .*execute .* to anon/i);
});
