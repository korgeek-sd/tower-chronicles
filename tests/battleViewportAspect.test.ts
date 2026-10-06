import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const viewportCssUrl=new URL('../src/battle-viewport.css',import.meta.url);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('battle keeps the 20:9 design grid but fills the visible browser viewport on mobile',()=>{
 assert.equal(existsSync(viewportCssUrl),true);
 const css=readFileSync(viewportCssUrl,'utf8');
 assert.match(index,/href="\/src\/battle-viewport\.css"/);
 assert.match(css,/--tc-battle-design-width:\s*360/);
 assert.match(css,/--tc-battle-design-height:\s*800/);
 const shell=css.match(/\.tc-app\.tc-battle-mode\{([^}]+)\}/)?.[1]??'';
 assert.match(shell,/width:100vw!important/);
 assert.match(shell,/height:100dvh!important/);
});

test('desktop battle shell uses the same 520px horizontal canvas as the stronghold',()=>{
 const css=readFileSync(viewportCssUrl,'utf8');
 const desktop=css.split('@media (min-width:900px) and (orientation:landscape)')[1]??'';
 assert.match(desktop,/\.tc-app\.tc-battle-mode\{[^}]*width:min\(100%,520px\)!important[^}]*margin:0 auto!important/s);
});

test('desktop landscape battle fills its canvas and uses desktop-relative combat placement',()=>{
 const css=readFileSync(viewportCssUrl,'utf8');
 const desktop=css.split('@media (min-width:900px) and (orientation:landscape)')[1]??'';
 assert.match(desktop,/\.tc-main>\.tc-battle\{[^}]*width:100%!important[^}]*height:100%!important/s);
 assert.doesNotMatch(desktop,/width:min\(45dvh,100vw\)/,'desktop must not be squeezed into a phone-width column');
 assert.match(desktop,/\.monster-hud\{[^}]*left:3%!important[^}]*top:14%!important[^}]*width:30%!important/s);
 assert.match(desktop,/\.player-hud\{[^}]*right:3%!important[^}]*top:54%!important[^}]*width:30%!important/s);
 assert.match(desktop,/\.player-placement\{[^}]*left:28%!important[^}]*top:60%!important[^}]*width:52%!important[^}]*height:52%!important/s);
 assert.match(desktop,/\.monster-placement\{[^}]*left:72%!important[^}]*top:34%!important[^}]*width:48%!important[^}]*height:48%!important/s);
 assert.doesNotMatch(desktop,/round\(nearest,[\d.]+vw,1px\)/);
});
