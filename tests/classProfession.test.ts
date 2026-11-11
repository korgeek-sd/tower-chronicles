import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CLASS_CATALOG,CLASS_LEVELS,initialClassProgress,chooseInitialClass,chooseClassGrowth,moveClassSkill,getActiveSkills,normalizeClassProgress} from '../src/game/classes/progression';
import {ClassProfessionScreen,recommendedClassStage} from '../src/components/classes/ClassProfessionScreen';

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

test('approved no-character gothic skill tree has ten levels and three interactive choices',()=>{
 const screen=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 for(const label of ['직업','전사','마법사','궁수','전사 스킬트리','10레벨마다 3가지 중 1개','3개 중 1개','이 능력으로 확정','이 직업으로 시작'])assert.ok(screen.includes(label),label);
 assert.equal((screen.match(/aria-label="Lv\.(?:10|20|30|40|50|60|70|80|90|100) (?:스킬|패시브|특성) 선택지 확인"/g)??[]).length,10);
 assert.equal((screen.match(/class="tc-class-choice-card/g)??[]).length,3);
 assert.doesNotMatch(screen,/tc-class-portrait-art|tc-class-feature-illustration|tc-class-arch-gallery/);
 assert.ok(screen.includes('tc-class-crest'),'lion heraldry replaces portrait');
 assert.ok(screen.includes('tc-class-path'),'ten-stage skill growth remains visible');
 assert.match(screen,/role="group" aria-label="스킬 선택지"/);
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.match(css,/\.tc-class-page\{/);
 assert.match(css,/\.tc-class-choices\{/);
 assert.match(css,/\.tc-class-crest\{/);
 assert.match(css,/\.tc-class-skill-list\{/);
 assert.match(css,/\.tc-class-move button\{/);
 assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
 assert.match(css,/@media\s*\(max-height:\s*650px\)/);
 assert.match(readFileSync('src/main.tsx','utf8'),/page==='skills'&&<ClassProfessionScreen/);
});

test('approved cropped game art assets are actual WebPs and the job screen references them',()=>{
 const screen=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 for(const file of ['warrior-lion-crest-v1.webp','warrior-growth-icons-v1.webp','warrior-choice-slash-v1.webp','warrior-choice-shield-v1.webp','warrior-choice-drain-v1.webp']){
  const img=readFileSync('public/assets/classes/skilltree-20261111/'+file);
  assert.ok(img.length>5000,file);
  assert.equal(img.toString('ascii',0,4),'RIFF');
  assert.equal(img.toString('ascii',8,12),'WEBP');
  assert.ok(screen.includes(file),file);
 }
 assert.doesNotMatch(screen,/portraitPath\(|showFallbackPortrait/);
 assert.match(screen,/class-library-redmoon-approved-v2\.webp/);
});

test('battle priority remains available from an overlay with five reorderable rows',()=>{
 const source=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 assert.match(source,/setBattleOpen\(true\)/);
 assert.match(source,/role="dialog"[^>]*aria-modal="true"[^>]*aria-label="전투 배치"/);
 assert.match(source,/getActiveSkills\(progress\)/);
 assert.match(source,/moveClassSkill\(/);
 assert.match(source,/defaultClassSkillOrder\(/);
 assert.match(source,/localStorage\.setItem/);
 assert.match(source,/confirmGrowth/);
 assert.match(source,/chooseClassGrowth/);
 const screen=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 assert.match(screen,/선택한 직업은 변경할 수 없습니다/);
});


test('profession opens the first unlearned growth stage, prioritizing currently claimable levels',()=>{
 const learned=[0,1,...Array(8).fill(null)];
 assert.equal(recommendedClassStage(learned,22),2,'Lv.22 with two learned skills previews next Lv.30');
 assert.equal(recommendedClassStage([0,null,...Array(8).fill(null)],22),1,'claimable Lv.20 is prioritized over future Lv.30');
 assert.equal(recommendedClassStage(Array(10).fill(null),9),0,'first level is Lv.10');
 assert.equal(recommendedClassStage(Array(10).fill(null),100),0,'earliest claimable unlearned level is prioritized');
 assert.equal(recommendedClassStage(Array(10).fill(0),100),9,'fully learned class stays on the ultimate');
});

test('readable no-scroll growth UI shows milestones, statuses, three concise cards and full selected skill details',()=>{
 const html=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const source=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 assert.equal((html.match(/aria-label="Lv\.(?:10|20|30|40|50|60|70|80|90|100) (?:스킬|패시브|특성) 선택지 확인"/g)??[]).length,10);
 assert.equal((html.match(/class="tc-class-choice-card/g)??[]).length,3);
 assert.match(html,/class="tc-class-choice-detail"/);
 assert.match(html,/data-stage-state="(?:learned|available|locked|pending)"/);
 assert.match(source,/setSelectedStage\(recommendedClassStage\(/);
 assert.match(source,/tc-class-node-state/);
 assert.match(source,/tc-class-choice-detail/);
 assert.match(source,/tc-class-choice-description/);
 assert.match(source,/CHOICE_ART\[i\]/,'reuse the three existing common pictures');
 assert.doesNotMatch(source,/choiceArtByName|skillArtworkRegistry/,'no per-skill art');
 assert.match(css,/\.tc-class-choice-art\{[^}]*flex:0 0/,'reduce decorative image height');
 assert.match(css,/\.tc-class-choice-detail\{/);
 assert.match(css,/\.tc-class-node-state\{/);
 assert.match(css,/\.tc-class-milestone-icon\{[^}]*width:clamp\(/);
 assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
});
