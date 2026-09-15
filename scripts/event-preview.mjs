import {build} from 'vite';
import fs from 'node:fs';import path from 'node:path';
const out='qa-v0.1.24/preview-build';
await build({configFile:false,base:'./',publicDir:false,build:{outDir:out,rollupOptions:{input:'event-qa.html'}}});
let html=fs.readFileSync(path.join(out,'event-qa.html'),'utf8');
html=html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,url)=>'<script type="module">'+fs.readFileSync(path.join(out,url),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g,(_,url)=>'<style>'+fs.readFileSync(path.join(out,url),'utf8')+'</style>');
fs.writeFileSync('event-preview.html',html);console.log('event-preview.html: isolated fixture preview');
