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
 EXPEDITION_VERSION_CONFLICT:'서버 원정 상태가 변경되었습니다. 최신 상태를 다시 불러옵니다.',
 EXPEDITION_EVENT_MISSING:'서버 이벤트 기록을 찾지 못했습니다.',
 EXPEDITION_EVENT_CHOICE_INVALID:'선택할 수 없는 이벤트 행동입니다.',
 RESOURCE_STRONGHOLD_ALREADY_ACTIVE:'이미 점령 중인 자원거점이 있습니다.',
 RESOURCE_STRONGHOLD_NOT_ACTIVE:'진행 중인 자원거점 점령이 없습니다.',
 RESOURCE_STRONGHOLD_NOT_READY:'아직 자원거점 점령 시간이 끝나지 않았습니다.',
 RESOURCE_STRONGHOLD_ACTIVE:'자원거점 점령을 완료하거나 포기한 뒤 귀환할 수 있습니다.',
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

export interface OnlineCombatState {fled?:boolean;jobId?:string|null;jobResource?:number;stateVersion?:number;playerEffects?:unknown[];monsterEffects?:unknown[];playerCooldowns?:Record<string,number>;jobFlags?:Record<string,boolean>;playerTurn?:number;monsterTurn?:number;playerShieldHits?:number;monsterShieldHits?:number;pendingRevival?:boolean;monsterAction?:{kind:string;id:string;effect?:string;multiplier?:number;prepared?:boolean};playerShield?:number;monsterShield?:number;periodicPlayer?:number;periodicMonster?:number;absorbed?:number;healing?:number;encounterIndex:number;monsterId:string;playerHp:number;playerMaxHp?:number;monsterHp:number;monsterMaxHp?:number;turn?:number;phase:'PLAYER_TURN'|'MONSTER_TURN'|'DEFEATED'|'PLAYER_DEAD';actionNonce:number;confirmedKills?:number;damage?:number;retaliation?:number;drop?:{silver?:number;material?:number;tickets?:number}|null}
export async function beginOnlineCombatState(lease:GameplayLease){
 return rpc<OnlineCombatState>('begin_online_combat_state_v2',{...leaseArgs(lease)});
}
export async function applyOnlineBasicAttack(lease:GameplayLease,actionNonce:number){
 return rpc<OnlineCombatState>('apply_online_basic_attack',{...leaseArgs(lease),p_action_nonce:actionNonce,p_attack:null});
}
export async function applyOnlineSkill(lease:GameplayLease,actionNonce:number,skillId:string){
 return rpc<OnlineCombatState>('apply_online_skill',{...leaseArgs(lease),p_action_nonce:actionNonce,p_skill_id:skillId});
}
export async function applyOnlineJobSkill(lease:GameplayLease,actionNonce:number,skillId:string){
 return rpc<OnlineCombatState>('apply_online_job_skill',{...leaseArgs(lease),p_action_nonce:actionNonce,p_skill_id:skillId});
}
export async function applyOnlineFlee(lease:GameplayLease,actionNonce:number){
 return rpc<OnlineCombatState>('apply_online_flee',{...leaseArgs(lease),p_action_nonce:actionNonce});
}
export async function applyOnlinePotion(lease:GameplayLease,actionNonce:number,potion:string){
 return rpc<OnlineCombatState>('apply_online_potion',{...leaseArgs(lease),p_action_nonce:actionNonce,p_potion:potion});
}

export async function resolveOnlineRevival(lease:GameplayLease,use:boolean){
 return rpc<OnlineCombatState>('resolve_online_revival',{...leaseArgs(lease),p_use:use});
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

export function reconcileOnlineCombatState(local:GameState,server:OnlineCombatState):GameState{
 const next=structuredClone(local),e=next.expedition;if(!e)return next;
 e.hp=server.playerHp;
 if(server.monsterId)e.monster.definitionId=server.monsterId;
 e.monster.currentHp=server.monsterHp;
 if(server.monsterMaxHp)e.monster.hp=server.monsterMaxHp;
 e.phase=server.phase==='MONSTER_TURN'?'MONSTER_TURN':'PLAYER_TURN';
 if(server.pendingRevival&&e.hp<=0&&!e.pendingRevival)e.pendingRevival={source:'DIRECT_HIT',steps:[]};
 if(!server.pendingRevival)e.pendingRevival=null;
 if(typeof server.jobId==='string'||server.jobId===null){e.jobSnapshotId=server.jobId??null;e.jobRuntime.jobId=server.jobId??null;}
 if(e.jobRuntime.resource&&typeof server.jobResource==='number')e.jobRuntime.resource.value=server.jobResource;
 if(server.jobFlags)e.jobRuntime.flags={...server.jobFlags};
 if(server.playerCooldowns)e.cooldowns=Object.fromEntries(Object.entries(server.playerCooldowns).map(([key,value])=>[key.replace(/^turn:/,''),value]));
 if(typeof server.playerTurn==='number')e.playerTurn=server.playerTurn;
 if(typeof server.monsterTurn==='number')e.monsterTurn=server.monsterTurn;
 if(Array.isArray(server.playerEffects))e.playerEffects=structuredClone(server.playerEffects) as typeof e.playerEffects;
 if(Array.isArray(server.monsterEffects))e.monsterEffects=structuredClone(server.monsterEffects) as typeof e.monsterEffects;
 if(server.phase==='DEFEATED')e.monster.currentHp=0;
 return next;
}

export interface OnlineExplorationEvent {id:string;bossId?:string;selectionTicket?:number;outcomeTicket?:number}
export interface OnlineStronghold {instanceId:string;status:string;tower:Tower;floor:number;version:number;captureStartedAt:string;captureEndsAt:string;reward:{tower:Tower;tier:number;materialAmount:number;silver:number}}
export interface OnlineExplorationState {kind:'MONSTER'|'BOSS'|'EVENT';profile?:{id:string;hpMultiplier:number;attackMultiplier:number;defenseBonus?:number};event?:OnlineExplorationEvent;encounterIndex?:number;bossProgress?:number;runVersion:number}
export async function advanceOnlineExploration(lease:GameplayLease,expectedVersion:number){return rpc<OnlineExplorationState>('advance_online_exploration',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function resolveOnlineExplorationEvent(lease:GameplayLease,expectedVersion:number,choice:string){return rpc<{eventId:string;choiceId:string;outcomeId?:string|null;playerHp?:number;temporaryLoot?:unknown;next?:'NORMAL'|'BOSS';bossId?:string|null;pendingRevival?:boolean;runVersion:number}>('resolve_online_exploration_event',{...leaseArgs(lease),p_expected_version:expectedVersion,p_choice:choice});}
export async function claimOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{stronghold:OnlineStronghold;runVersion:number}>('claim_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function settleOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{reward:OnlineStronghold['reward'];stronghold:OnlineStronghold;temporaryLoot:unknown;runVersion:number}>('settle_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function abandonOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{stronghold:OnlineStronghold;runVersion:number}>('abandon_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export interface RestoredOnlineExpedition {active:boolean;run?:{runId:string;tower:Tower;floor:number;confirmedKills:number;encounterIndex:number;bossProgress:number;bossDefeated:boolean;pendingEvent:OnlineExplorationEvent|null;temporaryLoot:unknown;stronghold:OnlineStronghold|null;runVersion:number;potions:Record<string,number>};combat?:Record<string,unknown>|null}
export async function restoreOnlineExpedition(lease:GameplayLease){return rpc<RestoredOnlineExpedition>('restore_online_expedition',leaseArgs(lease));}
