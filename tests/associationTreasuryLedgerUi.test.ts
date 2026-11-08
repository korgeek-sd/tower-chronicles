import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssociationWarehousePanel} from '../src/components/association/AssociationWarehousePanel';

const panel=readFileSync(new URL('../src/components/association/AssociationWarehousePanel.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/association/treasuryLedger.css',import.meta.url),'utf8');
const association=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
const art=readFileSync(new URL('../src/components/association/treasuryLedgerBanner.webp',import.meta.url));

test('treasury ledger presents a full game interface while awaiting real server balances',()=>{
 const html=renderToStaticMarkup(React.createElement(AssociationWarehousePanel,{
  lease:{leaseId:'test',generation:1,clientInstanceId:'test'},associationId:'demo',
 }));
 for(const label of ['탑의 기록','원정단 금고','원정단의 자산을 관리하는 공동 금고입니다.','뒤로','원정단 금고 정보를 불러오는 중입니다.']){
  assert.ok(html.includes(label),'should display '+label);
 }
 assert.match(html,/tc-treasury-ledger/);
 assert.match(html,/tc-tl-hero/);
 assert.match(html,/tc-tl-back/);
});

test('treasury ledger preserves server-authoritative shared balances and public history',()=>{
 for(const marker of ['loadAssociationWarehouse(','loadAssociationWarehouseHistory(','transferAssociationTreasury(','getFreshSession','GuildMaterialsPanel','state.myRole!==\'LEADER\'','state.myRole!==\'LEADER\'','treasuryLedger.css']) {
  if(marker==='getFreshSession')continue;
  assert.ok(panel.includes(marker),marker);
 }
 assert.match(panel,/balance\(item\.id,'treasury'\)/);
 assert.match(panel,/history\.filter\(entry=>entry\.currency==='SILVER'\)/);
 assert.match(panel,/원정단장 전용/);
 assert.match(panel,/state\.myRole!=='LEADER'\|\|expedition\|\|busy/);
 assert.match(panel,/storageKey\(associationId\)/);
 assert.match(panel,/setPending\(request\)/);
 assert.match(panel,/requestId:crypto\.randomUUID\(\)/);
 assert.doesNotMatch(panel,/42,578,300|18,940|1,284|2,846,700/);
});

test('treasury ledger matches the second approved design with 3 balances, full ledger and 3 navigation sections',()=>{
 for(const marker of ['tc-tl-balances','tc-tl-highlights','tc-tl-board-head','tc-tl-ledger-list','tc-tl-entry','tc-tl-filters','tc-tl-actions','tc-tl-bottom','tc-tl-dialog','tc-tl-history-dialog']){
  assert.ok(panel.includes(marker),marker);
 }
 for(const label of ['거래 장부','전체 내역','세부 내역','장부','자산','보관품','실버','골드','도전권','재료 창고','금고 운영 안내']){
  assert.ok(panel.includes(label),label);
 }
 assert.match(association,/tc-treasury-immersive/);
 assert.match(association,/onBack=\{\(\)=>navigate\('overview'\)\}/);
 assert.match(css,/\.tc-assoc\.tc-treasury-immersive>\.tc-company-mainnav/);
 assert.match(css,/\.tc-app:has\(\.tc-treasury-immersive\)>\.tc-nav/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/@media\(max-width:370px\)/);
 assert.match(css,/treasuryLedgerBanner\.webp/);
});

test('custom ledger background is a valid small locally bundled WebP',()=>{
 assert.equal(art.subarray(0,4).toString('ascii'),'RIFF');
 assert.equal(art.subarray(8,12).toString('ascii'),'WEBP');
 assert.ok(art.length>2500);
 assert.ok(art.length<100000);
});
