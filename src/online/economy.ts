import type {ActiveEffect,GameState,Tower} from '../game/types';
import type {PendingExpeditionEvent} from '../game/events/types';
import {tierOf} from '../game/data/config';
import {bestiaryEntryById} from '../game/data/bestiary';
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

export interface OnlineCombatState {fled?:boolean;returnAuthorized?:boolean;runVersion?:number;turnNo?:number;monsterAttack?:number;monsterDefense?:number;monsterCooldowns?:Record<string,number>;monsterPreparedAction?:string|null;monsterReactiveAction?:string|null;jobId?:string|null;jobResource?:number;stateVersion?:number;playerEffects?:unknown[];monsterEffects?:unknown[];playerCooldowns?:Record<string,number>;jobFlags?:Record<string,boolean>;playerTurn?:number;monsterTurn?:number;playerShieldHits?:number;monsterShieldHits?:number;pendingRevival?:boolean;monsterAction?:{kind:string;id:string;effect?:string;multiplier?:number;prepared?:boolean};playerShield?:number;monsterShield?:number;periodicPlayer?:number;periodicMonster?:number;absorbed?:number;healing?:number;encounterIndex:number;monsterId:string;playerHp:number;playerMaxHp?:number;monsterHp:number;monsterMaxHp?:number;turn?:number;phase:'PLAYER_TURN'|'MONSTER_TURN'|'DEFEATED'|'PLAYER_DEAD';actionNonce:number;confirmedKills?:number;damage?:number;retaliation?:number;drop?:{silver?:number;material?:number;tickets?:number}|null}
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
 if(server.playerCooldowns)e.cooldowns={...server.playerCooldowns};
 if(typeof server.playerTurn==='number')e.playerTurn=server.playerTurn;
 if(typeof server.monsterTurn==='number')e.monsterTurn=server.monsterTurn;
 const normalizeEffects=(raw:unknown[]|undefined,target:'player'|'monster'):ActiveEffect[]=>Array.isArray(raw)?raw.flatMap((value,index)=>{const x=value as Record<string,unknown>,effectId=typeof x.effectId==='string'?x.effectId:'';if(!effectId)return [];const remaining=Number(x.remainingDuration??x.duration??0),stacks=Number(x.stackCount??x.stacks??1),sequence=Number(x.applicationSequence??index+1),created=Number(x.createdTurn??0),effect:ActiveEffect={instanceId:typeof x.instanceId==='string'?x.instanceId:`server-${target}-${sequence}`,effectId,sourceActorId:target,targetActorId:target,remainingDuration:Math.max(0,remaining),stackCount:Math.max(1,stacks),applicationSequence:Math.max(1,sequence),createdTurn:Math.max(0,created),scope:x.scope==='EXPEDITION'?'EXPEDITION':'BATTLE'};if(typeof x.currentShield==='number')effect.currentShield=x.currentShield;if(typeof x.currentShieldHits==='number')effect.currentShieldHits=x.currentShieldHits;return [effect];}):[];
 if(Array.isArray(server.playerEffects))e.playerEffects=normalizeEffects(server.playerEffects,'player');
 if(Array.isArray(server.monsterEffects))e.monsterEffects=normalizeEffects(server.monsterEffects,'monster');
 e.effectSequence=Math.max(e.effectSequence,...e.playerEffects.map(x=>x.applicationSequence),...e.monsterEffects.map(x=>x.applicationSequence));
 if(typeof server.monsterAttack==='number')e.monster.attack=server.monsterAttack;
 if(typeof server.monsterDefense==='number')e.monster.defense=server.monsterDefense;
 const entry=server.monsterId?bestiaryEntryById(server.monsterId):undefined;if(entry)e.monster.name=entry.name;
 if(server.monsterId)e.monsterRuntime={definitionId:server.monsterId,skillCooldowns:{...(server.monsterCooldowns??{})},preparedActionId:server.monsterPreparedAction??null,turnNumber:server.monsterTurn??e.monsterTurn};
 e.phase=server.phase==='PLAYER_TURN'?'PLAYER_TURN':server.phase==='MONSTER_TURN'?'MONSTER_TURN':'BATTLE_END';
 if(server.phase==='DEFEATED')e.monster.currentHp=0;
 return next;
}

