import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle character art uses browser smoothing instead of pixelated scaling',()=>{
 const match=css.match(/\.tc-app\.tc-battle-mode \.tc-battle \.player-figure img,\s*\.tc-app\.tc-battle-mode \.tc-battle \.monster-figure img\{([^}]+)\}/);
 assert.ok(match,'battle character smoothing override must exist');
 const rule=match[1];
 assert.match(rule,/image-rendering:\s*auto!important/);
});
