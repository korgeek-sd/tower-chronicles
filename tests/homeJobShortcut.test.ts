import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('HOME JOB SHORTCUT 01: base camp replaces registration with crafting',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function TowersScreen'));
 assert.match(home,/title:'제작'/);
 assert.match(home,/subtitle:'포션 · 음식 · 도전권'/);
 assert.match(home,/onMove\('craft'\)/);
 assert.doesNotMatch(home,/title:'직능등록'/);
 assert.doesNotMatch(home,/title:'외형'/);
 assert.doesNotMatch(home,/onMove\('cosmetics'\)/);
});

test('HOME JOB SHORTCUT 02: existing job shortcut opens the job list instead of duplicating the gacha entry',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function TowersScreen'));
 assert.match(home,/title:'직능목록'/);
 assert.match(home,/game\.ownedJobIds\.length/);
 assert.match(home,/onOpenJobs\('list'\)/);
});

test('HOME JOB SHORTCUT 03: app routes the selected home shortcut to the requested jobs tab',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const jobs=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(main,/const \[jobsEntryTab,setJobsEntryTab\]=useState<JobTab>\('register'\)/);
 assert.match(main,/function openJobs\(tab:JobTab\)/);
 assert.match(main,/onOpenJobs=\{openJobs\}/);
 assert.match(main,/initialTab=\{jobsEntryTab\}/);
 assert.match(jobs,/initialTab='register'/);
 assert.match(jobs,/useState<JobTab>\(initialTab\)/);
});


test('HOME FACILITY 04: base camp removes retired enhancement shortcut',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function TowersScreen'));
 assert.match(home,/title:'골드 거래소'/);
 assert.match(home,/subtitle:'Gold ↔ Silver'/);
 assert.match(home,/onMove\('gold-exchange'\)/);
 assert.doesNotMatch(home,/title:'강화'/);
 assert.doesNotMatch(home,/subtitle:'장비 강화'/);
 assert.doesNotMatch(home,/onMove\('enhancement'\)/);
 assert.doesNotMatch(home,/title:'전투 스킬'/);
 assert.doesNotMatch(home,/onMove\('skills'\)/);
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/page==='enhancement'/);
});