export interface OnlineExplorationEvent {id?:string;instanceId:string;eventId:string;bossId:string|null;state:'CHOICE'|'RESULT';choiceId:string|null;outcomeId:string|null;resultText:string;resultLines:string[];next:'NORMAL'|'BOSS';randomValue:number;selectionTicket?:number|null;outcomeTicket?:number|null;expiresAt?:number|null}
export interface OnlineStronghold {instanceId:string;status:string;tower:Tower;floor:number;version:number;captureStartedAt:string;captureEndsAt:string;reward:{tower:Tower;tier:number;materialAmount:number;silver:number}}
export interface OnlineExplorationState {kind:'MONSTER'|'BOSS'|'EVENT';profile?:{id:string;hpMultiplier:number;attackMultiplier:number;defenseBonus?:number};event?:OnlineExplorationEvent;encounterIndex?:number;bossProgress?:number;runVersion:number}
export async function advanceOnlineExploration(lease:GameplayLease,expectedVersion:number){return rpc<OnlineExplorationState>('advance_online_exploration',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function resolveOnlineExplorationEvent(lease:GameplayLease,expectedVersion:number,choice:string){return rpc<{eventId:string;choiceId:string;outcomeId?:string|null;playerHp?:number;temporaryLoot?:unknown;next?:'NORMAL'|'BOSS';bossId?:string|null;pendingRevival?:boolean;runVersion:number}>('resolve_online_exploration_event',{...leaseArgs(lease),p_expected_version:expectedVersion,p_choice:choice});}
export async function claimOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{stronghold:OnlineStronghold;runVersion:number}>('claim_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function settleOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{reward:OnlineStronghold['reward'];stronghold:OnlineStronghold;temporaryLoot:unknown;runVersion:number}>('settle_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export async function abandonOnlineResourceStronghold(lease:GameplayLease,expectedVersion:number){return rpc<{stronghold:OnlineStronghold;runVersion:number}>('abandon_online_resource_stronghold',{...leaseArgs(lease),p_expected_version:expectedVersion});}
export interface OnlineTemporaryLoot {silver?:number;material?:number;tickets?:number}
export interface RestoredOnlineExpedition {active:boolean;run?:{runId:string;tower:Tower;floor:number;confirmedKills:number;encounterIndex:number;bossProgress:number;bossDefeated:boolean;pendingEvent:OnlineExplorationEvent|null;temporaryLoot:OnlineTemporaryLoot;stronghold:OnlineStronghold|null;runVersion:number;potions:Record<string,number>};combat?:Partial<OnlineCombatState>|null}
export async function restoreOnlineExpedition(lease:GameplayLease){return rpc<RestoredOnlineExpedition>('restore_online_expedition',leaseArgs(lease));}
export function reconcileOnlineExpeditionState(local:GameState,restored:RestoredOnlineExpedition):GameState{
 const run=restored.run;if(!restored.active||!run)return local;let next=structuredClone(local),e=next.expedition;if(!e)return next;
 const combat=restored.combat;if(combat&&typeof combat.playerHp==='number'&&typeof combat.monsterHp==='number'&&typeof combat.monsterId==='string'&&typeof combat.phase==='string')next=reconcileOnlineCombatState(next,{...combat,encounterIndex:combat.encounterIndex??run.encounterIndex,actionNonce:combat.actionNonce??0} as OnlineCombatState);
 e=next.expedition!;e.tower=run.tower;e.floor=run.floor;e.kills=run.confirmedKills;e.bossTracking.progress=run.bossProgress;e.bossTracking.bossDefeated=run.bossDefeated;
 const p=run.potions;e.bag.healing_lesser=p.lesser??e.bag.healing_lesser;e.bag.healing_standard=p.standard??e.bag.healing_standard;e.bag.healing_greater=p.greater??e.bag.healing_greater;e.bag.healing_supreme=p.supreme??e.bag.healing_supreme;e.bag.revival=p.revival??e.bag.revival;
 const pending=run.pendingEvent;if(pending){e.events.pendingEvent=structuredClone(pending) as PendingExpeditionEvent;e.events.phase=pending.state==='RESULT'?'EVENT_RESULT':'EVENT';e.phase='BATTLE_END';e.bossTracking.pendingBossId=pending.bossId??null;}else{e.events.pendingEvent=null;e.events.phase='BATTLE';e.bossTracking.pendingBossId=null;}
 const activeMonsterId=typeof combat?.monsterId==='string'?combat.monsterId:e.monster.definitionId??'';const entry=activeMonsterId?bestiaryEntryById(activeMonsterId):undefined;e.events.activeBossId=entry?.boss?activeMonsterId:null;
 const loot=run.temporaryLoot??{};e.loot.silver=Math.max(0,Number(loot.silver??0));for(const t of Object.keys(e.loot.materials) as Tower[])e.loot.materials[t]=e.loot.materials[t].map(()=>0);for(const t of Object.keys(e.loot.tickets) as Tower[])e.loot.tickets[t]=e.loot.tickets[t].map(()=>0);e.loot.skillBooks={};e.loot.items={};e.loot.materials[e.tower][tierOf(e.floor)-1]=Math.max(0,Number(loot.material??0));if(e.floor<e.loot.tickets[e.tower].length)e.loot.tickets[e.tower][e.floor]=Math.max(0,Number(loot.tickets??0));
 const sh=run.stronghold;if(sh)e.events.stronghold={instanceId:sh.instanceId,status:sh.status as any,ownerUserId:next.market.ownerId,tower:sh.tower,floor:sh.floor,version:sh.version,captureStartedAt:new Date(sh.captureStartedAt).getTime(),captureEndsAt:new Date(sh.captureEndsAt).getTime(),reward:sh.reward,contestedByUserId:null,contestRemainingMs:null,completedAt:null,abandonedAt:null,deletedAt:sh.status==='DELETED'?Date.now():null};else e.events.stronghold=null;
 return next;
}
