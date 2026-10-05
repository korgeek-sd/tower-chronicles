import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/components/battle/BattleScene.tsx',import.meta.url),'utf8');

test('battle fighter geometry scales from the 360x800 design grid and snaps to whole CSS pixels',()=>{
 assert.doesNotMatch(css,/\.player-placement\s*\{[^}]*left:\s*80px!important[^}]*top:\s*464px!important/s);
 assert.doesNotMatch(css,/\.monster-placement\s*\{[^}]*left:\s*264px!important[^}]*top:\s*272px!important/s);
 assert.match(css,/\.player-placement\s*\{[^}]*left:\s*var\(--battle-player-left\)!important[^}]*top:\s*var\(--battle-player-top\)!important[^}]*width:\s*var\(--battle-player-width\)!important[^}]*height:\s*var\(--battle-player-height\)!important/s);
 assert.match(css,/\.monster-placement\s*\{[^}]*left:\s*var\(--battle-monster-left\)!important[^}]*top:\s*var\(--battle-monster-top\)!important[^}]*width:\s*var\(--battle-monster-width\)!important[^}]*height:\s*var\(--battle-monster-height\)!important/s);
 assert.match(scene,/Math\.round\(width\*80\/360\)/);
 assert.match(scene,/Math\.round\(height\*464\/800\)/);
 assert.match(scene,/Math\.round\(width\*192\/360\)/);
 assert.match(scene,/Math\.round\(height\*272\/800\)/);
});
