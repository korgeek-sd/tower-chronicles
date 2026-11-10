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

test('class codex library image assets show stone arches, shelves, candles, red moon and ornamental frames without altering gameplay',()=>{
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const background=readFileSync('public/assets/backgrounds/classes/class-library-v1.svg','utf8');
 const frame=readFileSync('public/assets/backgrounds/classes/class-ornament-frame-v1.svg','utf8');
 assert.match(component,/assets\/backgrounds\/classes\/class-library-v1\.svg/);
 assert.match(css,/assets\/backgrounds\/classes\/class-ornament-frame-v1\.svg/);
 assert.match(css,/\.tc-class-ambience\{[^}]*opacity:1/);
 for(const mark of ['id="moon"','id="gothic-arch"','id="bookshelves"','id="candlelight"','id="desk"'])assert.ok(background.includes(mark),mark);
 assert.match(frame,/id="gold-ornaments"/);
 assert.match(background,/<svg[^>]*viewBox="0 0 520 960"/);
 assert.match(frame,/<svg[^>]*viewBox="0 0 100 100"/);
 assert.ok(background.length>5000);
 assert.ok(frame.length>1000);
 assert.match(css,/pointer-events:none/);
});

test('profession codex uses the three approved illustrated class portraits from a dedicated WebP atlas',()=>{
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const art=readFileSync('public/assets/characters/classes/class-portraits-atlas-v1.webp');
 assert.ok(art.length>15000,'the atlas must contain the actual class illustrations');
 assert.equal(art.subarray(0,4).toString('ascii'),'RIFF');
 assert.equal(art.subarray(8,12).toString('ascii'),'WEBP');
 assert.match(component,/assets\/characters\/classes\/class-portraits-atlas-v1\.webp/);
 assert.match(component,/tc-class-portrait-art/);
 assert.match(component,/tc-class-feature-illustration/);
 for(const job of ['warrior','mage','archer']){
  assert.match(css,new RegExp('data-class="'+job+'"'));
 }
 assert.match(css,/background-size:\s*300%/);
 assert.match(css,/tc-class-illustration-atlas/);
 assert.match(css,/background-position/);
});
