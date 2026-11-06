import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('guild uses an independent courtyard background',()=>{
 const source=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/guild-courtyard-v3[.]webp/);
});
