import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('result frames preserve original combat art and the repeat-destination scenery',()=>{
 const page=readFileSync('src/components/hunting/HuntingPage.tsx','utf8');
 assert.ok(page.includes("import './iron-results.css'"));
 const css=readFileSync('src/components/hunting/iron-results.css','utf8');
 assert.match(css,/\.tc-hunt\[data-view="result"\]/);
 assert.match(css,/\.tc-hunt-repeat-dock\{[^}]*border-image:[^;]+24 stretch/);
 assert.match(css,/\.tc-hunt-art img\{filter:none;object-fit:contain/);
 assert.doesNotMatch(css,/data-view="regions"/,'result skin must not alter the restored scenic region buttons');
});
test('next-hunt controls retain a full touch target and avoid the closed chat footprint',()=>{
 const page=readFileSync('src/components/hunting/HuntingPage.tsx','utf8');
 assert.ok(page.includes("import './iron-results.css'"));
 const css=readFileSync('src/components/hunting/iron-results.css','utf8');
 assert.match(css,/\.tc-hunt-repeat-dock\{[^}]*padding:4px 70px 4px 6px/);
 assert.match(css,/\.tc-hunt-next\{[^}]*min-height:44px/);
 assert.match(css,/\.tc-hunt-result span\{[^}]*white-space:normal/,'earned gear names must remain readable');
});
