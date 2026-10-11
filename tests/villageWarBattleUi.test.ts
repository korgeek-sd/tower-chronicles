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
 assert.match(html,/노바르 점령전/);assert.match(html,/제3전선/);assert.match(html,/귀환수호자/);
 assert.match(html,/74%/);assert.match(html,/VS/);
 assert.match(html,/즉시 전투/);assert.match(html,/최근 기록/);
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

test('war battle preview uses expanded visible log with at least five recent events',()=>{
 const html=renderToStaticMarkup(React.createElement(VillageWarBattleScreen,{game:initialState(),nickname:'테스트',initialWar:war,initialPreview:true}));
 const rows=html.match(/<li>/g)??[];
 assert.ok(rows.length>=5,'preview should show five or more recent battles');
 assert.match(html,/제1전선 공격/);
 assert.match(html,/제5전선 점령/);
});
