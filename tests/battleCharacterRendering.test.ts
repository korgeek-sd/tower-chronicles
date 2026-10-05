import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/components/battle/BattleScene.tsx',import.meta.url),'utf8');

test('battle fighters use smooth browser scaling by default',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.player-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.monster-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
});

test('fighter rendering automatically switches from loaded image dimensions',()=>{
 assert.match(scene,/naturalWidth/);
 assert.match(scene,/naturalHeight/);
 assert.match(scene,/data-rendering=\{[^}]+\}/);
 assert.match(css,/\.player-figure\s+img\[data-rendering="pixelated"\][\s\S]*?image-rendering:\s*pixelated!important/);
 assert.match(css,/\.monster-figure\s+img\[data-rendering="pixelated"\][\s\S]*?image-rendering:\s*pixelated!important/);
 assert.doesNotMatch(css,/hunter\.webp|excavator\.webp/);
});
