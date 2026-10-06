import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const viewportCssUrl=new URL('../src/battle-viewport.css',import.meta.url);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('battle keeps the 20:9 design grid but fills the visible browser viewport on mobile',()=>{
 assert.equal(existsSync(viewportCssUrl),true,'battle viewport stylesheet must exist');
 const css=readFileSync(viewportCssUrl,'utf8');
 assert.match(index,/href="\/src\/battle-viewport\.css"/);
 assert.match(css,/--tc-battle-design-width:\s*360/);
 assert.match(css,/--tc-battle-design-height:\s*800/);
 const shell=css.match(/\.tc-app\.tc-battle-mode\{([^}]+)\}/)?.[1]??'';
 const main=css.match(/\.tc-app\.tc-battle-mode \.tc-main\{([^}]+)\}/)?.[1]??'';
 assert.match(shell,/width:100vw!important/);
 assert.match(shell,/height:100dvh!important/);
 assert.match(shell,/max-width:none!important/);
 assert.match(main,/width:100%!important/);
 assert.match(main,/height:100%!important/);
});

test('desktop landscape battle uses a centered 20:9 stage and stage-relative fighter geometry',()=>{
 const css=readFileSync(viewportCssUrl,'utf8');
 assert.match(css,/@media\s*\(min-width:900px\)\s*and\s*\(orientation:landscape\)[\s\S]*?\.tc-app\.tc-battle-mode \.tc-main\{[^}]*display:flex!important[^}]*justify-content:center!important/s);
 assert.match(css,/@media\s*\(min-width:900px\)\s*and\s*\(orientation:landscape\)[\s\S]*?\.tc-main>\.tc-battle\{[^}]*width:min\(45dvh,100vw\)!important[^}]*height:100dvh!important/s);
 const desktop=css.split('@media (min-width:900px) and (orientation:landscape)')[1]??'';
 assert.doesNotMatch(desktop,/round\(nearest,[\d.]+vw,1px\)/,'desktop fighter placement must not be overwritten by viewport-width geometry');
});
