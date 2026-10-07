import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
import type {WorldTown} from '../components/world/worldMap';
export type LifeResource='herb'|'farm';
export type LifeMaterial='herb'|'pepper'|'potato'|'wheat';
export interface LifeTown extends WorldTown{herbCapacity:number;farmCapacity:number;herbRemaining:number;farmRemaining:number}
export interface VillageLifeState{location:string;actionPoints:number;materials:Record<LifeMaterial,number>;towns:LifeTown[];serverNow:number;nextResetAt:number}
export interface GatherRequest{id:string;town:string;resource:LifeResource;count:number}
export interface GatherResponse{state:VillageLifeState;result:{townId:string;resource:LifeResource;count:number;actionPointsSpent:number;gains:Partial<Record<LifeMaterial,number>>};replayed:boolean}
const errors:Record<string,string>={GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.',TOWN_INVALID:'마을 정보를 다시 확인해 주세요.',LOCATION_MISMATCH:'현재 위치가 변경되었습니다. 마을 상태를 다시 확인해 주세요.',RESOURCE_INVALID:'이 마을에서는 해당 생활을 할 수 없습니다.',COUNT_INVALID:'생활 횟수는 1~100 사이여야 합니다.',ACTION_POINTS_EMPTY:'생활 행동력이 부족합니다.',TOWN_STOCK_EMPTY:'마을의 남은 생산량이 부족합니다.',REQUEST_CONFLICT:'이전 채집 요청과 내용이 다릅니다.',REQUEST_REQUIRED:'채집 요청을 다시 확인해 주세요.'};
export class VillageLifeRejected extends Error{}
async function rpc<T>(name:string,lease:GameplayLease,extra:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...extra})});
 const body=await response.text();if(!response.ok){for(const [code,message] of Object.entries(errors))if(body.includes(code))throw new VillageLifeRejected(message);throw Error('생활 요청을 확인하지 못했습니다. 다시 확인해 주세요.');}
 const current=await getFreshSession();if(current?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(body) as T;
}
export const getVillageLife=(lease:GameplayLease)=>rpc<VillageLifeState>('get_village_life',lease);
export const travelVillage=(lease:GameplayLease,town:string)=>rpc<VillageLifeState>('travel_village',lease,{p_town_id:town});
export const gatherVillage=(lease:GameplayLease,r:GatherRequest)=>rpc<GatherResponse>('gather_village',lease,{p_request_id:r.id,p_town_id:r.town,p_resource:r.resource,p_count:r.count});
export const LIFE_MATERIAL_NAMES:Record<LifeMaterial,string>={herb:'약초',pepper:'고추',potato:'감자',wheat:'밀'};
export function lifeBatchLimit(s:VillageLifeState,resource:LifeResource){const t=s.towns.find(t=>t.id===s.location);if(!t||t.kind!==resource&&t.kind!=='city')return 0;return Math.max(0,Math.min(100,s.actionPoints,Math.floor((resource==='herb'?t.herbRemaining:t.farmRemaining)/10)));}
export function validGatherRequest(value:unknown):value is GatherRequest{if(!value||typeof value!=='object')return false;const r=value as GatherRequest;return typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&typeof r.town==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(r.town)&&(r.resource==='herb'||r.resource==='farm')&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100;}
