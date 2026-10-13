import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('hunting applies Omyu Pretty to titles and body without altering the font or other screens',()=>{
 const css=readFileSync('src/components/hunting/hunting-fonts.css','utf8');
 assert.match(readFileSync('src/components/hunting/HuntingPage.tsx','utf8'),/import '\.\/hunting-fonts\.css'/);
 for(const name of ['DOSGothic','DOSMyungjo']){
  const font=readFileSync(`src/assets/fonts/${name}.woff2`);
  assert.equal(font.subarray(0,4).toString(),'wOF2');
  assert.ok(font.length<500000,'font download should remain small for mobile');
 }
 assert.match(css,/font-family: 'OmyuPretty'/);
 assert.match(css,/https:\/\/cdn\.jsdelivr\.net\/gh\/projectnoonnu\/noonfonts_2304-01@1\.0\/omyu_pretty\.woff2/);
 assert.doesNotMatch(css,/font-family: 'DOS/);
 assert.match(css,/font-display:\s*swap/);
 assert.match(css,/\.tc-hunt\s*\{/);
 assert.doesNotMatch(css,/(?:^|\n)(?:body|:root)\s*\{/);
 assert.match(readFileSync('src/assets/fonts/LICENSE.txt','utf8'),/Copyright.*Damheo Lee/);
 assert.match(readFileSync('src/assets/fonts/README.md','utf8'),/https:\/\/github.com\/hurss\/fonts/);
 assert.ok(readFileSync('public/dos-font-license.txt','utf8').includes(readFileSync('src/assets/fonts/LICENSE.txt','utf8')));
});
