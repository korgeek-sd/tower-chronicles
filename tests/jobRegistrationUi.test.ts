import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('JOB REGISTRATION UI 01: mobile job screen exposes registration and list tabs',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/직능등록/);
 assert.match(source,/직능목록/);
 assert.match(source,/10\+1 등록/);
 assert.match(source,/1,000 Gold · 총 11개/);
 assert.match(source,/SR 집중 열람/);
 assert.match(source,/SSR 집중 열람/);
});

test('JOB REGISTRATION UI 02: registration UI calls only server registration RPC wrappers',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/registerOnlineJob\(onlineLease,paidRolls\)/);
 assert.match(source,/getOnlineJobRegistrationState\(onlineLease\)/);
 assert.match(source,/setOnlineJobRegistrationPickups\(onlineLease,next\)/);
 assert.doesNotMatch(source,/Math\.random\(/);
});

test('JOB REGISTRATION UI 03: rebuilt gacha UI stays asset-free and viewport-contained',()=>{
 const source=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.equal(source.includes('assets/ui'),false);
 assert.equal(source.includes('<img'),false);
 assert.match(source,/tc-reg-vault-icon/);
 assert.match(source,/tc-reg-record-icon/);
 assert.match(css,/\.tc-registration\{height:100%;min-height:0;[^}]*display:grid/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});


test('JOB REGISTRATION UI 04: mobile controls keep usable touch targets',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-job-hub>\.tc-segments button\{min-height:42px/);
 assert.match(css,/\.tc-reg-pickups select\{[^}]*height:42px;min-height:42px/);
 assert.match(css,/\.tc-reg-draw\{[^}]*min-height:48px;height:52px/);
 assert.match(css,/\.tc-reg-result-foot>\.tc-action\{[^}]*min-height:44px;height:44px/);
});

test('JOB REGISTRATION UI 05: 10+1 result grid favors readable three-card rows and stays clipped to the viewport',()=>{
 const css=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-reg-result\{height:100%;min-height:0;overflow:hidden\}/);
 assert.match(css,/\.tc-reg-result-grid\{[^}]*grid-template-columns:repeat\(6,minmax\(0,1fr\)\);grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tc-reg-mini\{[^}]*grid-column:span 2/);
 assert.match(css,/\.tc-reg-mini:nth-child\(10\)\{grid-column:2\/span 2\}/);
 assert.match(css,/@media\(max-height:620px\)/);
 assert.match(css,/\.tc-job-hub\{grid-template-rows:44px minmax\(0,1fr\)\}/);
 assert.match(css,/\.tc-reg-result-multi\{grid-template-rows:32px minmax\(0,1fr\) 46px/);
});
