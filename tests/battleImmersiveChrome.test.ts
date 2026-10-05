import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/battle-viewport.css',import.meta.url),'utf8');

test('battle mode removes non-combat chrome and reclaims the viewport',()=>{
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-settings-floating[\s\S]*?display:\s*none!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-mail-floating[\s\S]*?display:\s*none!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.tc-ref-flee[\s\S]*?display:\s*none!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.tc-ref-panel\s+\.tc-bprefs\s+button:first-child[\s\S]*?display:\s*none!important/);
 assert.match(css,/\.tc-app\.tc-battle-mode\s+\.tc-battle\s+\.tc-ref-top\s*\{[^}]*top:\s*max\(2\.4%,env\(safe-area-inset-top\)\)[^}]*left:\s*\.8%[^}]*right:\s*\.8%[^}]*height:\s*12\.5%/s);
});
