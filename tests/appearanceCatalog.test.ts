import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,existsSync} from 'node:fs';
import {APPEARANCE_SETS,validateAppearanceSets} from '../src/game/data/appearanceSets';
import {initialState,stats} from '../src/game/engine/state';
import {registerAppearance} from '../src/game/engine/cosmetics';
import {playerGraphicFor} from '../src/game/data/graphics';
import {CosmeticsScreen} from '../src/components/mobile/CoreScreens';
import {
 APPEARANCES,APPEARANCE_RARITIES,APPEARANCE_COLLECTIONS,APPEARANCE_PROPOSED_PERCENT,
 DEFAULT_APPEARANCE_ID,appearanceById,appearanceBonusLabel,
 appearanceCollectionById,appearanceCollectionProgress,validateAppearanceCatalog
} from '../src/game/data/cosmetics';

test('cosmetic archive contains only illustrated standalone appearances',()=>{
 assert.equal(APPEARANCES.filter(x=>x.collectionId).length,0);
 assert.equal(APPEARANCES.filter(x=>x.rarity).length,APPEARANCES.length-1);
 assert.ok(APPEARANCES.filter(x=>x.rarity).every(x=>APPEARANCE_RARITIES.includes(x.rarity!)));
 assert.equal(APPEARANCE_COLLECTIONS.length,0);
 assert.deepEqual(APPEARANCE_RARITIES,['C','B','A','SR','SSR']);
 assert.ok(validateAppearanceCatalog());
 assert.equal(new Set(APPEARANCES.map(x=>x.id)).size,APPEARANCES.length);
 assert.equal(APPEARANCES[0].id,DEFAULT_APPEARANCE_ID);
});
test('default adventurer artwork is a valid existing WebP asset',()=>{
 const starter=appearanceById(DEFAULT_APPEARANCE_ID);
 assert.equal(starter?.imagePath,'assets/characters/appearances/default-d749c30acd33.webp');
 const file=new URL('../public/'+starter!.imagePath,import.meta.url);
 assert.equal(existsSync(file),true);
 const bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
 assert.equal(playerGraphicFor(DEFAULT_APPEARANCE_ID).image.idle,starter?.imagePath);
});
test('each themed collection contains five distinct C/B/A/SR/SSR appearances',()=>{
 for(const collection of APPEARANCE_COLLECTIONS){
  assert.equal(collection.appearanceIds.length,5);
  assert.deepEqual(collection.appearanceIds.map(id=>appearanceById(id)?.rarity),APPEARANCE_RARITIES);
  for(const id of collection.appearanceIds)assert.equal(appearanceById(id)?.collectionId,collection.id);
  assert.equal(appearanceCollectionById(collection.id),collection);
 }
 for(const rarity of APPEARANCE_RARITIES){
  assert.equal(APPEARANCES.filter(x=>x.collectionId&&x.rarity===rarity).length,0);
  assert.equal(typeof APPEARANCE_PROPOSED_PERCENT[rarity],'number');
 }
});
test('unillustrated Arquebus is absent from the active catalog',()=>{assert.equal(appearanceById('arquebus'),undefined);});
test('Corsair appears as a B-grade appearance with its existing illustrated game asset',()=>{
 const pirate=appearanceById('corsair');
 assert.equal(pirate?.name,'코르세어');
 assert.equal(pirate?.rarity,'B');
 assert.equal(pirate?.collectionId,undefined);
 assert.equal(pirate?.artStatus,'ready');
 assert.match(pirate?.imagePath??'',/^assets\/characters\/appearances\/corsair-[a-f0-9]{12}\.webp$/);
 assert.equal(pirate?.proposedBonus?.stat,'attack');
 assert.equal(pirate?.proposedBonus?.percent,APPEARANCE_PROPOSED_PERCENT.B);
 assert.equal(pirate?.tradeable,false);
 assert.ok(existsSync(new URL('../public/'+pirate!.imagePath,import.meta.url)));
 assert.equal(playerGraphicFor('corsair').image.idle,pirate?.imagePath);
 assert.ok(validateAppearanceCatalog());
});
test('cosmetic catalog stores proposed bonuses only; they do not change player combat stats',()=>{
 const s=initialState();const before=stats(s);
 assert.deepEqual(s.cosmetics.unlockedAppearanceIds,['default']);
 for(const appearance of APPEARANCES.filter(x=>x.rarity)){
  if(appearance.artStatus==='ready'){
   assert.ok(appearance.imagePath);
   assert.ok(existsSync(new URL('../public/'+appearance.imagePath,import.meta.url)));
  }else{
   assert.equal(appearance.artStatus,'pending');
   assert.equal(appearance.imagePath,undefined,'pending art must not borrow a job illustration');
  }
  assert.equal(appearance.sourceLabel,'외형 뽑기 · 준비중');
  assert.equal(appearance.tradeable,false);
  assert.match(appearanceBonusLabel(appearance.proposedBonus!),/ \+\d+%$/);
  assert.equal(registerAppearance(s,appearance.id).cosmetics.unlockedAppearanceIds.length,1,'catalog must not auto-unlock');
 }
 assert.deepEqual(stats(s),before);
 assert.equal(playerGraphicFor(APPEARANCES[1].id).image.idle,APPEARANCES[1].imagePath);
});
test('collection progression is deduplicated and complete only when five members are owned',()=>{
 const collection={id:'fixture',name:'테스트',description:'진행도 검증',appearanceIds:APPEARANCES.slice(1,6).map(a=>a.id),proposedCompletionBonus:{stat:'hp' as const,percent:1}};
 assert.deepEqual(appearanceCollectionProgress(collection,['default']),{count:0,total:5,complete:false});
 assert.deepEqual(appearanceCollectionProgress(collection,[collection.appearanceIds[0],collection.appearanceIds[0]]),{count:1,total:5,complete:false});
 assert.deepEqual(appearanceCollectionProgress(collection,[...collection.appearanceIds]),{count:5,total:5,complete:true});
});
test('cosmetic menu displays collection count, planned-only bonus disclosure and unavailable draw',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 assert.match(html,/컬렉션/);
 assert.doesNotMatch(html,/0 \/ 65/,'redundant progress header must be removed');
 assert.doesNotMatch(html,/tc-screen-head|tc-collection-top/);
 assert.match(html,/등록된 컬렉션이 없습니다/);
 assert.match(html,/외형 목록/);
 assert.match(html,/컬렉션/);

 assert.doesNotMatch(html,/먼지길 방랑자/);
 const css=readFileSync(new URL('../src/components/mobile/cosmetics-catalog.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-cosmetics-catalog\{[^}]*grid-template-rows:56px 34px 34px 35px/);
 assert.match(css,/\.tc-cosmetics-items\{[^}]*grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
});

test('only illustrated appearances and default remain in the active catalog',()=>{
 assert.equal(new Set(APPEARANCES.map(a=>a.id)).size,APPEARANCES.length);
 assert.ok(APPEARANCES.every(a=>a.id==='default'||a.artStatus==='ready'&&!!a.imagePath));
 assert.ok(!APPEARANCES.some(a=>['arquebus','dust_pathfinder'].includes(a.id)));
 assert.ok(validateAppearanceCatalog());
});
test('removed appearances leave no impossible active collections',()=>{
 assert.equal(APPEARANCE_COLLECTIONS.length,0);assert.equal(APPEARANCE_SETS.length,0);
 assert.ok(validateAppearanceSets());
});
test('both catalog tabs render safely with no active collections',()=>{
 for(const initialTab of ['collection','appearance'] as const){
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab}));
 assert.doesNotMatch(html,/먼지길 방랑자|아르케부스|65개 외형/);
 if(initialTab==='collection'){assert.match(html,/등록된 컬렉션이 없습니다/);assert.doesNotMatch(html,/장비 1개 소모하여 영구 등록/);}
 else assert.match(html,/코르세어/);
 }
});


