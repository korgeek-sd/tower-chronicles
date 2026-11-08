// Firebase HTTP v1 sender. Deployed as a Supabase Edge Function.
// No unauthenticated access: require a shared secret stored in both Supabase
// Edge Secrets and Vault. Service role never reaches the mobile application.
type ServiceAccount={project_id:string;client_email:string;private_key:string;token_uri?:string};
type NotificationJob={id:string;title:string;body:string;target:string;tokens:string[]};
const env=(key:string)=>Deno.env.get(key)?.trim()??'';
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const enc=new TextEncoder();
const b64url=(value:Uint8Array|string)=>{
 const raw=typeof value==='string'?enc.encode(value):value;
 let str='';for(const byte of raw)str+=String.fromCharCode(byte);
 return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
function safeEqual(a:string,b:string){
 const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);
 return diff===0;
}
async function googleToken(account:ServiceAccount){
 const now=Math.floor(Date.now()/1000);
 const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const body=b64url(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const privatePem=account.private_key.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const pem=Uint8Array.from(atob(privatePem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',pem,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(header+'.'+body)));
 const assertion=header+'.'+body+'.'+b64url(signature);
 const result=await fetch('https://oauth2.googleapis.com/token',{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),
 });
 if(!result.ok)throw Error('FCM_OAUTH_FAILED');
 const json=await result.json();
 if(typeof json.access_token!=='string'||!json.access_token)throw Error('FCM_OAUTH_RESPONSE_INVALID');
 return json.access_token as string;
}
async function runJobRpc<T>(name:string,body:Record<string,unknown>,key:string,base:string):Promise<T>{
 const request=await fetch(base+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify(body),
 });
 if(!request.ok)throw Error('PUSH_RPC_'+name+'_'+request.status);
 if(request.status===204)return null as T;
 return await request.json() as T;
}
Deno.serve(async request=>{
 if(request.method!=='POST')return response(405,{error:'Method not allowed'});
 const secret=env('GAME_PUSH_DISPATCH_SECRET');
 const supplied=request.headers.get('x-game-push-secret')??'';
 if(secret.length<32||!safeEqual(secret,supplied))return response(403,{error:'Forbidden'});
 const key=env('SUPABASE_SERVICE_ROLE_KEY'),base=env('SUPABASE_URL');
 const accountRaw=env('FIREBASE_SERVICE_ACCOUNT_JSON');
 if(!key||!base||!accountRaw)return response(503,{error:'Server push credentials not configured'});
 let account:ServiceAccount;
 try{
  account=JSON.parse(accountRaw);
  if(account.project_id==null||!account.client_email||!account.private_key)throw Error('missing');
 }catch{return response(503,{error:'Invalid Firebase service account configuration'});}
 let token:string;
 try{token=await googleToken(account);}catch{return response(502,{error:'Firebase OAuth unavailable'});}
 let batch:NotificationJob[];
 try{batch=await runJobRpc<NotificationJob[]>('claim_game_push_batch',{p_limit:30},key,base);}
 catch{return response(502,{error:'Could not claim notification queue'});}
 let delivered=0,failed=0,invalid=0;
 for(const job of batch){
  const tokens=Array.isArray(job.tokens)?Array.from(new Set(job.tokens.filter(t=>typeof t==='string'&&t.length>0))):[];
  let succeeded=0,retryable=0;
  for(const deviceToken of tokens){
   try{
    const res=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(account.project_id)+'/messages:send',{
     method:'POST',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({message:{
      token:deviceToken,
      notification:{title:job.title.slice(0,120),body:job.body.slice(0,160)||'게임에서 확인하세요.'},
      data:{target:job.target,notificationId:job.id},
      android:{priority:'high',notification:{channel_id:'tower-events'}}
     }}),
    });
    if(res.ok){succeeded++;delivered++;continue;}
    const detail=await res.text();
    const stale=res.status===404||detail.includes('UNREGISTERED');
    if(stale){
     invalid++;
     await runJobRpc('remove_invalid_game_push_token',{p_token:deviceToken},key,base);
    }else{retryable++;failed++;}
   }catch{retryable++;failed++;}
  }
  // Prevent duplicate notifications across retries if at least one device received them.
  const success=succeeded>0||retryable===0;
  try{await runJobRpc('complete_game_push_delivery',{p_id:job.id,p_success:success},key,base);}
  catch{failed++;}
 }
 return response(200,{processed:batch.length,delivered,failed,invalid});
});
