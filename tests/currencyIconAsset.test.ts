import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const hud=readFileSync(new URL('../src/components/mobile/game-topbar.css',import.meta.url),'utf8');
const treasury=readFileSync(new URL('../src/components/association/treasuryLedger.css',import.meta.url),'utf8');
const panel=readFileSync(new URL('../src/components/association/AssociationWarehousePanel.tsx',import.meta.url),'utf8');

test('approved currency artwork is a bundled transparent WebP sprite for all three currencies',()=>{
 const art=readFileSync(new URL('../src/components/mobile/currency-icons.webp',import.meta.url));
 assert.equal(art.toString('ascii',0,4),'RIFF');
 assert.equal(art.toString('ascii',8,12),'WEBP');
 assert.ok(art.length>2500 && art.length<30000);
 assert.ok(art.includes(Buffer.from('VP8X')),'WebP must support alpha / 3-icon sprite layout');
});

test('top-bar and treasury use the same sprite artwork rather than generated emoji coins',()=>{
 assert.match(hud,/currency-icons\.webp/);
 assert.match(treasury,/currency-icons\.webp/);
 assert.match(hud,/background-size:300% 100%/);
 assert.match(treasury,/background-size:300% 100%/);
 assert.match(hud,/\.tc-tapestry-coin\.gold/);
 assert.match(treasury,/\.tc-tl-ticket \.tc-tl-coin/);
 assert.doesNotMatch(hud,/\.tc-tapestry-coin:after/);
 assert.doesNotMatch(panel,/item\.glyph/);
 assert.match(panel,/balance\(item\.id,'treasury'\)/);
 assert.match(panel,/tc-tl-asset-emblem/);
});
