export interface SupabasePublicConfig {url:string;publishableKey:string}

const clean=(value:unknown)=>typeof value==='string'?value.trim():'';

export function readSupabaseConfig(env?:Partial<ImportMetaEnv>):SupabasePublicConfig|null {
 const url=clean(env?.VITE_SUPABASE_URL),publishableKey=clean(env?.VITE_SUPABASE_PUBLISHABLE_KEY);
 if(!url||!publishableKey)return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'&&parsed.hostname!=='localhost'&&parsed.hostname!=='127.0.0.1')return null;
  return {url:parsed.origin,publishableKey};
 }catch{return null;}
}

const runtimeEnv=(import.meta as ImportMeta&{env?:ImportMetaEnv}).env;
export const supabaseConfig=readSupabaseConfig(runtimeEnv);
export const onlineConfigured=!!supabaseConfig;
