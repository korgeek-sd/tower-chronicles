import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
test('GAME FEEL DOCS: canonical rulebook pins reusable interaction policy',()=>{
 const s=readFileSync(new URL('../docs/game-feel/README.md',import.meta.url),'utf8');
 for(const phrase of['subtle','normal','strong','exceptional','60–90ms','server-authoritative','prefers-reduced-motion','navigator.vibrate','Association Seal','Enhancement','Combat','Market','one-off'])assert.ok(s.includes(phrase),phrase);
});
