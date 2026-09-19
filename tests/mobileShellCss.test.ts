import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/components/mobile/mobile-shell.css',import.meta.url),'utf8');

test('mobile shell locks the document and uses the visible viewport',()=>{
  assert.match(css,/html,body,#root\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(css,/\.game-shell\{[^}]*height:100dvh[^}]*overflow:hidden/);
  assert.match(css,/\.game-shell\.standard\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
});

test('mobile chrome respects safe areas and 44px touch targets',()=>{
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/min-width:44px/);
  assert.match(css,/min-height:44px/);
});

test('shared mobile shell never globally scales the interface',()=>{
  assert.doesNotMatch(css,/transform:\s*scale\(/);
});
