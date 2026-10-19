import {defineConfig,loadEnv} from 'vite';
import {securityMeta} from './scripts/security/browser-policy.mjs';
export default defineConfig(({mode})=>({plugins:[securityMeta(loadEnv(mode,process.cwd(),'VITE_').VITE_SUPABASE_URL)],server:{host:'0.0.0.0',port:3000,allowedHosts:true},base:'./',resolve:{preserveSymlinks:true},optimizeDeps:{esbuildOptions:{preserveSymlinks:true,tsconfigRaw:{compilerOptions:{jsx:'automatic'}}}},build:{target:'es2022'}}));
