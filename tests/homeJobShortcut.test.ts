import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('HOME JOB SHORTCUT 01: base camp replaces cosmetics shortcut with dedicated job registration',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function TowersScreen'));
 assert.match(home,/title:'직능등록'/);
 assert.match(home,/subtitle:'100G · 10\+1'/);
 assert.match(home,/onOpenJobs\('register'\)/);
 assert.doesNotMatch(home,/title:'외형'/);
 assert.doesNotMatch(home,/onMove\('cosmetics'\)/);
});

test('HOME JOB SHORTCUT 02: existing job shortcut opens the job list instead of duplicating the gacha entry',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function TowersScreen'));
 assert.match(home,/title:'직능목록'/);
 assert.match(home,/subtitle:'보유·전투 키트'/);
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
