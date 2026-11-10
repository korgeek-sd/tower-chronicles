import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CLASS_CATALOG,CLASS_LEVELS,initialClassProgress,chooseInitialClass,chooseClassGrowth,moveClassSkill,getActiveSkills,normalizeClassProgress} from '../src/game/classes/progression';
import {ClassProfessionScreen} from '../src/components/classes/ClassProfessionScreen';

test('three permanent classes offer exactly three choices at ten growth milestones',()=>{
 assert.deepEqual(Object.keys(CLASS_CATALOG),['warrior','mage','archer']);
 assert.deepEqual(CLASS_LEVELS,[10,20,30,40,50,60,70,80,90,100]);
 for(const job of Object.values(CLASS_CATALOG)){
  assert.equal(job.stages.length,10);
  assert.ok(job.stages.every(stage=>stage.options.length===3));
  assert.deepEqual(job.stages.map(stage=>stage.type),['active','active','passive','trait','active','passive','active','trait','passive','active']);
 }
});

test('class is chosen once; growth is level-gated and each tier is final',()=>{
 const first=chooseInitialClass(initialClassProgress(),'warrior');
 assert.equal(first.classId,'warrior');
 assert.equal(chooseInitialClass(first,'mage'),first);
 assert.equal(chooseClassGrowth(first,0,2,9),first);
 const grown=chooseClassGrowth(first,0,2,10);
 assert.equal(grown.picks[0],2);
 assert.equal(chooseClassGrowth(grown,0,0,100),grown);
 assert.equal(chooseClassGrowth(grown,1,3,100),grown);
 assert.equal(chooseClassGrowth(grown,9,0,99),grown);
 let complete=grown;
 for(let i=1;i<10;i++)complete=chooseClassGrowth(complete,i,0,100);
 assert.equal(getActiveSkills(complete).length,5);
 assert.equal(complete.order.length,5);
 const reordered=moveClassSkill(complete,0,1);
 assert.deepEqual(reordered.order.slice(0,2),[1,0]);
 assert.equal(moveClassSkill(complete,0,-1),complete);
 assert.equal(normalizeClassProgress({classId:'other',picks:[2],order:[5]}).classId,null);
});

test('approved concept 3: class codex has arched portraits, a featured hero and a ten-stage path',()=>{
 const screen=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 for(const name of ['직업','전사','마법사','궁수','직업 정보','직업 성장','Lv.10','Lv.100','자동 전투 스킬 순서','선택한 직업은 변경할 수 없습니다'])assert.ok(screen.includes(name),name);
 for(const feature of ['tc-class-arch-gallery','tc-class-featured','tc-class-feature-art','tc-class-traits','tc-class-path','tc-class-skill-list','tc-class-rank-seal'])assert.ok(screen.includes(feature),feature);
 assert.equal((screen.match(/aria-label="Lv\.(?:10|20|30|40|50|60|70|80|90|100) (?:스킬|패시브|특성) 선택지 확인"/g)??[]).length,10);
 assert.match(screen,/aria-label="스킬 1번 위로 이동"/);
 assert.match(screen,/aria-label="스킬 5번 아래로 이동"/);
 assert.ok(!screen.includes('직업 변경'));
 assert.ok(!screen.includes('tc-class-tabs'),'concept 3 is one continuous codex, not the old tabbed mockup');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.match(css,/\.tc-class-page\{/);
 assert.match(css,/\.tc-class-arch-gallery\{/);
 assert.match(css,/\.tc-class-featured\{/);
 assert.match(css,/\.tc-class-path\{/);
 assert.match(css,/\.tc-class-move button/);
 assert.match(css,/overflow:\s*hidden/);
 assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
 assert.match(css,/@media\s*\(max-width:\s*420px\)/);
 const main=readFileSync('src/main.tsx','utf8');
 assert.match(main,/page==='skills'&&<ClassProfessionScreen/);
});
