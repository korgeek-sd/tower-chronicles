import type {EquipmentGrade,EquipmentItem,GameState} from '../types';
import {V2_STARTER_EQUIPMENT_ID,equipmentItemName} from '../data/equipment';

export const ENHANCEMENT_STONE_ITEM_ID='enhancement_stone';

export const EQUIPMENT_DISMANTLE_YIELDS={
 common:1,
 uncommon:2,
 rare:4,
 heroic:8,
 legendary:15,
} as const satisfies Record<EquipmentGrade,number>;

export function equipmentDismantleYield(item:EquipmentItem):number {
 return EQUIPMENT_DISMANTLE_YIELDS[item.grade];
}

export function dismantleEquipment(state:GameState,itemId:string):GameState {
 const s=structuredClone(state);
 if(s.expedition)return {...s,notice:'원정 중에는 장비를 분해할 수 없습니다.'};
 if(itemId===V2_STARTER_EQUIPMENT_ID)return {...s,notice:'협회 보급 장비는 분해할 수 없습니다.'};
 const item=(s.equipmentItems??[]).find(value=>value.id===itemId);
 if(!item)return {...s,notice:'분해할 장비를 찾을 수 없습니다.'};
 if(Object.values(s.equipped).includes(itemId))return {...s,notice:'장착 해제 후 분해할 수 있습니다.'};
 const stones=equipmentDismantleYield(item);
 s.equipmentItems=(s.equipmentItems??[]).filter(value=>value.id!==itemId);
 s.lootItems.split_stone=(s.lootItems.split_stone??0)+stones;
 s.notice=`${equipmentItemName(item)} 분해 완료 · 분해석 ${stones}개 획득`;
 return s;
}
