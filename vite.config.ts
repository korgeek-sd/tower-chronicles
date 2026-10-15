import {defineConfig} from 'vite';
export default defineConfig({server:{host:'0.0.0.0',port:3000,allowedHosts:true},base:'./',resolve:{preserveSymlinks:true},optimizeDeps:{esbuildOptions:{preserveSymlinks:true,tsconfigRaw:{compilerOptions:{jsx:'automatic'}}}},build:{target:'es2022'}});
