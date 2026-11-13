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
  if(file==='warrior-lion-crest-v1.webp')assert.ok(screen.includes(file),file);
 }
 assert.match(screen,/warrior-growth-icons-aligned-v2\.svg/,'new aligned atlas must be used');
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
 assert.match(source,/RUNE_ART/,'reuse exactly three shared ancient rune pictures for every class');
 assert.doesNotMatch(source,/choiceArtByName|skillArtworkRegistry/,'no per-skill art');
 assert.match(css,/\.tc-class-choice-art\{[^}]*flex:0 0/,'reduce decorative image height');
 assert.match(css,/\.tc-class-choice-detail\{/);
 assert.match(css,/\.tc-class-node-state\{/);
 assert.match(css,/\.tc-class-milestone-icon\{[^}]*width:clamp\(/);
 assert.doesNotMatch(css,/overflow-y:\s*(auto|scroll)/);
});


test('class tabs are text only and circular growth sprites crop the artwork lettering',()=>{
 const screen=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 for(const name of ['전사','마법사','궁수']){
  const tab=screen.match(new RegExp('<button[^>]*class="tc-class-tab[^"]*"[^>]*>([\\s\\S]*?)<\\/button>','g'))??[];
  assert.equal(tab.length,3,'three profession tabs remain');
  assert.ok(tab.some(markup=>markup.includes('<span>'+name+'</span>')),name);
 }
 const buttons=screen.match(/<button[^>]*class="tc-class-tab[^"]*"[^>]*>[\s\S]*?<\/button>/g)??[];
 assert.equal(buttons.length,3);
 for(const button of buttons)assert.doesNotMatch(button,/<svg|tc-glyph/,'profession tabs must have no icon');
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 assert.match(component,/warrior-growth-icons-aligned-v2\.svg/);
 assert.match(component,/backgroundSize:\s*'500% 200%'/,'normalized atlas tiles align exactly with grid cells');
 assert.doesNotMatch(component,/650% 260%|6\.25%|87\.5%/,'remove imprecise zoom crop');
 assert.doesNotMatch(component,/<Glyph name=\{glyphFor\(id\)\}/,'no tab icon in source');
 assert.match(component,/tc-class-node-sprite/);
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.doesNotMatch(css,/\.tc-class-tab \.tc-glyph/,'old icon style removed');
 assert.match(css,/\.tc-class-node-kind/,'level type labels remain outside the round artwork');
});


test('normalized growth atlas contains ten centered source crops with no embedded level labels',()=>{
 const atlas=readFileSync('public/assets/classes/skilltree-20261111/warrior-growth-icons-aligned-v2.svg','utf8');
 assert.match(atlas,/viewBox="0 0 500 200"/);
 assert.equal((atlas.match(/<svg x="\d+" y="\d+" width="100" height="100"/g)??[]).length,10);
 assert.match(atlas,/data:image\/webp;base64,/,'same shared picture atlas, embedded for offline APK use');
 for(const y of [0,100])for(const x of [0,100,200,300,400]){
  assert.ok(atlas.includes('<svg x="'+x+'" y="'+y+'" width="100" height="100"'),x+','+y);
 }
 for(const text of ['액티브','패시브','특성','궁극기','Lv.10','Lv.100'])assert.ok(!atlas.includes(text),'no old text baked into cropped circles: '+text);
 assert.match(atlas,/<use href="#source"\/>/);
});


test('three rune images remain undistorted and individually accessible for every profession',()=>{
 const original=readFileSync('public/assets/classes/skilltree-20261111/choice-runes-gold-violet-crimson-v1.webp');
 assert.ok(original.length>12000,'original artwork must remain available');
 const names=['gold','violet','crimson'];
 for(const [i,name] of names.entries()){
  const image=readFileSync('public/assets/classes/skilltree-20261111/choice-rune-'+name+'-v2.webp','utf8');
  assert.match(image,/viewBox="0 0 320 144"/,'each rune keeps its 320 by 144 source ratio');
  assert.match(image,new RegExp('<image x="'+(-i*320)+'" y="0" width="960" height="144"'),'crop source atlas without scaling or stretching');
  assert.match(image,/href="data:image\/webp;base64,UklG/,'asset embeds original WebP and works in APK without external requests');
  const updated=readFileSync('public/assets/classes/skilltree-20261111/choice-rune-'+name+'-v2.webp');
  assert.ok(updated.length>1000,'optimized individual rune must be a real image');
  assert.equal(updated.toString('ascii',0,4),'RIFF');
  assert.equal(updated.toString('ascii',8,12),'WEBP');
 }
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 for(const name of names)assert.ok(component.includes('choice-rune-'+name+'-v2.webp'),name+' sprite must be independently addressable');
 assert.doesNotMatch(component,/backgroundSize:'300% 100%'|backgroundPosition:\(i\*50\)/,'no bitmap stretching');
 assert.match(component,/<img src=\{assetUrl\(RUNE_ART\[i\]\)\} alt=""\/>/,'images must be rendered as contained images');
 const html=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 for(const name of names)assert.ok(html.includes('choice-rune-'+name+'-v2.webp'),name+' rendered');
 assert.equal((html.match(/class="tc-class-choice-art"/g)??[]).length,3);
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 assert.match(css.split('/* approved rune artwork update: 2026-11-13 */')[1],/\.tc-class-choice-art img\{[^}]*object-fit:contain/,'final rune image display keeps the full square composition');
 assert.doesNotMatch(component,/<span className="tc-class-choice-art"[^>]*style=/,'do not transform rune atlases through inline background sizing');
});

test('profession mobile layout reserves separate nonoverlapping rows for header, tabs, actions and footer',()=>{
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const fix=css.split('/* class-screen overlap prevention: 2026-11-12 */')[1];
 assert.ok(fix,'mobile overlap prevention overrides are required');
 assert.match(fix,/\.tc-class-page\{[^}]*grid-template-rows:\s*44px 44px minmax\(64px/,'header and class tabs must each have full touch-target height');
 assert.match(fix,/\.tc-class-back,\.tc-class-home\{[^}]*height:44px/,'navigation buttons must remain inside the header row');
 assert.match(fix,/\.tc-class-tab\{[^}]*height:100%;min-height:0/,'class tabs must stay in their allocated row');
 assert.match(fix,/\.tc-class-feature-tools button\{[^}]*min-height:44px;height:44px/,'battle placement action must fit inside the featured row');
 assert.match(fix,/\.tc-class-footer\{[^}]*grid-template-rows:44px 12px/,'confirmation button and finality notice must have separate rows');
 assert.match(fix,/\.tc-class-node-state\{display:none/,'state labels must not cover level labels in the tight 5-column skill grid');
});


test('compact profession heading gives lower skill panels space without shrinking touch targets',()=>{
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const source=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const compact=css.split('/* class-screen compact distribution: 2026-11-13 */')[1];
 assert.ok(compact,'compact allocation rules must be present');
 assert.match(compact,/\.tc-class-page\{[^}]*grid-template-rows:44px 44px 48px minmax\(130px,1\.2fr\) minmax\(0,3\.8fr\) 46px 0/);
 assert.match(compact,/\.tc-class-featured\{[^}]*grid-template-rows:18px 12px 11px/);
 assert.match(compact,/\.tc-class-feature-tools button\{[^}]*min-height:44px;height:44px/);
 assert.match(compact,/\.tc-class-feature-progress\{/,'progress moves into the text column, not above the battle button');
 assert.match(compact,/\.tc-class-footer p,\.tc-class-status\{display:none/,'secondary notices should not waste play area');
 assert.match(source,/<p>10레벨마다[^<]+<\/p>\s*<span className="tc-class-feature-progress">/);
 const buttons=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 assert.ok(buttons.includes('tc-class-feature-progress'));
 assert.ok(buttons.includes('tc-class-feature-tools'));
});


test('profession top title and navigation row are removed and growth grid takes its height',()=>{
 const html=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const final=css.split('/* profession header removed: 2026-11-13 */')[1];
 assert.ok(final,'new headerless layout rules are required');
 assert.doesNotMatch(html,/tc-class-header|tc-class-brand|tc-class-back|tc-class-home/,'no duplicate title or navigation in class page');
 assert.doesNotMatch(html,/<h1>직업<\/h1>|<small>탑의 기록<\/small>/);
 assert.match(html,/<nav class="tc-class-tabs"/,'three profession tabs remain as first row');
 assert.equal((html.match(/class="tc-class-tab tc-feel-press/g)??[]).length,3);
 assert.match(html,/전사 스킬트리/);
 assert.match(final,/\.tc-class-page\{[^}]*grid-template-rows:34px 48px minmax\(130px,1\.2fr\) minmax\(0,3\.8fr\) 46px 0/);
 assert.match(final,/\.tc-class-tabs\{grid-row:1/);
 assert.match(final,/\.tc-class-featured\{grid-row:2/);
 assert.match(final,/\.tc-class-growth\.tc-class-path\{grid-row:3/);
 assert.match(final,/\.tc-class-choices\{grid-row:4/);
 assert.match(final,/@media\(max-height:530px\)\{[^}]*\.tc-class-page\{[^}]*grid-template-rows:34px 44px minmax\(100px,1\.2fr\)/);
});


test('choice rune artwork returns to original 38% height while card caption is compact',()=>{
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const fix=css.split('/* restore rune artwork proportions: 2026-11-13 */')[1];
 assert.ok(fix,'rune proportions must be restored after the compact layout overrides');
 assert.match(fix,/\.tc-class-choice-art\{flex:0 0 38%/,'restore original rune image fraction');
 assert.match(fix,/\.tc-class-choice-description\{flex:0 1 auto;max-height:/,'text may not consume all the available card height');
 assert.match(fix,/\.tc-class-choice-card strong\{[^}]*padding:1px 0/,'skill names should use compact padding');
 assert.match(fix,/\.tc-class-choice-card small\{[^}]*-webkit-line-clamp:2/,'limit descriptions to two short lines');
 assert.match(fix,/@media\(max-height:530px\)\{[^}]*\.tc-class-choice-art\{flex:0 0 38%/,'short phones must not reduce runes to 25% again');
 assert.match(fix,/@media\(max-height:650px\)\{[^}]*\.tc-class-choice-art\{flex:0 0 38%/,'small-height phones must not reduce runes to 29% again');
 const screen=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 assert.match(screen,/tc-class-choice-detail/,'the full ability description stays accessible below the cards');
});


test('rune choice cards use spare height for enlarged undistorted artwork and centered captions',()=>{
 const component=readFileSync('src/components/classes/ClassProfessionScreen.tsx','utf8');
 const css=readFileSync('src/components/classes/class-profession.css','utf8');
 const fix=css.split('/* fill unused rune-card space: 2026-11-13 */')[1];
 assert.ok(fix,'rune card space distribution rules must exist');
 assert.match(component,/<span className="tc-class-choice-caption">[\s\S]*?<strong>\{choice.name\}<\/strong>[\s\S]*?<small className="tc-class-choice-description">/,'skill name and description should be grouped into one centered caption');
 assert.match(fix,/\.tc-class-choice-art\{[^}]*flex:0 0 65%/,'use more of each card for rune artwork');
 assert.match(fix,/\.tc-class-choice-art img\{[^}]*object-fit:cover/,'cover area proportionally, cropping edges rather than stretching');
 assert.match(fix,/\.tc-class-choice-caption\{[^}]*flex:1 1 0;[^}]*justify-content:center/,'center the remaining text vertically instead of leaving a blank lower half');
 assert.match(fix,/@media\(max-height:530px\)\{[^}]*\.tc-class-choice-art\{flex:0 0 58%/,'short phones must leave room for labels');
 const html=renderToStaticMarkup(React.createElement(ClassProfessionScreen,{userId:null,lease:null,onHome:()=>{}}));
 assert.equal((html.match(/class="tc-class-choice-caption"/g)??[]).length,3);
 for(const name of ['choice-rune-gold-v2.webp','choice-rune-violet-v2.webp','choice-rune-crimson-v2.webp'])assert.ok(html.includes(name),name);
 assert.doesNotMatch(component,/backgroundSize:'300% 100%'/);
});
