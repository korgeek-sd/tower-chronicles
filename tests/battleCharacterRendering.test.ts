import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('battle character art uses browser smoothing instead of pixelated scaling',()=>{
 const match=css.match(/\.tc-battle \.player-figure img,\.tc-battle \.monster-figure img\{([^}]+)\}/);
 assert.ok(match,'battle character image rule must exist');
 const rule=match[1];
 assert.match(rule,/image-rendering:\s*auto/);
 assert.doesNotMatch(rule,/image-rendering:\s*pixelated/);
});
