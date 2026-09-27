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
 assert.match(css,/\.tc-registration\{height:100%;min-height:0;display:grid/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
