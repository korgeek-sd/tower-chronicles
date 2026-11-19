import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameState,EquipmentItem} from '../src/game/types';
import {bulkDismantleCandidates,equipmentDismantleYield} from '../src/game/engine/equipmentDismantle';
test('bulk dismantle selects whole eligible inventory, not worn or starter gear',()=>{
 const make=(id:string,grade:EquipmentItem['grade']):EquipmentItem=>({id,kind:'association_supply_iron_sword',grade,enhancement:0});
 const state={equipmentItems:[make('starter-v2','common'),make('equipped','uncommon'),make('a','common'),make('b','uncommon'),make('c','legendary')],equipped:{weapon:'equipped'},expedition:null} as unknown as GameState;
 const chosen=bulkDismantleCandidates(state,['common','uncommon']);
 assert.deepEqual(chosen.map(i=>i.id),['a','b']);
 assert.equal(chosen.reduce((sum,i)=>sum+equipmentDismantleYield(i),0),3);
 assert.deepEqual(bulkDismantleCandidates(state,['legendary']).map(i=>i.id),['c']);
 assert.equal(bulkDismantleCandidates({...state,expedition:{} as GameState['expedition']},['common']).length,0);
});
