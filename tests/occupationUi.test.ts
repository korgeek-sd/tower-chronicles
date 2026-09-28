import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen=readFileSync(new URL('../src/components/occupation/OccupationScreen.tsx',import.meta.url),'utf8');
const online=readFileSync(new URL('../src/online/occupation.ts',import.meta.url),'utf8');
const core=readFileSync(new URL('../src/components/mobile/CoreScreens.tsx',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('OCCUPATION UI 01: home exposes an occupation facility and AppPage route',()=>{
 assert.match(core,/'occupation'/);
 assert.match(core,/점령전/);
 assert.match(main,/OccupationScreen/);
 assert.match(main,/page==='occupation'/);
});

test('OCCUPATION UI 02: state screen exposes schedule tower ownership merit and public bids',()=>{
 for(const label of ['점령 현황','원정 공적','공개 입찰'])assert.match(screen,new RegExp(label));
 assert.match(screen,/state\.towers/);
 assert.match(screen,/state\.merit/);
 assert.match(screen,/state\.bids/);
});

test('OCCUPATION UI 03: ticket donation and bid controls are server RPC backed',()=>{
 assert.match(screen,/donateOccupationTickets/);
 assert.match(screen,/placeOccupationBid/);
 assert.match(screen,/10/);
 assert.match(screen,/100/);
 assert.match(online,/donate_occupation_tickets/);
 assert.match(online,/place_occupation_bid/);
});

test('OCCUPATION UI 04: battle phase shows all three fronts and server auto matching',()=>{
 for(const front of ['LEFT','CENTER','RIGHT'])assert.match(screen,new RegExp(front));
 assert.match(screen,/joinOccupationFront/);
 assert.match(screen,/자동 매칭/);
});

test('OCCUPATION UI 05: duel panel is strict turn based with basic attack and guard',()=>{
 assert.match(screen,/기본 공격/);
 assert.match(screen,/방어 태세/);
 assert.match(screen,/currentActor/);
 assert.match(screen,/actionNonce/);
 assert.match(screen,/applyOccupationDuelAction/);
});

test('OCCUPATION UI 06: occupation realtime refreshes remote front and duel changes',()=>{
 assert.match(online,/realtime:occupation/);
 assert.match(online,/occupation_changed/);
 assert.match(screen,/subscribeOccupationRealtime/);
});
