import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle fighters use larger responsive footprints on mobile',()=>{
 assert.match(css,/\.player-placement\s*\{[^}]*left:\s*25%!important[^}]*top:\s*57%!important[^}]*width:\s*68%!important[^}]*height:\s*43%!important/s);
 assert.match(css,/\.monster-placement\s*\{[^}]*left:\s*70%!important[^}]*top:\s*33%!important[^}]*width:\s*62%!important[^}]*height:\s*38%!important/s);
 assert.match(css,/left:round\(nearest,25vw,1px\)!important/);
 assert.match(css,/top:round\(nearest,57dvh,1px\)!important/);
 assert.match(css,/width:round\(nearest,68vw,1px\)!important/);
 assert.match(css,/height:round\(nearest,43dvh,1px\)!important/);
 assert.match(css,/left:round\(nearest,70vw,1px\)!important/);
 assert.match(css,/top:round\(nearest,33dvh,1px\)!important/);
 assert.match(css,/width:round\(nearest,62vw,1px\)!important/);
 assert.match(css,/height:round\(nearest,38dvh,1px\)!important/);
});
