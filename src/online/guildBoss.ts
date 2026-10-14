import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import {GameSessionLostError,type GameplayLease} from './gameSession';

export type GuildBossKind='DAILY'|'WEEKLY';
export interface GuildBossRank {userId:string;name:string;damage:number;attacks:number}
export interface GuildBossInfo {
 encounterId:string;kind:GuildBossKind;name:string;maxHp:number;remainingHp:number;bossAttack:number;bossDefense:number;
 cycleStart:string;cycleEnd:string;defeatedAt:string|null;attacksUsed:number;attacksLeft:number;
 myDamage:number;participants:number;totalAttacks:number;leaderboard:GuildBossRank[];nextAttackResetAt:string;
}
export interface GuildBossState {associationId:string;serverNow:number;bosses:GuildBossInfo[]}
export interface GuildBossTurn {turn:number;lines:string[];playerHp:number;playerMp:number;damageTotal:number}
export interface GuildBossAttackResult {
 encounterId:string;kind:GuildBossKind;name:string;damage:number;remainingHp:number;maxHp:number;defeated:boolean;
 attacksLeft:number;createdAt:string;combat:{
 damage:number;turns:GuildBossTurn[];playerHp:number;maxPlayerHp:number;playerMp:number;maxPlayerMp:number;
 outcome:'survived'|'defeated';attackStat:number;defenseStat:number;weapon:string;
 };
}
export interface GuildBossAttackResponse {result:GuildBossAttackResult;state:GuildBossState;replayed:boolean}
const failures:Record<string,string>={
 GUILD_BOSS_REQUEST_REQUIRED:'전투 요청 번호가 없습니다.',
 GUILD_BOSS_KIND_INVALID:'보스 종류가 올바르지 않습니다.',
 GUILD_BOSS_REQUEST_CONFLICT:'이전 공격 요청이 다른 보스에 사용되었습니다.',
 GUILD_BOSS_ATTACK_LIMIT:'오늘 공격 횟수 5회를 모두 사용했습니다. 자정에 초기화됩니다.',
 GUILD_BOSS_DEFEATED:'이미 처치한 보스입니다. 다음 보스 등장을 확인하세요.',
 GUILD_BOSS_EXPIRED:'이전 보스전이 종료되었습니다. 새로고침 후 다시 시도하세요.',
 GUILD_BOSS_EXPEDITION_ACTIVE:'원정 진행 중에는 길드 보스를 공격할 수 없습니다.',
 ASSOCIATION_NOT_JOINED:'길드 가입 후 이용할 수 있습니다.',
 CLOUD_SAVE_REQUIRED:'클라우드 저장 데이터를 찾지 못했습니다.',
};
async function rpc<T>(lease:GameplayLease,name:string,body:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 서버 설정을 확인해 주세요.');
 const session=await getFreshSession();if(!session)throw Error('로그인이 필요합니다.');
 const res=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
  body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...body}),
 });
 const raw=await res.text();
 if(!res.ok){
  if(raw.includes('GAME_SESSION_LOST'))throw new GameSessionLostError();
  for(const [code,message] of Object.entries(failures))if(raw.includes(code))throw Error(message);
  throw Error('길드 보스 서버 요청에 실패했습니다. 결과를 확인한 뒤 재시도해 주세요.');
 }
 const next=await getFreshSession();
 if(next?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 return JSON.parse(raw) as T;
}
export const getGuildBossState=(lease:GameplayLease)=>rpc<GuildBossState>(lease,'get_guild_boss_state');
export const attackGuildBoss=(lease:GameplayLease,kind:GuildBossKind,id:string)=>rpc<GuildBossAttackResponse>(lease,'attack_guild_boss',{p_kind:kind,p_request_id:id});
