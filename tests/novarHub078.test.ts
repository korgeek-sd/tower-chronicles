import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const core=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function TowersScreen'));

test('NOVAR HUB 0.1.78 01: dossier and expedition summary use live game data',()=>{
 assert.match(home,/tc-camp-dossier-title/);
 assert.match(home,/모험가 기록/);
 assert.match(home,/tc-camp-weapon-icon/);
 assert.match(home,/lootTotals\(loot\)/);
 assert.match(home,/game\.lastExpedition/);
 assert.match(home,/tc-camp-loot/);
});

test('NOVAR HUB 0.1.78 02: existing facility routes and primary CTA remain wired',()=>{
 for(const title of ['제작','직능목록','골드 거래소','협회 인장','점령전','강화','생물록','계정 · 저장'])
  assert.ok(home.includes(`title:'${title}'`),title);
 assert.match(home,/onClick=\{\(\)=>onMove\(game\.expedition\?'battle':'hunt'\)\}/);
 assert.match(home,/data-game-feel="press"/);
});

test('NOVAR HUB 0.1.78 03: concept styling stays asset-free and compacts on short phones',()=>{
 assert.match(css,/v0\.1\.78 — NOVAR DOSSIER HUB/);
 assert.match(css,/\.tc-camp-dossier-title\{/);
 assert.match(css,/\.tc-camp-expedition:before\{/);
 assert.match(css,/@media\(max-height:700px\)/);
 const section=css.slice(css.indexOf('/* v0.1.78 — NOVAR DOSSIER HUB'));
 assert.equal(/url\s*\(/i.test(section),false);
});

test('NOVAR HUB 0.1.79 04: narrow-phone rules prevent overlap and preserve touch targets',()=>{
 const section=css.slice(css.indexOf('/* v0.1.79 — NOVAR HUB NARROW PHONE HARDENING'));
 assert.match(section,/@media\(max-width:380px\)/);
 assert.match(section,/\.tc-camp-profile\{grid-template-columns:48px minmax\(0,1fr\) 86px/);
 assert.match(section,/\.tc-camp-expedition-copy\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(section,/\.tc-camp-loot\{width:100%;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(section,/\.tc-camp-links button\{min-width:0;min-height:46px/);
 assert.match(section,/\.tc-camp-depart\{min-height:46px/);
 assert.match(section,/\.tc-nav button\{min-height:44px/);
 assert.match(section,/text-overflow:ellipsis/);
});

