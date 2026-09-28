import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {marketItems} from '../src/game/market/marketService.ts';

test('V2 MARKET CATALOG 01: all 9 x 5 x 11 equipment specs exist even with zero orders and zero owned gear',()=>{
 const s=initialState();
 s.equipmentItems=[];
 s.market.orders=[];
 const items=marketItems(s).filter(item=>item.modernEquipment);
 assert.equal(items.length,9*5*11);
 assert.equal(new Set(items.map(item=>item.id)).size,9*5*11);
 assert.ok(items.every(item=>item.available===0));
});

test('V2 MARKET CATALOG 02: every equipment spec can be selected for BUY before the player owns it',()=>{
 const s=initialState();
 s.equipmentItems=[];
 s.market.orders=[];
 const ids=new Set(marketItems(s).filter(item=>item.modernEquipment).map(item=>item.id));
 for(const id of [
  'equipment:association_supply_iron_sword:common:+0',
  'equipment:outer_guard_longbow:rare:+5',
  'equipment:expedition_merit_ring:legendary:+10',
 ])assert.ok(ids.has(id),id);
});

test('V2 MARKET CATALOG 03: owned sellable gear increments availability on its canonical spec only',()=>{
 const s=initialState();
 s.equipmentItems=[{id:'owned-ring',kind:'expedition_merit_ring',grade:'rare',enhancement:5}];
 s.equipped.ring=null;
 const items=marketItems(s);
 const target=items.find(item=>item.id==='equipment:expedition_merit_ring:rare:+5');
 assert.ok(target);
 assert.equal(target.available,1);
 assert.deepEqual(target.equipmentIds,['owned-ring']);
 const other=items.find(item=>item.id==='equipment:expedition_merit_ring:rare:+4');
 assert.ok(other);
 assert.equal(other.available,0);
});

test('V2 MARKET CATALOG 04: equipped gear keeps the market spec visible but is not sellable',()=>{
 const s=initialState();
 s.equipmentItems=[{id:'equipped-bow',kind:'outer_guard_longbow',grade:'heroic',enhancement:7}];
 s.equipped.weapon='equipped-bow';
 const target=marketItems(s).find(item=>item.id==='equipment:outer_guard_longbow:heroic:+7');
 assert.ok(target);
 assert.equal(target.available,0);
 assert.deepEqual(target.equipmentIds,[]);
});
