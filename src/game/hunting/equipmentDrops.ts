import type {EquipmentItem,EquipmentKind} from '../types';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADES} from '../data/equipment';
import type {HuntMapId} from './model';
/** Absolute per-victory chances in millionths, ordered common through legendary. */
export const HUNT_EQUIPMENT_RATES:Record<HuntMapId,readonly number[]>={
 plains:[13000,2000,0,0,0],forest:[13000,3000,500,0,0],mine:[13000,3500,900,100,0],
 fortress:[13000,4000,1300,200,0],ruins:[13000,4500,1600,350,116],
};
export const HUNT_EQUIPMENT_KINDS=Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentKind[];
/** Two independent uniform integer draws: grade 0..999999, kind 0..8. */
export function rollHuntingEquipment(map:HuntMapId,roll:number,kindIndex:number):EquipmentItem|null {
 if(!Number.isInteger(roll)||roll<0||roll>=1000000||!Number.isInteger(kindIndex)||kindIndex<0||kindIndex>=9)throw Error('잘못된 장비 드랍 추첨입니다.');
 let end=0;
 for(const [index,rate]of HUNT_EQUIPMENT_RATES[map].entries()){
  end+=rate;if(roll<end)return {id:crypto.randomUUID(),kind:HUNT_EQUIPMENT_KINDS[kindIndex],grade:EQUIPMENT_GRADES[index],enhancement:0};
 }
 return null;
}
