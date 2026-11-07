import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {equipmentItemName} from '../src/game/data/equipment';
import type {EquipmentItem} from '../src/game/types';

const read=(name:string)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const activeScreens=[
 'src/components/battle/BattleScreen.tsx',
 'src/components/growth/CharacterGrowthScreen.tsx',
 'src/components/inventory/InventoryGrid.tsx',
 'src/components/inventory/InventoryScreen.tsx',
 'src/components/market/EquipmentMarketPanel.tsx',
 'src/components/mobile/RecordCollectionScreen.tsx',
 'src/components/mobile/CoreScreens.tsx',
];
test('equipment names have no +0 or +N suffix, regardless of legacy enhancement data',()=>{
 const zero:EquipmentItem={id:'sample',kind:'association_supply_iron_sword',grade:'rare',enhancement:0};
 const old:EquipmentItem={...zero,enhancement:8};
 assert.equal(equipmentItemName(zero),equipmentItemName(old));
 assert.doesNotMatch(equipmentItemName(zero),/\+\d+/);
});
test('live equipment screens never show obsolete enhancement levels',()=>{
 for(const path of activeScreens){
  const source=read(path);
  assert.doesNotMatch(source,/(?:dropToast|item|listing|weapon\.item)\.enhancement\}/,path);
  assert.doesNotMatch(source,/강화 \+\{/,'UI '+path);
  assert.doesNotMatch(source,/\+\{i\.enhancement\}/,path);
 }
 const battle=read(activeScreens[0]);
 assert.match(battle,/안전 귀환 시 보관함 확정/);
 assert.match(battle,/안전 귀환 시 보관함 저장/);
 const trade=read('src/components/market/EquipmentMarketPanel.tsx');
 assert.doesNotMatch(trade,/강화 단계|전체 강화|enhancementFilter|setEnhancementFilter/);
 assert.match(trade,/장비 등급/);
});
test('only equipment enhancement tags disappear; appearance and seal advancement remain',()=>{
 const appearance=read('src/components/mobile/CoreScreens.tsx');
 const seal=read('src/components/seal/SealScreen.tsx');
 assert.match(appearance,/외형 강화/);
 assert.match(seal,/재주조/);
 const inventory=read('src/components/inventory/InventoryScreen.tsx');
 assert.match(inventory,/자동 장착/);
 assert.match(inventory,/tc-storage-grade/);
});
