import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const core=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
const home=core.slice(core.indexOf('export function HomeScreen'),core.indexOf('export function SkillsScreen'));

test('NOVAR HUB V2: profile and always-on chat use real character and hunting values',()=>{
 assert.match(home,/tc-camp-v2-dossier/);
 assert.match(home,/jobById\(game.currentJobId\)/);
 assert.match(home,/stats\(game,equipped\)/);
 assert.match(home,/getHuntingState\(lease\)/);
 assert.match(home,/huntStatus\?\.maxMp/);
 assert.match(home,/huntStatus\?\.vitality/);
 assert.match(home,/tc-camp-chat-dock/);
});
test('NOVAR HUB V2: major actions and every former utility route remain connected',()=>{
 for(const title of ['제작','외형 목록','골드 거래소','협회 인장','점령전','생물록','우편함','설정'])
  assert.ok(home.includes(`name:'${title}'`),title);
 for(const route of ['craft','skills','stats','gold-exchange','occupation','bestiary','inventory','settings','seal'])
  assert.ok(home.includes(`onMove('${route}')`),route);
 assert.match(home,/onClick=\{\(\)=>onMove\(game.expedition\?'battle':'hunt'\)\}/);
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

