import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('skill editor reserves space for all six slots and detail without a scrolling detail pane',()=>{
 const css=readFileSync(new URL('../src/components/hunting/skill-setup.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tc-skill-setup-detail\{[^}]*overflow:visible/);
 assert.match(css,/@media\(max-height:560px\)/);
});
