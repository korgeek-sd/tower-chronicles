import type {EquipmentItem,Slot} from '../game/types';
import type {EquipmentBaseStats} from '../game/data/equipment';
import type {CombatStats,StatAllocation} from '../game/hunting/model';
import type {AssociationSealReward} from '../game/seal';
import type {GameplayLease} from './gameSession';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
export interface CharacterGrowthSnapshot {
 experience:number;allocation:StatAllocation;baseStats:CombatStats;
 stats:CombatStats&{appearanceEffect?:{id?:string;value?:number}};
 maxMp:number;currentJobId:string|null;selectedAppearanceId:string;
 equipment:{slot:Slot;item:EquipmentItem;stats:EquipmentBaseStats}[];
 seals:Record<'association'|'guardian',{level:number;bonus:AssociationSealReward}>;
 collection:{applied:boolean;bonuses?:{hp:number;attack:number;defense:number};registeredSetIds:string[];unlockedAppearanceIds:string[]};
 foodTurns:Partial<Record<'attack_food'|'defense_food'|'experience_food',number>>;
}
export async function getCharacterGrowth(lease:GameplayLease):Promise<CharacterGrowthSnapshot>{
 if(!supabaseConfig)throw Error('온라인 연결 설정을 확인해 주세요.');
 const session=await getFreshSession();if(!session)throw Error('로그인 후 성장 현황을 확인할 수 있습니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/get_character_growth',{
  method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId()}),
 });
 const text=await response.text();
 if(!response.ok)throw Error(text.includes('GAME_SESSION_LOST')?'플레이 권한이 변경되었습니다. 다시 접속해 주세요.':'성장 현황을 불러오지 못했습니다. 다시 확인해 주세요.');
 if((await getFreshSession())?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(text) as CharacterGrowthSnapshot;
}
