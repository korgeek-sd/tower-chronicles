import {getFreshSession} from './auth';
import {getDeviceId,rememberCloudRecord,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';
export interface SkillBookSnapshot{books:Record<string,number>;learned:string[];enhancements?:Record<string,number>;gold?:number;record?:CloudSaveRecord}
export async function skillBooksRpc(lease:GameplayLease,skillId?:string,expectedLevel?:number):Promise<SkillBookSnapshot>{
 if(!supabaseConfig)throw Error('온라인 설정을 불러오지 못했습니다.');
 const session=await getFreshSession();if(!session)throw Error('로그인이 필요합니다.');
 const r=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+(expectedLevel!==undefined?'enhance_catalog_skill':skillId?'learn_catalog_skill':'get_skill_book_state'),{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId(),...(skillId?{p_skill_id:skillId}:{}),...(expectedLevel!==undefined?{p_expected_level:expectedLevel}:{})})});
 const text=await r.text();if(!r.ok){const errors:Record<string,string>={SKILL_BOOK_EMPTY:'스킬북이 부족합니다.',SKILL_UNKNOWN:'등록되지 않은 스킬입니다.',SKILL_NOT_LEARNED:'먼저 스킬을 습득해 주세요.',SKILL_GOLD_EMPTY:'골드가 부족합니다.',SKILL_MAX_ENHANCEMENT:'이미 최대 강화 +3입니다.',SKILL_ENHANCEMENT_STALE:'강화 단계가 변경되었습니다. 현황을 다시 확인해 주세요.',SKILL_EXPEDITION_BLOCKED:'원정 중에는 습득·강화할 수 없습니다.',GAME_SESSION_LOST:'플레이 권한이 변경되었습니다. 다시 접속해 주세요.'};for(const [code,message]of Object.entries(errors))if(text.includes(code))throw Error(message);throw Error('처리 결과를 확인하지 못했습니다. 보유 현황을 다시 확인해 주세요.');}
 if((await getFreshSession())?.userId!==session.userId)throw Error('접속 계정이 변경되었습니다.');
 const result=JSON.parse(text) as SkillBookSnapshot;if(result.record)rememberCloudRecord(result.record,session.userId);return result;
}
