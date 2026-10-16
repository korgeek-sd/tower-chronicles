import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/components/association/hq.css',import.meta.url),'utf8');
test('headquarters keeps navigation and overview in a bounded two-column viewport',()=>{
 assert.match(css,/HQ viewport layout/);
 const skin=css.slice(css.indexOf('/* HQ viewport layout'));
 assert.match(skin,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
 assert.match(skin,/\.tc-assoc-overview\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[^}]*overflow:visible/s);
 assert.match(skin,/\.tc-hq-occupation\{[^}]*min-height:64px/s);
 assert.match(skin,/\.tc-supply-donation-fold\[open\]\{[^}]*position:absolute/s);
 assert.match(skin,/\.tc-assoc-notice-board:has\(>p:not\(\.tc-hq-notice-preview\)\)\{[^}]*position:absolute/s);
 assert.match(skin,/@media\(max-height:740px\)/);
 assert.doesNotMatch(skin,/\.tc-hq-(?:occupation|chat)\{[^}]*display:none/s);
});
