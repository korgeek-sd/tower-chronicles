import type {ProductId,FoodId,LifeActionRequest,LifeMasteryTrack} from '../game/life/crafting';
import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
import {isActiveTownId,type WorldTown} from '../components/world/worldMap';
export type LifeResource='herb'|'farm';
export type LifeMaterial='herb'|'pepper'|'potato'|'wheat'|'stone';
export interface LifeTown extends WorldTown{herbCapacity:number;farmCapacity:number;herbRemaining:number;farmRemaining:number}
export interface VillageLifeState{location:string;vitality:number;recoveredAt?:number;materials:Record<Exclude<LifeMaterial,'stone'>,number>&{stone?:number};products?:Record<ProductId,number>;craftMastery?:number;lifeMasteries?:Partial<Record<LifeMasteryTrack,number>>;craftCarry?:Partial<Record<ProductId,number>>;foodTurns?:Record<FoodId,number>;wellReadyAt?:number;health?:{hp:number|null;maxHp:number|null}|null;towns:LifeTown[];serverNow:number;nextResetAt:number}
export interface CraftQueueJob{id:string;item:ProductId;count:number;quantity:number;startsAt:number;endsAt:number;durationSeconds:number;status:'waiting'|'crafting'|'complete'}
export interface CraftQueueSnapshot{jobs:CraftQueueJob[];serverNow:number}
export interface CraftQueueActionResponse{state:VillageLifeState;queue:CraftQueueJob[];result:{item:ProductId;quantity?:number;count:number;cancelled?:boolean};replayed:boolean}
export interface GatherRequest{id:string;town:string;resource:LifeResource;count:number}
export interface GatherResponse{state:VillageLifeState;result:{townId:string;resource:LifeResource;count:number;vitalitySpent?:number;actionPointsSpent?:number;gains:Partial<Record<LifeMaterial,number>>;tax?:Partial<Record<LifeMaterial,number>>;taxRate?:number};replayed:boolean}
export interface LifeActionResponse{state:VillageLifeState;queue?:CraftQueueJob[];result:{action:string;item:ProductId|'well';count:number;quantity:number;vitalitySpent?:number;actionPointsSpent?:number};replayed:boolean}
const errors:Record<string,string>={RECIPE_INVALID:'제작품을 다시 확인해 주세요.',RECIPE_LOCATION:'이 마을에서는 해당 제작을 할 수 없습니다.',MATERIALS_EMPTY:'제작 재료가 부족합니다.',PRODUCTS_EMPTY:'사용할 아이템이 부족합니다.',VITALITY_LIMIT:'활력 900 이하에서 사용할 수 있습니다. 포션은 소모되지 않았습니다.',WELL_COOLDOWN:'우물은 30초마다 사용할 수 있습니다.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.',TOWN_INVALID:'마을 정보를 다시 확인해 주세요.',LOCATION_MISMATCH:'현재 위치가 변경되었습니다. 마을 상태를 다시 확인해 주세요.',RESOURCE_INVALID:'이 마을에서는 해당 생활을 할 수 없습니다.',COUNT_INVALID:'생활 횟수는 1~100 사이여야 합니다.',VITALITY_EMPTY:'활력이 부족합니다.',ACTION_POINTS_EMPTY:'활력이 부족합니다.',TOWN_STOCK_EMPTY:'마을의 남은 생산량이 부족합니다.',REQUEST_CONFLICT:'이전 생활 요청과 내용이 다릅니다.',REQUEST_REQUIRED:'생활 요청을 다시 확인해 주세요.',CRAFT_QUEUE_REQUIRED:'제작 대기열을 통해 제작해 주세요.',CRAFT_QUEUE_FULL:'제작 대기열 3칸이 모두 사용 중입니다.',CRAFT_JOB_NOT_FOUND:'제작 작업을 찾지 못했습니다.',CRAFT_JOB_CANCELLED:'취소된 제작 작업입니다.',CRAFT_ALREADY_CLAIMED:'이미 수령한 제작 작업입니다.',CRAFT_ALREADY_COMPLETE:'완료된 제작품은 취소할 수 없습니다.',CRAFT_NOT_READY:'제작이 아직 완료되지 않았습니다.'};
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
export const villageLifeAction=(lease:GameplayLease,r:LifeActionRequest)=>rpc<LifeActionResponse>(r.action==='vitality'?'use_vitality_potion':r.action==='craft'?'enqueue_village_craft':'village_life_action',lease,{p_request_id:r.id,p_town_id:r.town,...(r.action==='craft'?{}:{p_action:r.action}),p_item:r.item,p_count:r.count});
export const getVillageCraftQueue=(lease:GameplayLease)=>rpc<CraftQueueSnapshot>('get_village_craft_queue',lease);
export const claimVillageCraft=(lease:GameplayLease,id:string)=>rpc<CraftQueueActionResponse>('claim_village_craft',lease,{p_job_id:id});
export const cancelVillageCraft=(lease:GameplayLease,id:string)=>rpc<CraftQueueActionResponse>('cancel_village_craft',lease,{p_job_id:id});
export const LIFE_MATERIAL_NAMES:Record<LifeMaterial,string>={herb:'약초',pepper:'고추',potato:'감자',wheat:'밀',stone:'분해석'};
export function lifeVitalityAt(s:VillageLifeState,now:number){const value=Math.max(0,Math.floor(s.vitality));if(value>=100||!Number.isFinite(s.recoveredAt))return value;return Math.min(100,value+Math.floor(Math.max(0,now-(s.recoveredAt??now))/300000));}
export function lifeBatchLimit(s:VillageLifeState,resource:LifeResource){const t=s.towns.find(t=>t.id===s.location);if(!t||t.kind!==resource&&t.kind!=='city')return 0;return Math.max(0,Math.min(100,s.vitality,Math.floor((resource==='herb'?t.herbRemaining:t.farmRemaining)/10)));}
export function validGatherRequest(value:unknown):value is GatherRequest{if(!value||typeof value!=='object')return false;const r=value as GatherRequest;return typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&isActiveTownId(r.town)&&(r.resource==='herb'||r.resource==='farm')&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100;}
