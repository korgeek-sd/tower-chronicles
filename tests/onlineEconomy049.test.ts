import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {applyServerEconomyRecord} from '../src/online/economy.ts';

test('ONLINE ECONOMY 01: server record replaces only protected economy fields',()=>{
 const local=initialState();
 local.notice='local-progress';
 local.materials.ore[0]=1;
 local.tickets.ore[0]=2;
 local.silver=3;
 local.market.gold=4;
 local.crafting.nextJobId=9;

 const server=structuredClone(local);
 server.silver=500;
 server.market.gold=60;
 server.materials.ore[0]=70;
 server.tickets.ore[0]=8;
 server.skillBooks={heavy:2};
 server.lootItems={relic:1};
 server.items=[{id:'server-gear',kind:'sword',tier:1,enhancement:1}];

 const next=applyServerEconomyRecord(local,{
  revision:7,saveSchema:22,appVersion:'0.1.49',payload:server,payloadHash:'hash',updatedAt:'now',
 });
 assert.equal(next.silver,500);
 assert.equal(next.market.gold,60);
 assert.equal(next.materials.ore[0],70);
 assert.equal(next.tickets.ore[0],8);
 assert.deepEqual(next.skillBooks,{heavy:2});
 assert.deepEqual(next.lootItems,{relic:1});
 assert.equal(next.items[0].id,'server-gear');
 assert.equal(next.notice,'local-progress');
 assert.equal(next.crafting.nextJobId,9);
});

test('ONLINE ECONOMY 02: server merge does not mutate caller state',()=>{
 const local=initialState(),before=structuredClone(local),server=structuredClone(local);
 server.silver=999;
 applyServerEconomyRecord(local,{revision:1,saveSchema:22,appVersion:'0.1.49',payload:server,payloadHash:'h',updatedAt:'now'});
 assert.deepEqual(local,before);
});
