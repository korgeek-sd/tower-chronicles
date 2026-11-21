import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {VillageWarBattleScreen} from '../src/components/occupation/VillageWarBattleScreen';
import {initialState} from '../src/game/engine/state';
import type {VillageWarState} from '../src/online/villageWar';

const war:VillageWarState={
 cycleKey:'2026-10-12',phase:'BATTLE',bidClosesAt:'2026-10-16T13:00:00Z',
 battleStartsAt:'2026-10-17T13:00:00Z',
 myAssociationId:'12345678-1234-1234-1234-123456789012',myRole:'MEMBER',tickets:17,
 declarations:[{townId:'city',associationId:'12345678-1234-1234-1234-123456789012',associationName:'철의맹세'}],
};
test('five fronts are visible and selectable on one village war screen',()=>{
 const html=renderToStaticMarkup(React.createElement(VillageWarBattleScreen,{game:initialState(),nickname:'테스트',initialWar:war,initialPreview:true}));
 assert.equal((html.match(/data-front-id=/g)??[]).length,5);
 assert.match(html,/노바르/);assert.match(html,/제3전선/);assert.match(html,/귀환수호자/);
 assert.match(html,/74%/);assert.match(html,/탈진 패배 확률 30%/);
 assert.match(html,/즉시 전투/);assert.match(html,/최근 전투 기록/);
});
test('server mode never invents a garrison, HP or enables a PvP attack without a combat endpoint',()=>{
 const html=renderToStaticMarkup(React.createElement(VillageWarBattleScreen,{game:initialState(),nickname:'테스트',initialWar:war,initialPreview:false}));
 assert.equal((html.match(/data-front-id=/g)??[]).length,5);
 assert.match(html,/수비자 정보 없음/);
 assert.match(html,/전투 엔진 연결 전/);
 assert.doesNotMatch(html,/data-action="attack"/);
});
test('viewport keeps selection, fighters, action and compact records in an unclipped grid',()=>{
 const css=readFileSync(new URL('../src/components/occupation/village-war-battle.css',import.meta.url),'utf8');
 assert.match(css,/\.tc-vwb\s*\{[^}]*height:100%/);
 assert.match(css,/grid-template-rows:[^;]*minmax\(0,1\.4fr\) auto minmax\(0,1\.8fr\)/);
 assert.match(css,/\.tc-vwb\[data-war-preview=true\]\{grid-template-rows:[^}]*minmax\(0,1\.35fr\) auto minmax\(0,1\.8fr\)/);
 assert.match(css,/\.tc-vwb-feed ul\{[^}]*overflow-y:auto/);
 assert.match(css,/\.tc-vwb-art img\{[^}]*width:100%;height:100%/);
 assert.match(css,/\.tc-vwb-fronts\s*\{[^}]*grid-template-columns:repeat\(5/);
 assert.match(css,/\.tc-vwb-fighters\s*\{[^}]*grid-template-columns:repeat\(2/);
});

test('war battle preview shows all five compact lanes with modal links for details',()=>{
 const html=renderToStaticMarkup(React.createElement(VillageWarBattleScreen,{game:initialState(),nickname:'테스트',initialWar:war,initialPreview:true}));
 assert.equal((html.match(/class="tc-village-lane /g)??[]).length,5);
 assert.match(html,/제1전선/);assert.match(html,/제5전선/);
 assert.match(html,/aria-label="원정단 점수 현황 전체 순위 보기"/);
 assert.match(html,/aria-label="최근 전투 기록 전체 보기"/);
 assert.match(html,/원정단 순위/);
 assert.match(html,/전투 기록/);
 assert.match(html,/귀환수호자/);
});

test('occupation selection contains five playable settlements, not retired locations',async()=>{
 const html=renderToStaticMarkup(React.createElement(VillageWarBattleScreen,{game:initialState(),nickname:'테스트',initialWar:war,initialPreview:true}));
 assert.match(html,/aria-label="전쟁 마을 선택"/);
 // GameSelect renders a custom picker, not native option tags, until opened.
 const source=readFileSync(new URL('../src/components/occupation/VillageWarBattleScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/WORLD_TOWNS\.map\(t=><option/g);
 const {WORLD_TOWNS}=await import('../src/components/world/worldMap');
 assert.equal(WORLD_TOWNS.length,5);
 for(const name of ['해오름','풍요뜰','밀바람','안개골','은잎골','초록샘'])assert.doesNotMatch(html,new RegExp(name));
});

test('live and preview siege war is a no-scroll mobile dashboard with all five rows and pinned attack',()=>{
 const css=readFileSync(new URL('../src/components/occupation/village-war-stage-one.css',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/components/occupation/VillageWarDeploymentPanel.tsx',import.meta.url),'utf8');
 assert.match(css,/\.tc-village-stage-v3\.tc-siege-v4\.tc-siege-v5\{[\s\S]*?overflow:hidden/);
 assert.match(css,/\.tc-siege-v5 \.tc-village-lanes\{[\s\S]*?grid-template-rows:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tc-siege-v5 \.tc-village-lane:nth-child\(n\+4\)/);
 assert.match(css,/\.tc-siege-v5 \.tc-village-selected-front\{[\s\S]*?grid-template-rows:17px minmax\(0,1fr\) 43px/);
 assert.match(css,/\.tc-siege-v5 \.tc-siege-bottom\{[\s\S]*?grid-template-columns:repeat\(2/);
 assert.match(source,/tc-siege-v4 tc-siege-v5/);
 assert.match(source,/onClick=\{act\}/);
 assert.match(source,/setOverlay\('scores'\)/);
 assert.match(source,/setOverlay\('records'\)/);
 assert.doesNotMatch(source,/className="tc-village-mini-records"/);
});
