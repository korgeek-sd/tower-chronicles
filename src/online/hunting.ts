import type {HuntingState,HuntResult,HuntMapId} from '../game/hunting/model';
import {getFreshSession} from './auth';
import {getDeviceId,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
export interface HuntingResponse {state:HuntingState;result:HuntResult;record:CloudSaveRecord;replayed:boolean;serverNow:number}
export type HuntingServerState=HuntingState&{serverNow:number};
const errors:Record<string,string>={VITALITY_EMPTY:'활력이 부족합니다. 회복 후 다시 사냥하세요.',HUNT_EXPEDITION_ACTIVE:'진행 중인 원정을 먼저 마쳐주세요.',HUNT_REQUEST_CONFLICT:'이전 사냥 요청과 지역이 다릅니다.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.',CLOUD_SAVE_REQUIRED:'클라우드 저장을 먼저 완료해 주세요.',HUNT_PRESET_INVALID:'스킬은 중복 없이 3개까지 설정할 수 있습니다.',STAT_POINTS_EMPTY:'남은 스탯 포인트가 부족합니다.',STAT_CRIT_LIMIT:'치명타는 10포인트까지만 투자할 수 있습니다.',STAT_COMBAT_ACTIVE:'전투 중에는 스탯을 변경할 수 없습니다.',STAT_ALLOCATION_INVALID:'스탯 배분 요청이 올바르지 않습니다.',STAT_MUST_RESET:'분배한 포인트를 되돌리려면 초기화를 이용하세요.',STAT_SILVER_SHORTAGE:'스탯 초기화에 필요한 실버가 부족합니다.',STAT_NOT_ALLOCATED:'초기화할 스탯이 없습니다.',REQUEST_REQUIRED:'초기화 요청을 다시 확인해 주세요.'};
async function rpc<T>(name:string,lease:GameplayLease,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra})});
 const body=await response.text();if(!response.ok){for(const [code,message] of Object.entries(errors))if(body.includes(code))throw Error(message);throw Error('사냥 요청을 확인하지 못했습니다. 다시 확인하면 같은 요청을 복구합니다.');}
 return JSON.parse(body) as T;
}
export const getHuntingState=(lease:GameplayLease)=>rpc<HuntingServerState>('get_hunting_state',lease);
export const saveHuntingPreset=(lease:GameplayLease,skills:string[])=>rpc<HuntingServerState>('save_hunting_preset',lease,{p_skills:skills});
export async function huntOnce(lease:GameplayLease,mapId:HuntMapId,requestId:string):Promise<HuntingResponse>{
 const before=await getFreshSession(),result=await rpc<HuntingResponse>('hunt_once',lease,{p_map_id:mapId,p_request_id:requestId});
 const current=await getFreshSession();if(!before||current?.userId!==before.userId)throw Error('접속 계정이 변경되었습니다.');
 return result;
}

export interface StatActionResponse {state:HuntingServerState;record:CloudSaveRecord;cost?:number;replayed?:boolean}
export const allocateHuntingStats=(lease:GameplayLease,allocation:import('../game/hunting/model').StatAllocation)=>rpc<StatActionResponse>('allocate_hunting_stats',lease,{p_allocation:allocation});
export const resetHuntingStats=(lease:GameplayLease,requestId:string)=>rpc<StatActionResponse>('reset_hunting_stats',lease,{p_request_id:requestId});
