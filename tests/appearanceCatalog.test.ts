import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState,stats} from '../src/game/engine/state';
import {registerAppearance} from '../src/game/engine/cosmetics';
import {playerGraphicFor} from '../src/game/data/graphics';
import {CosmeticsScreen} from '../src/components/mobile/CoreScreens';
import {
 APPEARANCES,APPEARANCE_RARITIES,APPEARANCE_COLLECTIONS,APPEARANCE_PROPOSED_PERCENT,
 DEFAULT_APPEARANCE_ID,appearanceById,appearanceBonusLabel,
 appearanceCollectionById,appearanceCollectionProgress,validateAppearanceCatalog
} from '../src/game/data/cosmetics';

test('cosmetic archive has forty collectible appearances plus the original starter',()=>{
 assert.equal(APPEARANCES.length,41);
 assert.equal(APPEARANCES.filter(x=>x.rarity).length,40);
 assert.equal(APPEARANCE_COLLECTIONS.length,8);
 assert.deepEqual(APPEARANCE_RARITIES,['C','B','A','SR','SSR']);
 assert.ok(validateAppearanceCatalog());
 assert.equal(new Set(APPEARANCES.map(x=>x.id)).size,41);
 assert.equal(APPEARANCES[0].id,DEFAULT_APPEARANCE_ID);
});
test('each themed collection contains five distinct C/B/A/SR/SSR appearances',()=>{
 for(const collection of APPEARANCE_COLLECTIONS){
  assert.equal(collection.appearanceIds.length,5);
  assert.deepEqual(collection.appearanceIds.map(id=>appearanceById(id)?.rarity),APPEARANCE_RARITIES);
  for(const id of collection.appearanceIds)assert.equal(appearanceById(id)?.collectionId,collection.id);
  assert.equal(appearanceCollectionById(collection.id),collection);
 }
 for(const rarity of APPEARANCE_RARITIES){
  assert.equal(APPEARANCES.filter(x=>x.rarity===rarity).length,8);
  assert.equal(typeof APPEARANCE_PROPOSED_PERCENT[rarity],'number');
 }
});
test('cosmetic catalog stores proposed bonuses only; they do not change player combat stats',()=>{
 const s=initialState();const before=stats(s);
 assert.deepEqual(s.cosmetics.unlockedAppearanceIds,['default']);
 for(const appearance of APPEARANCES.filter(x=>x.rarity)){
  assert.equal(appearance.artStatus,'pending');
  assert.equal(appearance.imagePath,undefined,'pending art must not borrow a job illustration');
  assert.equal(appearance.sourceLabel,'외형 뽑기 · 준비중');
  assert.equal(appearance.tradeable,false);
  assert.match(appearanceBonusLabel(appearance.proposedBonus!),/ \+\d+%$/);
  assert.equal(registerAppearance(s,appearance.id).cosmetics.unlockedAppearanceIds.length,1,'catalog must not auto-unlock');
 }
 assert.deepEqual(stats(s),before);
 assert.equal(playerGraphicFor(APPEARANCES[1].id).image.idle,'assets/player/default.png');
});
test('collection progression is deduplicated and complete only when five members are owned',()=>{
 const collection=APPEARANCE_COLLECTIONS[0];
 assert.deepEqual(appearanceCollectionProgress(collection,['default']),{count:0,total:5,complete:false});
 assert.deepEqual(appearanceCollectionProgress(collection,[collection.appearanceIds[0],collection.appearanceIds[0]]),{count:1,total:5,complete:false});
 assert.deepEqual(appearanceCollectionProgress(collection,[...collection.appearanceIds]),{count:5,total:5,complete:true});
});
test('cosmetic menu displays collection count, planned-only bonus disclosure and unavailable draw',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 assert.match(html,/외형 컬렉션/);
 assert.match(html,/0 \/ 65/);
 assert.match(html,/도감 효과는 미적용/);
 assert.match(html,/외형 목록/);
 assert.match(html,/컬렉션/);
 assert.match(html,/미보유/);
 assert.match(html,/먼지길 방랑자/);
 const css=readFileSync(new URL('../src/components/mobile/cosmetics-catalog.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-cosmetics-catalog\{[^}]*grid-template-rows:56px 34px 34px 35px/);
 assert.match(css,/\.tc-cosmetics-items\{[^}]*grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);
});
