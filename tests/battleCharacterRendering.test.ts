import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighters use smooth browser scaling by default',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.player-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.monster-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
});

test('low-resolution hunter and excavator sprites keep crisp nearest-neighbour scaling',()=>{
 assert.match(css,/\.player-figure\s+img\[src\*="hunter\.webp"\][\s\S]*?image-rendering:\s*pixelated!important/);
 assert.match(css,/\.player-figure\s+img\[src\*="excavator\.webp"\][\s\S]*?image-rendering:\s*pixelated!important/);
});
