import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GuildMaterialsPanel} from '../src/components/association/GuildMaterialsPanel';

const material=readFileSync(new URL('../src/components/association/GuildMaterialsPanel.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/components/association/guildMaterialsConcept.css',import.meta.url),'utf8');
const treasury=readFileSync(new URL('../src/components/association/AssociationWarehousePanel.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/guildMaterials.ts',import.meta.url),'utf8');

test('concept 1 material warehouse renders real in-game header, back navigation and loading',()=>{
 const html=renderToStaticMarkup(React.createElement(GuildMaterialsPanel,{
  lease:{leaseId:'test',generation:1,clientInstanceId:'test'},associationId:'demo',
  onBack:()=>{},
 }));
 for(const title of ['재료 창고','원정단 공동 보관품','뒤로','원정단 재료 창고 정보를 불러오는 중입니다.']){
  assert.ok(html.includes(title),title);
 }
 assert.match(html,/tc-guild-materials tc-gmc/);
 assert.match(html,/tc-gmc-hero/);
 assert.match(html,/tc-gmc-dialog/);
});

test('the inventory renders every authorized server material without fabricated inventory items',()=>{
 for(const id of ['herb','pepper','potato','wheat'])assert.ok(online.includes(id),id);
 assert.match(material,/GUILD_MATERIAL_IDS\.map\(id=>/);
 assert.match(material,/state\.materials\[id\]/);
 assert.match(material,/assets\/ui\/crafting\/'\+id\+'\.png'/);
 assert.match(material,/tc-gmc-material-grid/);
 assert.match(material,/GUILD_MATERIAL_NAMES\[id\]/);
 assert.doesNotMatch(material,/철광석|나무|마석|가죽|정제된 연금액/);
});

test('leader-only deposit/withdraw, nonce replay safety, and server audit trail remain wired',()=>{
 assert.match(material,/getGuildMaterials\(lease\)/);
 assert.match(material,/transferGuildMaterial\(lease,request\.requestId,request\.direction,request\.material,request\.amount\)/);
 assert.match(material,/sessionStorage\.setItem\(pendingKey\(associationId\)/);
 assert.match(material,/sessionStorage\.removeItem\(pendingKey\(associationId\)/);
 assert.match(material,/crypto\.randomUUID\(\)/);
 assert.match(material,/state\?\.isLeader/);
 assert.match(material,/!state\.isLeader\|\|expedition/);
 assert.match(material,/send\(true\)/);
 assert.match(material,/validAmount/);
 assert.match(material,/tc-gmc-deposit/);
 assert.match(material,/tc-gmc-withdraw/);
});

test('server ledger is shown as three newest rows with full returned history in a dialog',()=>{
 assert.match(material,/ledger\.slice\(0,3\)/);
 assert.match(material,/ledger\.map\(ledgerRow\)/);
 assert.match(material,/entry\.amount<0\?'출고':'입고'/);
 assert.match(material,/timeZone:'Asia\/Seoul'/);
 assert.match(material,/재료 거래 기록/);
 assert.match(material,/최근 \{ledger\.length\}건의 입출고/);
 assert.match(material,/최근 기록을 표시합니다/);
});

test('material screen owns its viewport while retaining the treasury bottom navigation',()=>{
 assert.match(treasury,/tc-tl-show-materials/);
 assert.match(treasury,/view!=='materials'&&<header className="tc-tl-hero"/);
 assert.match(treasury,/view==='materials'&&<GuildMaterialsPanel/);
 assert.match(treasury,/onBack=\{\(\)=>setView\('ledger'\)\}/);
 assert.match(treasury,/tc-tl-bottom/);
 assert.match(styles,/\.tc-treasury-ledger\.tc-tl-show-materials>\.tc-guild-materials\.tc-gmc/);
 assert.match(styles,/overflow:hidden!important/);
 assert.match(styles,/\.tc-gmc-record-list/);
 assert.match(styles,/overflow-y:auto/);
 assert.match(styles,/@media\(max-height:720px\)/);
});

test('warehouse presentation matches the illustrated ledger hierarchy even with no transactions',()=>{
 assert.match(material,/tc-gmc-material-art/);
 assert.match(material,/tc-gmc-record-head/);
 assert.match(material,/tc-gmc-empty-ledger/);
 assert.match(material,/tc-gmc-empty-seal/);
 assert.match(styles,/\.tc-gmc \.tc-gmc-material-art/);
 assert.match(styles,/\.tc-gmc \.tc-gmc-record-head/);
 assert.match(styles,/\.tc-gmc \.tc-gmc-empty-ledger/);
 assert.match(styles,/\.tc-gmc \.tc-gmc-hero h2::before/);
 assert.match(styles,/\.tc-gmc \.tc-gmc-transfer-actions button/);
});
