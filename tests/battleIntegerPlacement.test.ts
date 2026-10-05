import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighter geometry stays responsive and snaps to whole CSS pixels',()=>{
 assert.doesNotMatch(css,/\.player-placement\s*\{[^}]*left:\s*\d+px!important/s);
 assert.doesNotMatch(css,/\.monster-placement\s*\{[^}]*left:\s*\d+px!important/s);
 assert.match(css,/@supports\s*\(left:\s*round\(nearest,\s*10vw,\s*1px\)\)/);
 assert.match(css,/\.player-placement\s*\{[^}]*left:\s*round\(nearest,\s*[\d.]+vw,\s*1px\)!important[^}]*top:\s*round\(nearest,\s*[\d.]+dvh,\s*1px\)!important[^}]*width:\s*round\(nearest,\s*[\d.]+vw,\s*1px\)!important[^}]*height:\s*round\(nearest,\s*[\d.]+dvh,\s*1px\)!important/s);
 assert.match(css,/\.monster-placement\s*\{[^}]*left:\s*round\(nearest,\s*[\d.]+vw,\s*1px\)!important[^}]*top:\s*round\(nearest,\s*[\d.]+dvh,\s*1px\)!important[^}]*width:\s*round\(nearest,\s*[\d.]+vw,\s*1px\)!important[^}]*height:\s*round\(nearest,\s*[\d.]+dvh,\s*1px\)!important/s);
});
