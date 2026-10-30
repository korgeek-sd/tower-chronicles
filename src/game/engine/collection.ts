import type {GameState} from '../types';
import {APPEARANCE_SETS,collectionEquipmentLabel} from '../data/appearanceSets';
import {RECORD_COLLECTION_SETS,recordEquipmentLabel} from '../data/recordCollections';
import {V2_STARTER_EQUIPMENT_ID} from '../data/equipment';

/** Guest-only registration. Online accounts use the server RPC instead. */
export function registerCollectionEquipment(state:GameState,setId:string,itemId:string):GameState{
 const record=RECORD_COLLECTION_SETS.find(s=>s.id===setId);
 const set=record??APPEARANCE_SETS.find(s=>s.id===setId);
 if(!set||!set.equipment)return {...state,notice:'존재하지 않는 장비 컬렉션입니다.'};
 if(state.collectionRegisteredItems?.[setId])return {...state,notice:'이미 이 컬렉션에 장비를 등록했습니다.'};
 if(state.expedition)return {...state,notice:'원정 중에는 아이템을 등록할 수 없습니다.'};
 if(itemId===V2_STARTER_EQUIPMENT_ID)return {...state,notice:'기본 지급 장비는 컬렉션에 등록할 수 없습니다.'};
 const item=state.equipmentItems.find(g=>g.id===itemId);
 if(!item)return {...state,notice:'인벤토리에 해당 장비가 없습니다.'};
 if(item.kind!==set.equipment.kind||item.grade!==set.equipment.grade)return {...state,notice:'컬렉션에서 요구하는 장비 종류 또는 등급이 아닙니다.'};
 if(Object.values(state.equipped).includes(itemId))return {...state,notice:'장착을 해제한 뒤 등록할 수 있습니다.'};
 return {...state,equipmentItems:state.equipmentItems.filter(g=>g.id!==itemId),
  collectionRegisteredItems:{...(state.collectionRegisteredItems??{}),[setId]:itemId},
  notice:(record?recordEquipmentLabel(record):collectionEquipmentLabel(set.equipment))+' 등록 완료 · 장비 1개 소모'};
}
