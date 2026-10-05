import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighter placements use integer 8px-grid geometry on the 360x800 design canvas',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode \.tc-battle \.player-placement\s*\{[^}]*left:\s*80px!important[^}]*top:\s*464px!important[^}]*width:\s*192px!important[^}]*height:\s*272px!important/s);
 assert.match(css,/\.tc-app\.tc-battle-mode \.tc-battle \.monster-placement\s*\{[^}]*left:\s*264px!important[^}]*top:\s*272px!important[^}]*width:\s*184px!important[^}]*height:\s*248px!important/s);
});
