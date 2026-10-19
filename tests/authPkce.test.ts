import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_SESSION_KEY,OAUTH_TRANSACTION_KEY,createGoogleOAuthUrl,completeGoogleOAuth,refreshSessionForConfig,getStoredSession,signOutOnline,consumeOAuthRedirect} from '../src/online/auth';
const config={url:'https://auth.example',publishableKey:'public'};
function storage():Storage{const data=new Map<string,string>();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size;}};}
const token={access_token:'server-access',refresh_token:'server-refresh',expires_in:3600};
const old={accessToken:'old-access',refreshToken:'old-refresh',expiresAt:1,userId:'server-user',email:null};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
async function setup(){const sessions=storage(),transactions=storage();const authorize=new URL(await createGoogleOAuthUrl(config,'https://game.example/play/?view=home',transactions));const callback=new URL(authorize.searchParams.get('redirect_to')!);callback.searchParams.set('code','valid-code');return {sessions,transactions,authorize,callback};}

test('PKCE uses random verifier, SHA-256 challenge, tab transaction and server-verified identity',async()=>{
 const {sessions,transactions,authorize,callback}=await setup();
 const tx=JSON.parse(transactions.getItem(OAUTH_TRANSACTION_KEY)!);
 assert.equal(tx.verifier.length,43);assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
 assert.equal(authorize.searchParams.get('code_challenge'),Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tx.verifier))).toString('base64url'));
 assert.ok(!authorize.toString().includes(tx.verifier));
 let calls=0;
 const request=(async(url,options)=>{
  calls++;
  if(calls===1){assert.match(String(url),/grant_type=pkce$/);assert.deepEqual(JSON.parse(options!.body as string),{auth_code:'valid-code',code_verifier:tx.verifier});return json(token);}
  assert.match(String(url),/\/user$/);return json({id:'server-user',email:'verified@example.com'});
 }) as typeof fetch;
 const result=await completeGoogleOAuth(config,callback.href,sessions,transactions,request);
 assert.equal(result?.userId,'server-user');assert.equal(result?.email,'verified@example.com');assert.equal(calls,2);
 assert.equal(transactions.getItem(OAUTH_TRANSACTION_KEY),null);
 await assert.rejects(()=>completeGoogleOAuth(config,callback.href,sessions,transactions,request),/AUTH_REQUEST_MISMATCH/);
 assert.equal(calls,2);
});

test('missing, expired, mismatched, duplicate and other-tab callbacks cannot issue token requests',async()=>{
 for(const kind of ['missing','expired','mismatch','duplicate','other-path','other-tab']){
  const {sessions,transactions,callback}=await setup();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));
  if(kind==='missing'||kind==='other-tab')transactions.clear();
  if(kind==='expired'){const tx=JSON.parse(transactions.getItem(OAUTH_TRANSACTION_KEY)!);tx.createdAt=Date.now()-11*60000;transactions.setItem(OAUTH_TRANSACTION_KEY,JSON.stringify(tx));}
  if(kind==='mismatch')callback.searchParams.set('tc_auth_state','attacker');
  if(kind==='duplicate')callback.searchParams.append('code','other-code');
  if(kind==='other-path')callback.pathname='/wrong/';
  await assert.rejects(()=>completeGoogleOAuth(config,callback.href,sessions,transactions,(async()=>{throw Error('NETWORK_MUST_NOT_RUN');}) as typeof fetch),/AUTH_REQUEST_MISMATCH|AUTH_RESPONSE_INVALID/);
  assert.deepEqual(getStoredSession(sessions),old);
 }
});

