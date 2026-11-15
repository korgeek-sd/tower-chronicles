import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/components/market/market-order-sheet.css',import.meta.url),'utf8');
test('price heading reserves the same height as its identity, quote, gap and border',()=>{
 assert.match(css,/--market-identity-height:44px/);
 assert.match(css,/grid-template-rows:calc\(var\(--market-identity-height\) \+ 36px\)/);
 assert.match(css,/grid-template-rows:var\(--market-identity-height\) 32px;gap:3px/);
});
test('range buttons fit inside their chart track without inherited padding',()=>{
 assert.match(css,/\.tc-market-v4-ranges\{height:44px;min-height:0;padding:0;border:0;box-sizing:border-box/);
 assert.match(css,/\.tc-market-v3-current\{min-height:0;align-items:center;line-height:1/);
});
