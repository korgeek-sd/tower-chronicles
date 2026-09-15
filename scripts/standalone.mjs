import fs from 'node:fs';import path from 'node:path';
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,url)=>'<script type="module">'+fs.readFileSync(path.join('dist',url),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g,(_,url)=>'<style>'+fs.readFileSync(path.join('dist',url),'utf8')+'</style>');
fs.writeFileSync('play.html',html);console.log('play.html: self-contained offline build');
fs.cpSync('public/assets','assets',{recursive:true,force:true});console.log('assets/: copied for offline build');

