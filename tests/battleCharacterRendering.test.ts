import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const viewport=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');
const battleScreen=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');

test('battle character art uses smooth scaling while skill art stays pixelated',()=>{
 assert.match(
  viewport,
  /\.tc-app\.tc-battle-mode \.player-figure img,\s*\.tc-app\.tc-battle-mode \.monster-figure img\s*\{[^}]*image-rendering:\s*auto!important/,
  'battle character and monster art should use browser smoothing'
 );
 assert.match(
  battleScreen,
  /tc-skill-art[^>]*style=\{\{[^}]*imageRendering:'pixelated'/s,
  'skill card art should keep pixelated rendering'
 );
});
