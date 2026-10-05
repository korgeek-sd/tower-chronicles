import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fighterImageRendering,LOW_RES_FIGHTER_MAX_PX} from '../src/components/battle/fighterImageRendering';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('battle fighters use smooth browser scaling by default',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.player-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.monster-figure\s+img[\s\S]*?image-rendering:\s*auto!important/);
});

test('low resolution fighter art switches to nearest-neighbour rendering from intrinsic dimensions',()=>{
 assert.equal(LOW_RES_FIGHTER_MAX_PX,256);
 assert.equal(fighterImageRendering(160,160),'pixelated');
 assert.equal(fighterImageRendering(168,168),'pixelated');
 assert.equal(fighterImageRendering(192,192),'pixelated');
 assert.equal(fighterImageRendering(256,180),'pixelated');
 assert.equal(fighterImageRendering(1024,1024),'auto');
 assert.equal(fighterImageRendering(0,0),'auto');
 assert.match(css,/\.player-figure\s+img\[data-rendering="pixelated"\][\s\S]*?image-rendering:\s*pixelated!important/);
 assert.match(css,/\.monster-figure\s+img\[data-rendering="pixelated"\][\s\S]*?image-rendering:\s*pixelated!important/);
 assert.doesNotMatch(css,/hunter\.webp|excavator\.webp/);
});

test('adaptive fighter rendering runtime is loaded by the game shell',()=>{
 assert.match(index,/src\/components\/battle\/fighterImageRendering\.ts/);
});
