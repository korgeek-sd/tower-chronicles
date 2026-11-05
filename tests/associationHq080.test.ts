import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');

test('ASSOCIATION HQ 0.1.80 01: association identity and headquarters replace the dashboard feel',()=>{
 // The fixed HQ retains every function without the former scrolling notice/economy cards.
 for(const token of ['NOVAR EXPEDITION COMPANY','tc-company-hero','tc-company-herald',
  'tc-hq-announcement-strip','tc-hq-chat-strip','tc-gate-stats','tc-hq-feature-grid',
  'current.treasurySilver.toLocaleString()'])
  assert.match(screen,new RegExp(token));
 assert.match(screen,/\['overview','본부'\]/);
});

test('ASSOCIATION HQ 0.1.80 02: leader decisions remain visible and actionable',()=>{
 // Leader requests are visible as a main-tab badge; the approval panel remains protected.
 assert.match(screen,/tc-company-pending-dot/);
 assert.match(screen,/tab==='applications'&&leader/);
 assert.match(screen,/tab==='manage'&&leader/);
 assert.match(screen,/current\.applications\.length/);
 assert.match(screen,/단장 위임/);
 assert.match(screen,/내보내기/);
 assert.match(screen,/tc-assoc-application/);
 assert.match(screen,/가입 신청/);
});

test('ASSOCIATION HQ 0.1.80 03: activity and destructive management use dedicated states',()=>{
 assert.match(screen,/tc-assoc-activity/);
 assert.match(screen,/tc-assoc-danger-zone/);
 assert.match(screen,/원정단 해산/);
});

test('ASSOCIATION HQ 0.1.80 04: narrow phones get touch-safe association controls',()=>{
 const section=css.slice(css.indexOf('/* v0.1.80 — EXPEDITION COMPANY HQ'));
 assert.match(section,/@media\(max-width:380px\)/);
 assert.match(section,/\.tc-assoc-hq>\.tc-segments\{height:42px\}/);
 assert.match(section,/\.tc-assoc-member\{min-height:46px\}/);
 assert.match(section,/\.tc-assoc-member-actions button\{min-height:42px/);
 assert.match(section,/\.tc-assoc-directory article button\{height:42px\}/);
 assert.equal(/url\s*\(/i.test(section),false);
});
