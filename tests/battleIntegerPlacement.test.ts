import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighter geometry scales with the viewport and snaps to whole CSS pixels',()=>{
 assert.doesNotMatch(css,/\.player-placement\s*\{[^}]*left:\s*80px!important[^}]*top:\s*464px!important/s);
 assert.doesNotMatch(css,/\.monster-placement\s*\{[^}]*left:\s*264px!important[^}]*top:\s*272px!important/s);
 assert.match(css,/\.player-placement\s*\{[^}]*left:\s*22\.2222%!important[^}]*top:\s*58%!important[^}]*width:\s*53\.3333%!important[^}]*height:\s*34%!important/s);
 assert.match(css,/\.monster-placement\s*\{[^}]*left:\s*73\.3333%!important[^}]*top:\s*34%!important[^}]*width:\s*51\.1111%!important[^}]*height:\s*31%!important/s);
 assert.match(css,/@supports\s*\(left:\s*round\(nearest,\s*10vw,\s*1px\)\)/);
 assert.match(css,/left:\s*round\(nearest,\s*22\.2222vw,\s*1px\)!important/);
 assert.match(css,/top:\s*round\(nearest,\s*58dvh,\s*1px\)!important/);
});
