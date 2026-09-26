import type {GameState,Tower} from '../game/types';
import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

export function applyServerEconomyRecord(local:GameState,record:CloudSaveRecord):GameState{
 const next=structuredClone(local),server=record.payload;
 next.silver=server.silver;
 next.market.gold=server.market.gold;
 next.materials=structuredClone(server.materials);
 next.tickets=structuredClone(server.tickets);
 next.skillBooks=structuredClone(server.skillBooks);
 next.lootItems=structuredClone(server.lootItems);
 next.items=structuredClone(server.items);
 return next;
}

type RpcErrorMap=Record<string,string>;
const errors:RpcErrorMap={
 GAME_SESSION_LOST:'다른 기기에서 플레이가 시작되어 서버 경제 작업 권한이 종료되었습니다.',
 EXPEDITION_TICKET_REQUIRED:'서버에 확인된 입장권이 부족합니다.',
 EXPEDITION_ALREADY_ACTIVE:'이미 진행 중인 서버 원정이 있습니다.',
 EXPEDITION_SERVER_RUN_MISSING:'서버 원정 기록을 찾지 못했습니다.',
 EXPEDITION_LOOT_EXCEEDS_SERVER_CAP:'원정 보상 검증에 실패했습니다.',
 EXPEDITION_KILL_SEQUENCE_INVALID:'서버 원정 처치 순서가 일치하지 않습니다. 동기화 후 다시 시도하세요.',
 EXPEDITION_MONSTER_INVALID:'서버가 처치 몬스터를 확인하지 못했습니다.',
 EXPEDITION_KILL_RATE_INVALID:'비정상적으로 빠른 처치 요청이 감지되었습니다.',
 COMBAT_ACTION_SEQUENCE_INVALID:'서버 전투 행동 순서가 일치하지 않습니다.',
 COMBAT_ACTION_INVALID:'서버가 전투 행동을 확인하지 못했습니다.',
 COMBAT_ACTION_RATE_INVALID:'비정상적으로 빠른 전투 행동이 감지되었습니다.',
 EXPEDITION_KILL_WITHOUT_SERVER_ACTION:'서버가 확인한 공격 행동 없이 처치를 인정할 수 없습니다.',
 CRAFT_MATERIAL_SHORTAGE:'서버에 확인된 제작 재료가 부족합니다.',
 CRAFT_BUSY:'현재 다른 제작이 진행 중입니다.',
 CRAFT_QUEUE_FULL:'제작 대기열이 가득 찼습니다.',
 CRAFT_NOT_CANCELLABLE:'취소할 수 없는 제작 작업입니다.',
 CRAFT_NOT_READY:'아직 서버 제작 시간이 끝나지 않았습니다.',
 CRAFT_NOT_CLAIMABLE:'수령할 수 없는 제작 작업입니다.',
 ENHANCE_SILVER_SHORTAGE:'서버 지갑의 Silver가 부족합니다.',
 ENHANCE_MATERIAL_SHORTAGE:'서버에 확인된 강화 재료가 부족합니다.',
 ENHANCE_ITEM_NOT_FOUND:'서버에 등록된 강화 장비를 찾지 못했습니다.',
 ASSOCIATION_SILVER_SHORTAGE:'서버 지갑의 조합 등록금이 부족합니다.',
};

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

async function rpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body),
 });
 const text=await response.text();
 if(!response.ok){
  for(const [key,message] of Object.entries(errors))if(text.includes(key))throw Error(message);
  try{const parsed=JSON.parse(text) as {message?:string};if(parsed.message)throw Error(parsed.message);}catch(error){if(error instanceof Error&&error.message!==text)throw error;}
  throw Error('서버 경제 요청을 처리하지 못했습니다.');
 }
 return (text?JSON.parse(text):null) as T;
}

const leaseArgs=(lease:GameplayLease)=>({
 p_lease_id:lease.leaseId,
 p_generation:lease.generation,
 p_client_instance_id:lease.clientInstanceId,
 p_device_id:getDeviceId(),
});

async function remember(record:CloudSaveRecord){
 const session=await getFreshSession();
 if(session)rememberCloudRecord(record,session.userId);
 return record;
}

export async function startOnlineExpedition(lease:GameplayLease,tower:Tower,floor:number,payload:GameState){
 const record=await rpc<CloudSaveRecord>('start_online_expedition',{...leaseArgs(lease),p_tower:tower,p_floor:floor,p_client_payload:payload});
 return remember(record);
}

