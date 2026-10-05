import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighters use smooth browser scaling instead of forced pixelated rendering',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.player-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.monster-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
});
