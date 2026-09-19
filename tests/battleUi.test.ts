import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const battleScreen=readFileSync(new URL('../src/components/battle/BattleScreen.tsx',import.meta.url),'utf8');
const immersiveCss=readFileSync(new URL('../src/components/battle/immersive.css',import.meta.url),'utf8');

test('battle action deck uses the Figma target 3x2 layout',()=>{
  assert.match(immersiveCss,/\.battle-deck\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(immersiveCss,/\.battle-deck\{[^}]*grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);
});

test('battle bottom is informational and does not duplicate flee action',()=>{
  const bottom=battleScreen.match(/<div className="battle-bottom">([\s\S]*?)<\/div>/)?.[1]??'';
  assert.ok(bottom.length>0,'battle-bottom should exist');
  assert.doesNotMatch(bottom,/onFlee/);
  assert.doesNotMatch(bottom,/<button/);
});

test('battle route spans the compact expedition header width',()=>{
  assert.match(immersiveCss,/\.battle-route\{[^}]*left:4%;right:4%/);
});

test('enemy facts sit on the upper-right of the battle field',()=>{
  assert.match(immersiveCss,/\.enemy-facts\{[^}]*left:auto;right:4%/);
});

test('prepared warning is a full-width strip below the focal fight area',()=>{
  assert.match(immersiveCss,/\.monster-prepared\{[^}]*left:4%;right:4%;transform:none;max-width:none/);
});

test('battle state line has a full-width stable reading lane',()=>{
  assert.match(immersiveCss,/\.battle-state-line\{[^}]*left:4%;right:4%/);
});
