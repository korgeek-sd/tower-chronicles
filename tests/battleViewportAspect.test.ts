import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const viewportCssUrl=new URL('../src/battle-viewport.css',import.meta.url);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('battle viewport uses a dedicated portrait 20:9 design canvas',()=>{
 assert.equal(existsSync(viewportCssUrl),true,'battle viewport stylesheet must exist');
 const css=readFileSync(viewportCssUrl,'utf8');
 assert.match(index,/href="\/src\/battle-viewport\.css"/);
 assert.match(css,/--tc-battle-design-width:\s*360/);
 assert.match(css,/--tc-battle-design-height:\s*800/);
 assert.match(css,/aspect-ratio:\s*9\s*\/\s*20/);
 assert.match(css,/width:\s*min\(100vw,\s*calc\(100dvh\s*\*\s*9\s*\/\s*20\)\)/);
 assert.match(css,/height:\s*min\(100dvh,\s*calc\(100vw\s*\*\s*20\s*\/\s*9\)\)/);
 const shell=css.match(/\.tc-app\.tc-battle-mode\{([^}]+)\}/)?.[1]??'';
 assert.match(shell,/display:grid!important/,'battle shell must override the legacy display:block rule');
 assert.match(shell,/max-width:none!important/,'battle shell must override the legacy 620px cap');
});
