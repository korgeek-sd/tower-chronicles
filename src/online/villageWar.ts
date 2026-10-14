import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export interface VillageWarDeclaration{
 townId:string;
 associationId:string;
 associationName:string;
}
export interface VillageWarState{
 cycleKey:string;
 phase:'BIDDING'|'LOCKED'|'BATTLE'|'SETTLED';
 bidClosesAt:string;
 battleStartsAt:string;
 myAssociationId:string|null;
 myRole:'LEADER'|'MEMBER'|null;
 tickets:number;
 guildTickets?:number;
 declarations:VillageWarDeclaration[];
}
export interface VillageWarResult{state:VillageWarState;replayed:boolean}
const messages:Record<string,string>={
 GAME_SESSION_LOST:'플레이 권한이 만료되었습니다. 다시 로그인해 주세요.',
 WAR_GUILD_REQUIRED:'원정단에 가입해야 선전포고할 수 있습니다.',
 WAR_LEADER_REQUIRED:'원정단장만 선전포고할 수 있습니다.',
 WAR_REQUEST_INVALID:'선전포고 요청을 다시 확인해 주세요.',
 WAR_REQUEST_CONFLICT:'이미 다른 마을에 사용된 요청입니다.',
 WAR_DECLARATION_CLOSED:'지금은 선전포고 등록 기간이 아닙니다.',
 WAR_TOWN_INVALID:'선택한 마을을 다시 확인해 주세요.',
 WAR_ALREADY_DECLARED:'이번 주 이 마을에 이미 선전포고했습니다.',
 WAR_TICKETS_SHORT:'도전권이 부족합니다.',
 WAR_GUILD_TICKETS_SHORT:'길드 창고의 공용 도전권이 100장보다 부족합니다.',
 WAR_FEATURE_DISABLED:'공성전 1차 기능은 내부 검증 중입니다.',
 WAR_ENDED:'전쟁이 종료되었습니다. 도전권은 차감되지 않았습니다.',
 WAR_SAME_GUILD:'같은 원정단의 전선은 공격할 수 없습니다.',
 WAR_PHASE_INVALID:'배치 또는 점령 가능한 시간이 아닙니다.',
 WAR_EVENT_BUSY:'전장 상태를 처리 중입니다. 다시 확인해 주세요.',
 WAR_FRONT_BUSY:'다른 공격이 진행 중입니다. 도전권은 차감되지 않았습니다.',
 WAR_ACTOR_BUSY:'다른 행동이 진행 중입니다. 도전권은 차감되지 않았습니다.',
 WAR_REQUEST_BUSY:'기존 요청을 처리 중입니다. 같은 요청의 결과를 다시 확인해 주세요.',
 WAR_EVENT_CHANGED:'전쟁 회차가 변경되었습니다. 현재 전선을 다시 선택해 주세요.',WAR_DEFENDER_CHANGED:'수비자가 변경되었습니다. 전선을 다시 확인해 주세요.',
 WAR_FRONT_NOT_EMPTY:'이미 수비자가 있는 전선입니다.',
 WAR_FRONT_EMPTY:'이미 비어 있는 전선입니다.',
 WAR_OWNER_REQUIRED:'현재 소유 길드원만 수비를 배치할 수 있습니다.',
 WAR_NOT_DECLARED:'선전포고한 길드만 점령할 수 있습니다.',
 WAR_ALREADY_DEFENDING:'이미 다른 전선을 수비 중입니다.',
 WAR_ATTACK_COOLDOWN:'공격 대기 시간이 남아 있습니다.',
};
export class WarDeclarationRejected extends Error{constructor(message:string,readonly code?:string){super(message);}}
async function rpc<T>(name:string,lease:GameplayLease,extra:Record<string,unknown>={},expectedUserId?:string):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 if(expectedUserId&&session.userId!==expectedUserId)throw Error('접속 계정이 변경되었습니다. 이전 계정의 요청은 실행하지 않았습니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',
  headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra}),
 });
 const text=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(messages))if(text.includes(code))throw new WarDeclarationRejected(message,code);
  throw Error('선전포고 요청 결과를 확인하지 못했습니다. 다시 확인해 주세요.');
 }
 const current=await getFreshSession();
 if(current?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(text) as T;
}
export const getVillageWarDeclarations=(lease:GameplayLease)=>rpc<VillageWarState>('get_village_war_declarations',lease);
export const declareVillageWar=(lease:GameplayLease,request:{id:string;townId:string})=>rpc<VillageWarResult>('declare_village_war',lease,{p_request_id:request.id,p_town_id:request.townId});
export function validWarDeclarationRequest(value:unknown):value is {id:string;townId:string}{
 if(!value||typeof value!=='object')return false;
 const v=value as {id:string;townId:string};
 return typeof v.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)&&
 typeof v.townId==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(v.townId);
}

