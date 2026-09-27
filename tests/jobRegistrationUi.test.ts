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

test('JOB REGISTRATION UI 03: third-party game icons keep attribution',()=>{
 const credits=readFileSync(new URL('../THIRD_PARTY_ASSETS.md',import.meta.url),'utf8');
 const locked=readFileSync(new URL('../public/assets/ui/job-registration/locked-chest.svg',import.meta.url),'utf8');
 const scroll=readFileSync(new URL('../public/assets/ui/job-registration/scroll-quill.svg',import.meta.url),'utf8');
 assert.match(credits,/Lorc/);
 assert.match(credits,/Delapouite/);
 assert.match(credits,/CC BY 3\.0/);
 assert.match(locked,/viewBox="0 0 512 512"/);
 assert.match(scroll,/viewBox="0 0 512 512"/);
});
