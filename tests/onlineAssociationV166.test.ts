import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/association/AssociationScreen.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/association.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('ASSOCIATION ONLINE UI 01: online mode reads global server association state',()=>{
 assert.match(screen,/loadOnlineAssociationState/);
 assert.match(screen,/onlineLease/);
 assert.match(online,/get_online_association_state/);
});

test('ASSOCIATION ONLINE UI 02: server flow supports create browse join and pending applications',()=>{
 for(const token of ['createOnlineAssociation','joinOnlineAssociation','directory','myApplications'])
  assert.match(screen,new RegExp(token));
 assert.match(screen,/원정단 찾기/);
 assert.match(screen,/가입 신청/);
});

test('ASSOCIATION ONLINE UI 03: leaders can approve applications manage settings transfer and kick',()=>{
 for(const token of [
  'reviewOnlineAssociationApplication','updateOnlineAssociation',
  'transferOnlineAssociationLeadership','kickOnlineAssociationMember'
 ])assert.match(screen,new RegExp(token));
 assert.match(screen,/승인/);
 assert.match(screen,/단장 위임/);
 assert.match(screen,/내보내기/);
});

test('ASSOCIATION ONLINE UI 04: revenue share and treasury are visible server values',()=>{
 assert.match(screen,/revenueShareRatePercent/);
 assert.match(screen,/treasurySilver/);
 assert.match(screen,/수익 분담/);
 assert.match(screen,/원정단 금고/);
});

test('ASSOCIATION ONLINE UI 05: members can leave and leaders can disband through server RPCs',()=>{
 assert.match(screen,/leaveOnlineAssociation/);
 assert.match(screen,/disbandOnlineAssociation/);
 assert.match(screen,/원정단 탈퇴/);
 assert.match(screen,/원정단 해산/);
});

test('ASSOCIATION ONLINE UI 06: server mutations return cloud records and main applies them',()=>{
 assert.match(online,/CloudSaveRecord/);
 assert.match(screen,/onServerRecord/);
 assert.match(main,/AssociationScreen[\s\S]*onServerRecord/);
});

test('ASSOCIATION ONLINE UI 07: association realtime refreshes membership and application changes',()=>{
 assert.match(online,/realtime:association/);
 assert.match(online,/association_changed/);
 assert.match(screen,/subscribeAssociationRealtime/);
});
