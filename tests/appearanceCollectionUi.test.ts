import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {initialState,stats} from '../src/game/engine/state';
import {APPEARANCE_SETS,collectionSetProgress,collectionSetBonusLabel,appearanceSetRarity,type AppearanceSet} from '../src/game/data/appearanceSets';
import {APPEARANCES,APPEARANCE_RARITIES} from '../src/game/data/cosmetics';
import {CosmeticsScreen} from '../src/components/mobile/CoreScreens';



// Test-only illustrated combination exercises the full collection UI independently of live content.
const fixture:AppearanceSet={id:'fixture',name:'잿빛의 생존자들',description:'UI 검증 전용',appearanceIds:['mechanic','corsair','valkyrie'],rarity:'A',equipment:{kind:'return_corps_plate_armor',grade:'rare'},reward:{stat:'hp',value:100}};
beforeEach(()=>{(APPEARANCE_SETS as AppearanceSet[]).push(fixture);});
afterEach(()=>{(APPEARANCE_SETS as AppearanceSet[]).splice(0);});
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
 assert.match(html,/메카닉/);
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
 assert.ok(html.includes('조각'));
 assert.ok(html.includes('착용 효과'));
 assert.ok(html.includes('착용한 외형 1개만 강화 효과 적용'));
 assert.ok(html.includes('착용 중'));
 assert.ok(!html.includes('능력 사용 가능'));
});

test('appearance list uses portrait-sized art and keeps supplied colors when unowned',()=>{
 const css=readFileSync(new URL('../src/components/mobile/cosmetics-catalog.css',import.meta.url),'utf8');
 assert.match(css,/listing-mode \.tc-cosmetics-icon\{[^}]*width:80px[^}]*height:108px/);
 assert.match(css,/listing-mode \.tc-cosmetics-icon img\{[^}]*object-fit:cover/);
 assert.match(css,/\.tc-cosmetics-icon\.has-art\{[^}]*filter:none[^}]*opacity:1/);
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 assert.match(source,/artReady\?' has-art':''/);
});

test('metal collection exposes rarity independently from ownership and selected collection',()=>{
 const game=initialState();game.cosmetics.unlockedAppearanceIds.push('mechanic');
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game,setGame:()=>{}}));
 assert.match(html,/tc-iron-catalog/);
 for(const rarity of APPEARANCE_RARITIES)assert.match(html,new RegExp('data-rarity="'+rarity+'"'));
 assert.match(html,/tc-collection-token is-owned rarity-C[^>]*data-rarity="C"/);
 assert.match(html,/tc-collection-token is-missing rarity-B[^>]*data-rarity="B"/);
 assert.match(html,/aria-current="true"/);
 assert.match(html,/자동 등록/);
});

test('appearance cards expose ownership and equipped state without changing available actions',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance'}));
 assert.match(html,/data-owned="true" data-equipped="true"/);
 assert.match(html,/data-owned="false" data-equipped="false"/);
 assert.match(html,/class="tc-appearance-state">착용 중<\/span>/);
 assert.match(html,/class="tc-appearance-state">미해금<\/span>/);
 assert.match(html,/disabled=""[^>]*>미보유<\/button>/);
});


test('collection has no duplicate screen header or archive title',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 assert.doesNotMatch(html,/APPEARANCE COLLECTION/);
 assert.doesNotMatch(html,/tc-screen-head/);
 assert.doesNotMatch(html,/tc-collection-top/);
 assert.match(html,/role="tablist"[^>]*aria-label="컬렉션 보기"/);
 const appearance=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance'}));
 assert.doesNotMatch(appearance,/tc-screen-head|tc-collection-top/);
 assert.match(appearance,/외형 목록/);
});

