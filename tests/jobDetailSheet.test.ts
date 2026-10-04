import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JOB_CATALOG} from '../src/game/jobs/catalog';
import {JOB_DETAIL_CATALOG,jobDetailById} from '../src/game/jobs/details';

test('JOB DETAIL 01: every C-rank job exposes a description and three active skill previews',()=>{
 const cJobs=JOB_CATALOG.filter(job=>job.rarity==='C');
 assert.equal(cJobs.length,8);
 for(const job of cJobs){
  const detail=jobDetailById(job.id);
  assert.ok(detail,`${job.id} detail missing`);
  assert.ok(detail.description.trim().length>0,`${job.id} description missing`);
  assert.equal(detail.skills.length,3,`${job.id} must expose exactly three skills`);
  for(const skill of detail.skills){
   assert.ok(skill.name.trim().length>0);
   assert.ok(skill.description.trim().length>0);
   assert.ok(Number.isInteger(skill.cooldown)&&skill.cooldown>=0);
  }
 }
 assert.equal(Object.keys(JOB_DETAIL_CATALOG).filter(id=>cJobs.some(job=>job.id===id)).length,8);
});

test('JOB DETAIL 02: confirmed contract mercenary preview carries resource, cooldown, and damage values',()=>{
 const detail=jobDetailById('contract_mercenary');
 assert.ok(detail);
 assert.equal(detail.skills[0].name,'계약자의 베기');
 assert.equal(detail.skills[0].cooldown,1);
 assert.equal(detail.skills[0].resourceLabel,'자원 +1');
 assert.match(detail.skills[0].description,/120%/);
 assert.equal(detail.skills[2].name,'계약 이행');
 assert.equal(detail.skills[2].cooldown,2);
 assert.equal(detail.skills[2].resourceLabel,'자원 -2');
 assert.match(detail.skills[2].description,/260%/);
});

test('JOB DETAIL 03: job list opens a dedicated accessible detail sheet without removing select controls',()=>{
 const screen=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 const sheet=readFileSync(new URL('../src/components/jobs/JobDetailSheet.tsx',import.meta.url),'utf8');
 assert.match(screen,/JobDetailSheet/);
 assert.match(screen,/selectedJobId/);
 assert.match(screen,/setSelectedJobId\(job\.id\)/);
 assert.match(sheet,/role="dialog"/);
 assert.match(sheet,/aria-modal="true"/);
 assert.match(sheet,/tc-job-detail-skills/);
 assert.match(sheet,/쿨다운/);
 assert.match(sheet,/자원/);
 assert.match(sheet,/onSelect/);
});

test('JOB DETAIL 04: detail sheet follows the one-screen mobile modal pattern',()=>{
 const css=readFileSync(new URL('../src/components/jobs/job-detail-sheet.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-job-detail-backdrop\{/);
 assert.match(css,/\.tc-job-detail\{/);
 assert.match(css,/\.tc-job-detail-skills\{/);
 assert.match(css,/\.tc-job-detail-skill/);
 assert.match(css,/max-height:/);
 assert.match(css,/overflow:/);
});

test('JOB DETAIL 05: tapping anywhere on a job card opens details while select stays independent',()=>{
 const screen=readFileSync(new URL('../src/components/JobsScreen.tsx',import.meta.url),'utf8');
 assert.match(screen,/className=\{'tc-job'\+\(job\.visualAssetKey\?' has-art':''\)\} key=\{job\.id\} onClick=\{\(\)=>setSelectedJobId\(job\.id\)\}/);
 assert.match(screen,/onClick=\{event=>\{event\.stopPropagation\(\);selectJob\(job\.id\);\}\}/);
});
