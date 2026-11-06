import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const css=()=>readFileSync(new URL('../src/components/association/gatehouse.css',import.meta.url),'utf8');
test('association background pixels stay sharp when the portrait art is magnified',()=>{
 const source=css();
 const block=source.match(/\.tc-courtyard-art\s*\{[^}]+\}/)?.[0]??'';
 assert.match(block,/image-rendering:\s*pixelated/,'prevent bilinear blur on the enlarged low-resolution pixel art');
 assert.doesNotMatch(block,/filter:\s*blur/);
});

test('guild courtyard ships a detailed retina asset instead of the tiny blurred preview',()=>{
 const path=new URL('../public/assets/backgrounds/association/guild-courtyard-v3.webp',import.meta.url);
 const art=readFileSync(path);
 assert.ok(statSync(path).size>200_000,'retain full-size high-quality pixel art');
 assert.equal(art.toString('ascii',0,4),'RIFF');
 assert.equal(art.toString('ascii',8,12),'WEBP');
 const screen=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
 assert.match(screen,/guild-courtyard-v3[.]webp/);
 assert.doesNotMatch(screen,/guild-courtyard-v2[.]webp/);
});
