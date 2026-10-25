import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('waiting seal floats with independently staggered motes while crack frames stay stopped',()=>{
 const css=readFileSync('src/components/appearance/ssr-reveal.css','utf8');
 assert.match(css,/\.is-waiting \.tc-seal-stone-motion\{animation:tc-seal-idle-float 3\.6s ease-in-out infinite/);
 assert.match(css,/\.is-waiting \.tc-seal-mote\{animation:tc-seal-idle-mote/);
 assert.match(css,/nth-child\(4n\+2\)/);
 assert.match(css,/\.is-waiting \.tc-seal-stone-sprite\{animation:none;background-position:0 0/);
 assert.match(css,/prefers-reduced-motion:reduce\)\{\.tc-ssr-reveal \*\{animation:none!important/);
});
