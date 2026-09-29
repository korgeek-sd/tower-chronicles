import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
const marker='/* v0.1.77 — PARCHMENT SKIN / visual-only reskin';
const endMarker='/* END v0.1.77 PARCHMENT SKIN */';
const start=css.indexOf(marker),end=css.indexOf(endMarker,start);
const skin=css.slice(start,end);

test('PARCHMENT SKIN 01: v0.1.77 skin is present and targets the existing shell',()=>{
 assert.ok(css.includes(marker));
 assert.ok(css.includes(endMarker));
 for(const selector of ['.tc-topbar{','.tc-panel{','.tc-nav{','.tc-camp-dossier{','.tc-camp-depart{','.tc-camp-links{'])
  assert.ok(skin.includes(selector),selector+' missing from visual skin');
});

test('PARCHMENT SKIN 02: skin stays visual-only and asset-free',()=>{
 for(const forbidden of [/grid-template/i,/\bposition\s*:/i,/\bwidth\s*:/i,/\bheight\s*:/i,/\bpadding\s*:/i,/\bmargin\s*:/i,/\bdisplay\s*:/i,/\bgap\s*:/i,/\boverflow\s*:/i,/\bfont-size\s*:/i])
  assert.equal(forbidden.test(skin),false,'layout rule leaked into skin: '+forbidden);
 assert.equal(/url\s*\(/i.test(skin),false);
});
