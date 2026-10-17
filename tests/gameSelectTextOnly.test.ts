import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/ui/GameScrollSelect.tsx',import.meta.url),'utf8');
test('selector options contain text without decorative boxes or check icons',()=>{
 assert.doesNotMatch(source,/className=\{'tc-game-scroll-gem/);
 assert.doesNotMatch(source,/className="tc-game-scroll-check"/);
 assert.match(source,/aria-selected=\{value===option.value\}/);
 assert.match(source,/onClick=\{\(\)=>choose\(option\)\}/);
 assert.match(source,/tc-game-scroll-option-name/);
});