export interface OnlineCombatState {pendingRevival?:boolean;playerShield?:number;monsterShield?:number;periodicPlayer?:number;periodicMonster?:number;absorbed?:number;healing?:number;encounterIndex:number;monsterId:string;playerHp:number;playerMaxHp?:number;monsterHp:number;monsterMaxHp?:number;turn?:number;phase:'PLAYER_TURN'|'MONSTER_TURN'|'DEFEATED'|'PLAYER_DEAD';actionNonce:number;confirmedKills?:number;damage?:number;retaliation?:number}
export async function beginOnlineCombatState(lease:GameplayLease){
 return rpc<OnlineCombatState>('begin_online_combat_state_v2',{...leaseArgs(lease)});
}
export async function applyOnlineBasicAttack(lease:GameplayLease,actionNonce:number){
 return rpc<OnlineCombatState>('apply_online_basic_attack',{...leaseArgs(lease),p_action_nonce:actionNonce,p_attack:null});
}
export async function applyOnlineSkill(lease:GameplayLease,actionNonce:number,skillId:string){
 return rpc<OnlineCombatState>('apply_online_skill',{...leaseArgs(lease),p_action_nonce:actionNonce,p_skill_id:skillId});
}
export async function applyOnlinePotion(lease:GameplayLease,actionNonce:number,potion:string){
 return rpc<OnlineCombatState>('apply_online_potion',{...leaseArgs(lease),p_action_nonce:actionNonce,p_potion:potion});
}

export async function resolveOnlineRevival(lease:GameplayLease,use:boolean){
 return rpc<OnlineCombatState>('resolve_online_revival',{...leaseArgs(lease),p_use:use});
}

export type OnlineCombatActionKind='BASIC'|'SKILL'|'POTION'|'FLEE'|'REVIVAL';
export async function recordOnlineCombatAction(lease:GameplayLease,actionIndex:number,kind:OnlineCombatActionKind,ref?:string){
 return rpc<{confirmedActions:number}>('record_online_combat_action',{...leaseArgs(lease),p_action_index:actionIndex,p_action_kind:kind,p_action_ref:ref??null});
}

export async function confirmOnlineExpeditionKill(lease:GameplayLease,monsterId:string,killIndex:number){
 return rpc<{confirmedKills:number}>('confirm_online_expedition_kill',{...leaseArgs(lease),p_monster_id:monsterId,p_client_kill_index:killIndex});
}

export async function settleOnlineExpedition(lease:GameplayLease,payload:GameState){
 const outcome=payload.lastExpedition?.outcome;
 if(outcome!=='returned'&&outcome!=='dead')throw Error('원정 종료 결과를 확인할 수 없습니다.');
 const record=await rpc<CloudSaveRecord>('settle_online_expedition_v2',{...leaseArgs(lease),p_outcome:outcome,p_client_payload:payload});
 return remember(record);
}

export async function startOnlineCraft(lease:GameplayLease,input:{jobId:string;kind:string;tier:number;quantity:number}){
 const result=await rpc<{jobId:string;materialCost:number;readyAt:number;record:CloudSaveRecord}>('start_online_craft',{
  ...leaseArgs(lease),p_job_id:input.jobId,p_kind:input.kind,p_tier:input.tier,p_quantity:input.quantity,
 });
 await remember(result.record);
 return result;
}

export async function cancelOnlineCraft(lease:GameplayLease,jobId:string){
 const result=await rpc<{record:CloudSaveRecord}>('cancel_online_craft',{...leaseArgs(lease),p_job_id:jobId});
 await remember(result.record);
 return result;
}

export async function claimOnlineCraft(lease:GameplayLease,jobId:string,itemId:string|null){
 const result=await rpc<{record:CloudSaveRecord;itemId:string|null}>('claim_online_craft',{
  ...leaseArgs(lease),p_job_id:jobId,p_item_id:itemId,
 });
 await remember(result.record);
 return result;
}

export type ServerEnhancementOutcome='SUCCESS'|'FAIL_KEEP'|'FAIL_DOWNGRADE'|'FAIL_DESTROYED';
export async function enhanceOnlineEquipment(lease:GameplayLease,itemId:string){
 const result=await rpc<{outcome:ServerEnhancementOutcome;record:CloudSaveRecord}>('enhance_online_equipment',{
  ...leaseArgs(lease),p_item_id:itemId,
 });
 await remember(result.record);
 return result;
}

export async function spendOnlineAssociationFee(lease:GameplayLease){
 const result=await rpc<{record:CloudSaveRecord}>('spend_online_association_fee',leaseArgs(lease));
 await remember(result.record);
 return result.record;
}
