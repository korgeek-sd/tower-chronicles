import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const viewportCssUrl=new URL('../src/battle-viewport.css',import.meta.url);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('battle keeps the 20:9 design grid but fills the visible browser viewport',()=>{
 assert.equal(existsSync(viewportCssUrl),true,'battle viewport stylesheet must exist');
 const css=readFileSync(viewportCssUrl,'utf8');
 assert.match(index,/href="\/src\/battle-viewport\.css"/);
 assert.match(css,/--tc-battle-design-width:\s*360/);
 assert.match(css,/--tc-battle-design-height:\s*800/);
 const shell=css.match(/\.tc-app\.tc-battle-mode\{([^}]+)\}/)?.[1]??'';
 const main=css.match(/\.tc-app\.tc-battle-mode \.tc-main\{([^}]+)\}/)?.[1]??'';
 assert.match(shell,/width:100vw!important/,'battle shell must span the full visible width');
 assert.match(shell,/height:100dvh!important/,'battle shell must span the full visible height');
 assert.match(shell,/max-width:none!important/,'battle shell must override the legacy 620px cap');
 assert.match(main,/width:100%!important/,'battle content must not letterbox horizontally');
 assert.match(main,/height:100%!important/,'battle content must fill the shell vertically');
 assert.doesNotMatch(main,/min\(100vw,calc\(100dvh \* 9 \/ 20\)\)/,'battle content must not shrink its width from browser chrome height');
});
