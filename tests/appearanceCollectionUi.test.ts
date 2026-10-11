import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState,stats} from '../src/game/engine/state';
import {APPEARANCE_SETS,collectionSetProgress,collectionSetBonusLabel,appearanceSetRarity} from '../src/game/data/appearanceSets';
import {APPEARANCES,APPEARANCE_RARITIES} from '../src/game/data/cosmetics';
import {CosmeticsScreen} from '../src/components/mobile/CoreScreens';

test('portrait collection registry reuses the 40 appearance IDs across 65 combinations, no duplicates in a set',()=>{
 assert.equal(APPEARANCE_SETS.length,65);
 const ids=new Set(APPEARANCES.map(a=>a.id));
 assert.equal(new Set(APPEARANCE_SETS.map(c=>c.id)).size,65);
 const usages=new Map<string,number>();
 for(const set of APPEARANCE_SETS){
  assert.ok(set.appearanceIds.length>=2&&set.appearanceIds.length<=5);
  assert.equal(new Set(set.appearanceIds).size,set.appearanceIds.length);
  assert.ok(APPEARANCE_RARITIES.includes(set.rarity));
  assert.ok(set.appearanceIds.every(id=>ids.has(id)&&id!=='default'));
  assert.ok(set.reward.value>0&&Number.isInteger(set.reward.value));
  assert.match(collectionSetBonusLabel(set),/\+\d+/);
  for(const id of set.appearanceIds)usages.set(id,(usages.get(id)??0)+1);
 }
 assert.equal(usages.size,40);
 assert.ok([...usages.values()].every(count=>count>1),'an appearance should help complete several collections');
});
test('first collection includes appearance 1, 3 and 13 with a fixed maximum HP +100 reward (not a percentage)',()=>{
 const first=APPEARANCE_SETS[0];
 assert.equal(first.name,'잿빛의 생존자들');
 assert.deepEqual(first.appearanceIds,[APPEARANCES[1].id,APPEARANCES[3].id,APPEARANCES[13].id]);
 assert.deepEqual(first.reward,{stat:'hp',value:100});
 assert.equal(collectionSetBonusLabel(first),'최대 HP +100');
 const p=collectionSetProgress(first,[APPEARANCES[1].id,APPEARANCES[3].id]);
 assert.deepEqual(p,{count:2,total:4,complete:false});
 assert.deepEqual(collectionSetProgress(first,[...first.appearanceIds]),{count:3,total:4,complete:false});
 assert.deepEqual(collectionSetProgress(first,[...first.appearanceIds],new Set([first.id])),{count:4,total:4,complete:true});
});
test('catalogue definition never grants unfinished collection stats or deducts currency',()=>{
 const game=initialState();
 const before=stats(game),gold=game.market.gold;
 collectionSetProgress(APPEARANCE_SETS[0],game.cosmetics.unlockedAppearanceIds);
 assert.deepEqual(stats(game),before);
 assert.equal(game.market.gold,gold);
});
test('portrait catalogue renders list and selected detail, favorites, rarity, text search, owned slots and disclosure',()=>{
 const game=initialState();
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game,setGame:()=>{}}));
 assert.match(html,/컬렉션/);
 assert.match(html,/외형 목록/);
 assert.match(html,/잿빛의 생존자들/);
 assert.match(html,/최대 HP \+100/);
 assert.match(html,/도감 효과는 미적용/);
 assert.match(html,/컬렉션 검색/);
 assert.match(html,/필요 외형·장비/);
 assert.match(html,/장비 등록/);
 assert.doesNotMatch(html,/>칭호</);
 assert.match(html,/먼지길 방랑자/);
 assert.match(html,/미보유/);
 assert.match(html,/data-set-id=/);
 const css=readFileSync(new URL('../src/components/mobile/cosmetics-catalog.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-cosmetics-catalog\{[^}]*height:100%/);
 assert.match(css,/\.tc-collection-list\{[^}]*overflow-y:auto/);
 assert.match(css,/\.tc-collection-detail\{[^}]*min-height:0/);
});

 test('collection equipment tokens reuse inventory artwork for each required kind and grade',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 const tokens=[...html.matchAll(/<(?:span|button)[^>]*class="tc-collection-gear-token[^" ]*(?: [^"]*)?"[^>]*>(.*?)<\/(?:span|button)>/g)];
 assert.equal(tokens.length,APPEARANCE_SETS.length+1);
 for(const [index,token] of tokens.entries()){
  const requirement=APPEARANCE_SETS[index<APPEARANCE_SETS.length?index:0].equipment;
  assert.ok(token[1].includes(`assets/ui/equipment/${requirement.kind}.png`));
  assert.ok(token[1].includes(`tc-equipment-grade-${requirement.grade}`));
 }
});

test('appearance list shows stats and related collection links with ownership filters',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance'}));
 assert.ok(html.includes('외형 보유 필터'));
 assert.ok(html.includes('관련 컬렉션'));
 assert.ok(html.includes('(예정)'));
 assert.ok(html.includes('착용 중'));
 assert.ok(!html.includes('능력 사용 가능'));
});