test('all 26 C-grade appearance descriptions use authored single-line Tower lore',()=>{
 const cGrade=APPEARANCES.filter(a=>a.rarity==='C');
 assert.equal(cGrade.length,26);
 assert.equal(new Set(cGrade.map(a=>a.description)).size,26);
 for(const a of cGrade){
  assert.ok(a.description.length>=24,a.name+' description must have narrative detail');
  assert.doesNotMatch(a.description,/\r|\n/,a.name+' must fit on a single line');
  assert.match(a.description,/\.$/,a.name+' must be a complete sentence');
 }
 assert.equal(appearanceById('default')?.description,'탑을 오르기 시작한 모험가의 기본 전신 외형');
 assert.equal(appearanceById('slime')?.description,'수많은 것을 삼켰지만 자신의 것이라 부를 것은 아무것도 없는 존재.');
 assert.equal(appearanceById('faceless_one')?.description,'모든 기록에서 얼굴과 이름이 지워져 존재조차 증명할 수 없게 된 자.');
 assert.equal(appearanceById('court_jester')?.description,'왕국이 멸망하던 날에도 왕의 명령에 따라 홀로 웃고 있던 광대.');
});


test('all 13 B-grade appearances retain the approved one-line lore descriptions',()=>{
 const expected:Record<string,string>={
  "corsair": "수많은 보물을 약탈했지만 마지막 항해에서 자신의 배가 세상의 모든 해도에서 지워졌음을 알게 된 해적.",
  "teddy": "전쟁터의 아이들에게 곰 인형을 나눠주던 방랑자, 마지막 인형을 건넨 날 자신의 이름마저 잊어버렸다.",
  "plague_doctor": "수천 명의 목숨을 구했지만 자신이 치료한 환자들이 모두 같은 날 죽음을 맞이한 이유를 알지 못한 의사.",
  "knight": "평생 왕에게 충성을 맹세했지만 마지막으로 받은 명령은 자신의 왕을 처형하라는 것이었다.",
  "summoner": "죽은 벗의 영혼을 다시 불러내는 데 성공했지만 돌아온 존재는 그를 전혀 기억하지 못했다.",
  "cultist": "메아쿨파의 외경을 진실이라 믿고 금서를 탐독하다 마침내 자신의 이름이 기록된 장을 발견한 신도.",
  "celestial_archer": "신의 명령에 따라 단 한 번도 빗나가지 않는 화살을 쏘았지만 마지막 표적은 자신이 섬기던 천사였다.",
  "assault_gunner": "적의 성벽을 무너뜨리는 데 평생을 바쳤지만 마지막 포격으로 자신이 지켜야 할 도시를 파괴한 병사.",
  "alchemist": "죽음을 되돌리는 영약을 완성했지만 그 대가로 자신의 남은 수명을 모두 잃어버린 연금술사.",
  "blacksmith": "수많은 영웅의 무기를 만들었지만 자신이 벼린 검으로 왕이 살해된 뒤 모든 기록에서 이름이 지워진 장인.",
  "contract_mercenary": "어떤 의뢰도 거절하지 않았지만 마지막 계약서에는 자신의 목숨을 대가로 바친다는 조항이 적혀 있었다.",
  "wandering_preacher": "죄를 고백하면 누구나 구원받을 수 있다고 설교했지만 자신의 죄를 고백한 날부터 신의 목소리가 들리지 않았다.",
  "shepherd": "잃어버린 양 한 마리를 찾아 탑에 들어섰지만 수십 년이 지난 지금도 그 양이 누구의 것이었는지 기억하지 못한다."
};
 const bGrade=APPEARANCES.filter(a=>a.rarity==='B');
 assert.equal(bGrade.length,13);
 assert.deepEqual(bGrade.map(a=>a.id).sort(),Object.keys(expected).sort());
 for(const appearance of bGrade){
  assert.equal(appearance.description,expected[appearance.id],appearance.id+' lore must match approved copy');
  assert.doesNotMatch(appearance.description,/\r|\n/,appearance.id+' lore must be one line');
 }
});
