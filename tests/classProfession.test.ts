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
 assert.match(css,/overflow:\s*hidden/); // large-screen layout remains fixed; short-screen fallback may scroll
 assert.match(css,/@media\s*\(max-width:\s*420px\)/);
 const main=readFileSync('src/main.tsx','utf8');
 assert.match(main,/page==='skills'&&<ClassProfessionScreen/);
});

test('class codex library image assets show stone arches, shelves, candles, red moon and ornamental frames without altering gameplay',()=>{
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const background=readFileSync('public/assets/backgrounds/classes/class-library-v1.svg','utf8');
 const frame=readFileSync('public/assets/backgrounds/classes/class-ornament-frame-v1.svg','utf8');
 assert.match(component,/assets\/backgrounds\/classes\/class-library-redmoon-approved-v2\.webp/);
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

test('profession illustrations use three independent decodable image assets instead of a CSS atlas',()=>{
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const atlas=readFileSync('public/assets/characters/classes/class-portraits-atlas-v1.webp');
 assert.ok(atlas.length>15000);
 for(const [name,x] of [['warrior',0],['mage',-224],['archer',-448]]){
  const svg=readFileSync('public/assets/characters/classes/'+name+'-portrait-v2.svg','utf8');
  assert.match(svg,/<svg[^>]*viewBox="0 0 224 299"/);
  assert.match(svg,new RegExp('<image x="'+x+'" y="0" width="672" height="299" href="data:image/webp;base64,'));
  const data=svg.match(/data:image\/webp;base64,([^"]+)"/);
  assert.ok(data);
  assert.deepEqual(Buffer.from(data[1],'base64'),atlas);
  assert.match(component,/\$\{id\}-portrait-v2\.svg/);
 }
 assert.match(component,/<img className="tc-class-portrait-art"/);
 assert.match(component,/<img className="tc-class-feature-illustration"/);
 assert.match(component,/onError=\{/);
 assert.match(css,/img\.tc-class-portrait-art\s*\{/);
 assert.match(css,/img\.tc-class-feature-illustration\s*\{/);
 assert.doesNotMatch(css,/background-image:var\(--tc-class-illustration-atlas\)/);
});

test('class screen shows all five skill slots, ten milestones and the save or class-confirm action without scrolling',()=>{
 const screen=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 assert.equal((screen.match(/class="tc-class-skill-row(?: vacant)?"/g)??[]).length,5);
 assert.equal((screen.match(/aria-label="Lv\.(?:10|20|30|40|50|60|70|80|90|100) (?:스킬|패시브|특성) 선택지 확인"/g)??[]).length,10);
 assert.match(screen,/class="tc-class-footer"[\s\S]*?이 직업으로 시작[\s\S]*?class="tc-class-status"/);
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.doesNotMatch(css,/\.tc-class-content\s*\{[^}]*overflow-y:\s*(auto|scroll)/);
 assert.match(css,/\.tc-class-content\s*\{[^}]*overflow:\s*hidden/);
 assert.match(css,/\.tc-class-skill-list\{[^}]*grid-template-rows:\s*repeat\(5/);
 assert.match(css,/\.tc-class-move button\{[^}]*height:44px/);
 assert.match(css,/@media\s*\(max-height:\s*740px\)/);
 assert.match(css,/@media\s*\(max-height:\s*660px\)/);
 assert.match(css,/\.tc-class-featured\{\s*display:none/);
 assert.match(css,/\.tc-class-actions \.tc-class-choose\{[^}]*min-height:44px/);
 assert.match(css,/\.tc-class-page\{[^}]*overflow:hidden/);
});