export interface VillageWarFront{frontId:number;defenderUserId:string|null;defenderName:string|null;associationId:string|null;associationName:string|null;defenderEpoch:number;revision:number;hp:number|null;maxHp:number|null;mp:number|null;maxMp:number|null;occupiedAt:string|null}
export interface VillageWarStageOneState{stageTwo?:boolean;scores?:VillageWarScore[];settledAt?:string|null;winnerAssociationId?:string|null;recentBattles?:VillageWarBattleRecord[];enabled:boolean;serverNow:number;phase:'WAITING'|'DEPLOYMENT'|'BATTLE'|'ENDED';eventId?:string;cycleKey?:string;deploymentStartsAt?:string;battleStartsAt?:string;battleEndsAt?:string;ownerAssociationId?:string|null;myAssociationId?:string|null;myRole?:'LEADER'|'MEMBER'|null;tickets?:number;nextAttackAt?:string|null;myDefendingFront?:{eventId:string;frontId:number}|null;canAttack?:boolean;fronts:VillageWarFront[]}
export type VillageWarStageAction='PLACE'|'REMOVE'|'CLAIM_EMPTY'|'ATTACK';
export interface VillageWarStageRequest{id:string;eventId:string;userId:string;townId:string;frontId:number;expectedEpoch:number;action:VillageWarStageAction}
export interface VillageWarStageResult{state:VillageWarStageOneState;result:{action:VillageWarStageAction;frontId:number;defenderEpoch:number;ticketsSpent:number;cooldownUntil:string|null;battle?:VillageWarCombatResult};replayed:boolean}
export const getVillageWarState=(lease:GameplayLease,townId:string)=>rpc<VillageWarStageOneState>('get_village_war_state',lease,{p_town_id:townId});
const stageMutation=(name:string,lease:GameplayLease,r:VillageWarStageRequest)=>rpc<VillageWarStageResult>(name,lease,{p_request_id:r.id,p_expected_event_id:r.eventId,p_town_id:r.townId,p_front_id:r.frontId,p_expected_epoch:r.expectedEpoch},r.userId);
export const placeVillageWarDefender=(lease:GameplayLease,r:VillageWarStageRequest)=>stageMutation('place_village_war_defender',lease,r);
export const removeVillageWarDefender=(lease:GameplayLease,r:VillageWarStageRequest)=>stageMutation('remove_village_war_defender',lease,r);
export const claimEmptyVillageWarFront=(lease:GameplayLease,r:VillageWarStageRequest)=>stageMutation('claim_empty_village_war_front',lease,r);

export interface VillageWarScore{associationId:string;associationName:string|null;points:number;fronts:number}
export interface VillageWarCombatTurn{turn:number;lines:string[];attackerHp:number;attackerMp:number;defenderHp:number;defenderMp:number}
export interface VillageWarCombatResult{outcome:'CAPTURE'|'DEFENDED';attackerName:string;defenderName:string;attackerHp:number;attackerMp:number;attackerMaxHp:number;attackerMaxMp:number;defenderHp:number;defenderMp:number;defenderMaxHp:number;defenderMaxMp:number;defenderReward:number;turns:VillageWarCombatTurn[]}
export interface VillageWarBattleRecord{battleId:string;frontId:number;createdAt:string;attackerName:string;defenderName:string;outcome:'CAPTURE'|'DEFENDED';defenderHp:number;defenderReward:number}
export const attackVillageWarFront=(lease:GameplayLease,r:VillageWarStageRequest)=>stageMutation('attack_village_war_front',lease,r);
