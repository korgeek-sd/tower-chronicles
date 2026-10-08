import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {existsSync} from 'node:fs';
import {initialState} from '../src/game/engine/state';import {inventoryView} from '../src/game/inventoryView';import {InventoryItemArt} from '../src/components/inventory/InventoryDetailSheet';import {EQUIPMENT_DEFINITIONS} from '../src/game/data/equipment';
test('all nine real equipment items render their own shared grade artwork',()=>{
 const s=initialState();s.equipmentItems=Object.keys(EQUIPMENT_DEFINITIONS).map((kind,i)=>({id:'art-'+i,kind,grade:'rare',enhancement:0})) as any;
 for(const item of inventoryView(s).filter(i=>i.modern)){
  const kind=s.equipmentItems.find(i=>i.id===item.sourceId)!.kind;
  assert.ok(existsSync(new URL('../public/assets/ui/equipment/'+kind+'.png',import.meta.url)));
  const html=renderToStaticMarkup(React.createElement(InventoryItemArt,{item,slot:true}));
  assert.ok(html.includes('assets/ui/equipment/'+kind+'.png'));
  assert.match(html,/aria-hidden="true"/);assert.doesNotMatch(html,/<svg/);
 }
});
