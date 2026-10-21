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
