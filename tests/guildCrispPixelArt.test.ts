import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=()=>readFileSync(new URL('../src/components/association/gatehouse.css',import.meta.url),'utf8');
test('association background pixels stay sharp when the portrait art is magnified',()=>{
 const source=css();
 const block=source.match(/\.tc-courtyard-art\s*\{[^}]+\}/)?.[0]??'';
 assert.match(block,/image-rendering:\s*pixelated/,'prevent bilinear blur on the enlarged low-resolution pixel art');
 assert.doesNotMatch(block,/filter:\s*blur/);
});
