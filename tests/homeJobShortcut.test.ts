import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('HOME JOB SHORTCUT 01: base camp replaces registration with crafting',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function SkillsScreen'));
 assert.match(home,/name:'제작'/);
 assert.match(home,/id:'craft'/);
 assert.match(home,/onMove\('craft'\)/);
 assert.doesNotMatch(home,/title:'직능등록'/);
 assert.doesNotMatch(home,/title:'외형'/);
 assert.match(home,/id:'cosmetics'/);
 assert.match(home,/name:'컬렉션'/);
 assert.match(home,/onMove\('cosmetics'\)/);
});

test('HOME JOB SHORTCUT 02: existing job shortcut opens the job list instead of duplicating the gacha entry',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function SkillsScreen'));
 assert.match(home,/name:'외형 목록'/);
 assert.match(home,/id:'jobs-list'/);
 assert.match(home,/onOpenJobs\('list'\)/);
});

test('HOME JOB SHORTCUT 03: app routes the selected home shortcut to the requested jobs tab',()=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const jobs=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(main,/const \[jobsEntryTab,setJobsEntryTab\]=useState<JobTab>\('register'\)/);
 assert.match(main,/function openJobs\(tab:JobTab\)/);
 assert.match(main,/onOpenJobs=\{openJobs\}/);
 assert.match(main,/jobsEntryTab==='list'&&<CosmeticsScreen/);
 assert.match(main,/jobsEntryTab==='register'&&<AppearanceSummonScreen/);
 assert.match(jobs,/initialTab='register'/);
 assert.match(jobs,/useState<JobTab>\(initialTab\)/);
});


test('HOME FACILITY 04: base camp removes retired enhancement shortcut',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const home=source.slice(source.indexOf('export function HomeScreen'),source.indexOf('export function SkillsScreen'));
 assert.match(home,/name:'골드 거래소'/);
 assert.match(home,/id:'gold-exchange'/);
 assert.match(home,/onMove\('gold-exchange'\)/);
 assert.doesNotMatch(home,/title:'강화'/);
 assert.doesNotMatch(home,/subtitle:'장비 강화'/);
 assert.doesNotMatch(home,/onMove\('enhancement'\)/);
 assert.doesNotMatch(home,/title:'전투 스킬'/);
 assert.match(home,/name:'스킬트리'/);
 assert.match(home,/onMove\('skills'\)/);
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/page==='enhancement'/);
});

test('HOME APPEARANCE SUMMON: visible main facility opens the summon screen',()=>{
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 const main=source.slice(source.indexOf('const mainFacilities='),source.indexOf('const extraFacilities='));
 assert.match(main,/id:'appearance-summon',glyph:'jobs',name:'외형 소환',action:\(\)=>onOpenJobs\('register'\)/);
 const extra=source.slice(source.indexOf('const extraFacilities='),source.indexOf('return <Screen title="노바르 거점"'));
 assert.match(extra,/id:'stats',glyph:'skill',name:'스탯 분배',action:\(\)=>onMove\('stats'\)/);
});
