import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const style=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const pager=readFileSync(new URL('../src/components/MobileScreenPager.tsx',import.meta.url),'utf8');

test('the whole app uses a fixed mobile viewport instead of document scrolling',()=>{
  assert.match(style,/html,body,#root\{[^}]*height:100%[^}]*overflow:hidden/);
  assert.match(style,/\.app\{[^}]*height:100dvh[^}]*overflow:hidden/);
  assert.match(style,/main\{[^}]*min-height:0[^}]*overflow:hidden/);
});

test('bottom navigation participates in the viewport layout instead of extending the page',()=>{
  assert.match(style,/nav\{[^}]*position:relative/);
  assert.match(style,/nav\{[^}]*transform:none/);
});

test('legacy screens retain their no-scroll pager',()=>{
  assert.match(main,/MobileScreenPager/);
  assert.match(style,/\.mobile-screen-pager\{[^}]*overflow:hidden/);
  assert.match(pager,/이전/);
  assert.match(pager,/다음/);
});

test('pager fits oversized content without enabling vertical scrolling',()=>{
  assert.match(pager,/ResizeObserver/);
  assert.match(pager,/transform/);
  assert.match(pager,/scale\(/);
});