test('implicit fragments, exchange failure and unverified users never replace an existing account',async()=>{
 for(const kind of ['fragment','exchange','user']){
  const {sessions,transactions,callback}=await setup();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));
  if(kind==='fragment')callback.hash='access_token=attacker&refresh_token=attacker';
  let calls=0;const request=(async()=>{calls++;return kind==='exchange'?json({},400):calls===1?json(token):json({},401);}) as typeof fetch;
  await assert.rejects(()=>completeGoogleOAuth(config,callback.href,sessions,transactions,request),/AUTH_IMPLICIT_REJECTED|AUTH_CODE_EXCHANGE_FAILED|AUTH_USER_UNVERIFIED/);
  assert.deepEqual(getStoredSession(sessions),old);assert.equal(transactions.getItem(OAUTH_TRANSACTION_KEY),null);
 }
});

test('logout while code exchange is in flight is not undone by its response',async()=>{
 const {sessions,transactions,callback}=await setup();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));
 let calls=0;const request=(async()=>{if(++calls===1){sessions.removeItem(AUTH_SESSION_KEY);return json(token);}return json({id:'server-user'});}) as typeof fetch;
 await assert.rejects(()=>completeGoogleOAuth(config,callback.href,sessions,transactions,request),/AUTH_ACCOUNT_CHANGED/);
 assert.equal(getStoredSession(sessions),null);
});

test('concurrent refreshes exchange the rotating refresh token only once',async()=>{
 const sessions=storage();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));let calls=0;
 const request=(async(url)=>{calls++;return String(url).includes('/token?')?json(token):json({id:'server-user'});}) as typeof fetch;
 const [a,b]=await Promise.all([refreshSessionForConfig(config,sessions,request),refreshSessionForConfig(config,sessions,request)]);
 assert.equal(calls,2);assert.deepEqual(a,b);assert.equal(a?.refreshToken,'server-refresh');
});

test('refresh transient failure preserves session; rejection cannot erase a newly switched account',async()=>{
 const sessions=storage();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));
 assert.equal(await refreshSessionForConfig(config,sessions,(async()=>json({},503)) as typeof fetch),null);
 assert.deepEqual(getStoredSession(sessions),old);
 const next={...old,userId:'other-user',refreshToken:'other-refresh'};
 await refreshSessionForConfig(config,sessions,(async()=>{sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(next));return json({},401);}) as typeof fetch);
 assert.deepEqual(getStoredSession(sessions),next);
});


test('a successful refresh response cannot restore a signed-out session or change its user',async()=>{
 const sessions=storage();sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));
 let calls=0;const request=(async()=>{if(++calls===1){await signOutOnline(sessions);return json(token);}return json({id:'server-user'});}) as typeof fetch;
 assert.equal(await refreshSessionForConfig(config,sessions,request),null);assert.equal(getStoredSession(sessions),null);
 sessions.setItem(AUTH_SESSION_KEY,JSON.stringify(old));calls=0;
 await assert.rejects(()=>refreshSessionForConfig(config,sessions,(async()=>++calls===1?json(token):json({id:'unexpected-user'})) as typeof fetch),/AUTH_ACCOUNT_CHANGED/);
 assert.deepEqual(getStoredSession(sessions),old);
});

test('credential fragments are scrubbed from history before rejection',async()=>{
 const sessions=storage(),transactions=storage();
 const oldHistory=Object.getOwnPropertyDescriptor(globalThis,'history'),oldStorage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 let replaced='';
 try{
  Object.defineProperty(globalThis,'history',{configurable:true,value:{replaceState:(_a:unknown,_b:unknown,url:string)=>{replaced=url;}}});
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:transactions});
  await assert.rejects(()=>consumeOAuthRedirect('https://game.example/play/?view=home#access_token=secret&refresh_token=secret',sessions),/AUTH_IMPLICIT_REJECTED/);
  assert.equal(replaced,'/play/?view=home');assert.equal(getStoredSession(sessions),null);
 }finally{
  if(oldHistory)Object.defineProperty(globalThis,'history',oldHistory);else Reflect.deleteProperty(globalThis,'history');
  if(oldStorage)Object.defineProperty(globalThis,'sessionStorage',oldStorage);else Reflect.deleteProperty(globalThis,'sessionStorage');
 }
});
