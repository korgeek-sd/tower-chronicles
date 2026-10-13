import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the whole game uses the supplied DungGeunMo font including late-loaded screens and controls',()=>{
 const css=readFileSync('src/game-fonts.css','utf8');
 assert.match(readFileSync('src/main.tsx','utf8'),/import '\.\/game-fonts\.css'/);
 assert.match(readFileSync('src/components/hunting/HuntingPage.tsx','utf8'),/import '\.\/hunting-fonts\.css'/);
 for(const name of ['DOSGothic','DOSMyungjo']){
  const font=readFileSync(`src/assets/fonts/${name}.woff2`);
  assert.equal(font.subarray(0,4).toString(),'wOF2');
  assert.ok(font.length<500000,'font download should remain small for mobile');
 }
 assert.match(css,/font-family: 'DungGeunMo'/);
 assert.match(css,/assets\/fonts\/DungGeunMo\.woff2/);
 assert.equal(readFileSync('src/assets/fonts/DungGeunMo.woff2').subarray(0,4).toString(),'wOF2');
 assert.doesNotMatch(css,/font-family: 'DOS/);
 assert.match(css,/font-display:\s*swap/);
 assert.match(css,/:root, body, body \*\s*\{/);
 assert.match(css,/font-family: var\(--game-font\) !important/);
 assert.doesNotMatch(readFileSync('src/components/hunting/hunting-fonts.css','utf8'),/@font-face/);
 assert.match(readFileSync('src/assets/fonts/LICENSE.txt','utf8'),/Copyright.*Damheo Lee/);
 assert.match(readFileSync('src/assets/fonts/README.md','utf8'),/https:\/\/github.com\/hurss\/fonts/);
 assert.ok(readFileSync('public/dos-font-license.txt','utf8').includes(readFileSync('src/assets/fonts/LICENSE.txt','utf8')));
});
