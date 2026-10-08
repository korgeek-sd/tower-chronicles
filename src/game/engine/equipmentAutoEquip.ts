import type {GameState,EquipmentItem,Slot} from '../types';
import {EQUIPMENT_GRADES,equipmentItemSlot} from '../data/equipment';
import {equip} from './state';
const rank=(item:EquipmentItem)=>EQUIPMENT_GRADES.indexOf(item.grade);
const weaponOrder=['association_supply_iron_sword','outer_guard_longbow','archive_standard_arcane_staff'];
function eligible(s:GameState,item:EquipmentItem){const slot=equipmentItemSlot(item),current=s.equipmentItems?.find(i=>i.id===s.equipped[slot]);return slot!=='weapon'||!current||current.kind===item.kind;}
export function isEquipmentUpgrade(s:GameState,id:string){const item=s.equipmentItems?.find(i=>i.id===id);if(!item||!eligible(s,item))return false;const current=s.equipmentItems?.find(i=>i.id===s.equipped[equipmentItemSlot(item)]);return !current||rank(item)>rank(current);}
export function bestEquipmentIds(s:GameState):string[]{
 const best=new Map<Slot,EquipmentItem>();
 for(const item of s.equipmentItems??[]){if(!eligible(s,item))continue;const slot=equipmentItemSlot(item),previous=best.get(slot);if(!previous||rank(item)>rank(previous)||(slot==='weapon'&&rank(item)===rank(previous)&&weaponOrder.indexOf(item.kind)<weaponOrder.indexOf(previous.kind)))best.set(slot,item);}
 return [...best.values()].filter(i=>isEquipmentUpgrade(s,i.id)).map(i=>i.id);
}
export function autoEquip(s:GameState):GameState{if(s.expedition)return {...s,notice:'원정 중에는 장비를 변경할 수 없습니다.'};const ids=bestEquipmentIds(s);const next=ids.reduce((game,id)=>equip(game,id),s);return {...next,notice:ids.length?`장비 ${ids.length}개 자동 교체 완료 · 무기 종류 유지`:'이미 최상위 장비를 착용하고 있습니다.'};}