test('compact collection shell keeps detail and actions visible without whole-page scrolling',()=>{
 const css=readFileSync(new URL('../src/components/mobile/iron-catalog.css',import.meta.url),'utf8');
 const catalog=css.match(/\.tc-iron-catalog-screen \.tc-cosmetics-catalog:not\(\.listing-mode\)\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(catalog,/display:\s*flex/);
 assert.match(catalog,/flex-direction:\s*column/);
 assert.match(catalog,/overflow-y:\s*hidden/,'do not scroll the entire collection screen');
 const list=css.match(/\.tc-iron-catalog-screen \.tc-cosmetics-catalog:not\(\.listing-mode\)>\.tc-collection-list\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(list,/flex:\s*1 1 auto/,'collection list must consume the remaining viewport');
 assert.match(list,/overflow-y:\s*auto/,'only the collection records scroll');
 const detail=css.match(/\.tc-iron-catalog-screen \.tc-cosmetics-catalog:not\(\.listing-mode\)>\.tc-collection-detail\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(detail,/display:\s*flex/);
 assert.match(detail,/flex-direction:\s*column/);
 assert.match(detail,/height:\s*auto/);
 const appearance=css.match(/\.tc-iron-catalog-screen \.tc-cosmetics-catalog\.listing-mode\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(appearance,/overflow-y:\s*hidden/,'appearance pagination stays in the viewport');
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 assert.ok(html.indexOf('tc-collection-required')<html.indexOf('tc-collection-detail-actions'));
});


test('hidden collection header does not collapse its screen body to the shared 43px title row',()=>{
 const base=readFileSync(new URL('../src/mobile-game.css',import.meta.url),'utf8');
 const skin=readFileSync(new URL('../src/components/mobile/iron-catalog.css',import.meta.url),'utf8');
 assert.match(base,/\.tc-screen\{[^}]*grid-template-rows:43px minmax\(0,1fr\)/);
 // Compound selector outranks the shared .tc-screen rule regardless of CSS import order.
 assert.match(skin,/\.tc-screen\.tc-iron-catalog-screen\s*\{[^}]*grid-template-rows:\s*minmax\(0,1fr\)/);
 const collection=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 const appearances=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance',onSummon:()=>{}}));
 for(const markup of [collection,appearances]){
  assert.match(markup,/<section class="tc-screen tc-cosmetics-catalog-screen tc-iron-catalog-screen"[^>]*><div class="tc-screen-body">/);
  assert.doesNotMatch(markup,/class="tc-screen-head"/);
 }
 assert.match(collection,/class="tc-collection-list"/);
 assert.match(appearances,/class="tc-cosmetics-meta"/);
 assert.match(appearances,/class="tc-cosmetics-items"/);
 assert.match(appearances,/외형 소환/);
});


test('collection keeps the list full-height and opens its details only as an accessible bottom sheet',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{}}));
 const css=readFileSync(new URL('../src/components/mobile/iron-catalog.css',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
 assert.match(html,/class="tc-collection-list"[^>]*role="list"/);
 assert.match(html,/aria-haspopup="dialog"/);
 assert.match(html,/class="tc-collection-sheet-backdrop" hidden=""/);
 assert.match(html,/class="tc-collection-sheet" role="dialog" aria-modal="true"/);
 assert.match(html,/aria-label="컬렉션 상세 닫기"/);
 assert.match(html,/class="tc-collection-detail-actions"/);
 assert.match(html,/장비 등록/);
 assert.match(source,/setDetailOpen\(true\)/);
 assert.match(source,/setDetailOpen\(false\)/);
 assert.match(source,/onTouchEnd=/,'the sheet grip supports a downward swipe');
 assert.match(css,/\.tc-collection-sheet-backdrop\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
 assert.match(css,/\.tc-collection-sheet-backdrop\s*\{[^}]*position:\s*fixed/);
 assert.match(css,/\.tc-collection-sheet\s*\{[^}]*max-height:/);
 assert.match(css,/\.tc-collection-sheet-scroll\s*\{[^}]*overflow-y:\s*auto/);
 const list=css.match(/\.tc-iron-catalog-screen \.tc-cosmetics-catalog:not\(\.listing-mode\)>\.tc-collection-list\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(list,/flex:\s*1 1 auto/);
 assert.match(list,/overflow-y:\s*auto/);
});

test('compact appearance rows keep effects and separate equip/collection actions',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance'}));
 assert.match(html,/tc-appearance-find/);
 const css=readFileSync('src/components/mobile/compact-appearances.css','utf8');
 assert.match(css,/grid-template-rows:repeat\(4,96px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(html,/착용 효과/);assert.match(html,/tc-appearance-related/);assert.match(html,/tc-cosmetics-equip/);
});

test('appearance image and name open the central detail with effect and equip actions',()=>{
 const html=renderToStaticMarkup(React.createElement(CosmeticsScreen,{game:initialState(),setGame:()=>{},initialTab:'appearance'}));
 assert.match(html,/aria-label="기본 모험가 상세 보기"/);
 const source=readFileSync('src/components/mobile/CoreScreens.tsx','utf8');
 assert.match(source,/tc-appearance-detail-popup/);assert.match(source,/tc-appearance-detail-actions/);
 assert.match(source,/detailPopup.current\?\.focus\(\)/);
});

test('refined appearance popup uses the appearance name and a seamless art surface',()=>{
 const source=readFileSync('src/components/mobile/CoreScreens.tsx','utf8');
 assert.match(source,/appearanceById\(appearanceDetails\)\?\.name/);
 assert.match(source,/tc-appearance-detail-effect/);
 const css=readFileSync('src/components/mobile/compact-appearances.css','utf8');
 assert.match(css,/\.tc-appearance-detail-art\{[^}]*background:transparent/);
});
