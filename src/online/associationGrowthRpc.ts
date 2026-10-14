import {getFreshSession} from './auth';
import {getDeviceId} from './cloudSave';
import {supabaseConfig} from './config';
import {GameSessionLostError,type GameplayLease} from './gameSession';

export const associationLeaseArgs=(lease:GameplayLease)=>({p_lease_id:lease.leaseId,p_generation:lease.generation,p_client_instance_id:lease.clientInstanceId,p_device_id:getDeviceId()});

export function associationGrowthError(raw:string){
 const messages:Record<string,string>={
  ASSOCIATION_NOT_JOINED:'소속 원정단이 없습니다.',
  ASSOCIATION_DONATION_INVALID:'실버는 10,000, 골드는 100, 도전권은 1장 단위로 기부해 주세요.',
  ASSOCIATION_DONATION_LIMIT:'오늘 기부 한도에 도달했습니다. (도전권 최대 100장)',
  ASSOCIATION_BALANCE_SHORTAGE:'기부할 재화가 부족합니다.',
  ASSOCIATION_CONTRIBUTION_SHORTAGE:'공헌도가 부족합니다.',
  ASSOCIATION_PURCHASE_LIMIT:'이번 기간의 구매 한도에 도달했습니다.',
  ASSOCIATION_LEVEL_REQUIRED:'원정단 레벨이 부족합니다.',
  ASSOCIATION_DURING_EXPEDITION:'안전 귀환 후 이용할 수 있습니다.',
  ASSOCIATION_TICKET_SHORTAGE:'직능 뽑기권이 부족합니다.',
  ASSOCIATION_ITEM_NOT_FOUND:'판매 중인 상품을 찾을 수 없습니다.',
  ASSOCIATION_REQUEST_CONFLICT:'이미 처리된 요청입니다. 상태를 새로 확인해 주세요.',
  GUILD_AUCTION_INVALID_BID:'입찰 금액 또는 요청값이 올바르지 않습니다.',
  GUILD_AUCTION_REQUEST_CONFLICT:'이전 입찰 요청과 금액이 다릅니다. 경매를 새로 확인해 주세요.',
  GUILD_AUCTION_BID_TOO_LOW:'최소 입찰 금액 이상으로 입력해 주세요.',
  GUILD_AUCTION_CLOSED:'종료되었거나 이용할 수 없는 경매입니다.',
  GUILD_AUCTION_NOT_WINNER:'경매가 아직 진행 중이거나 낙찰 대상이 아닙니다.',
  GUILD_BOSS_REWARD_UNAVAILABLE:'아직 처치되지 않았거나 수령할 수 없는 보상입니다.',
  GUILD_BOSS_REWARD_NOT_ELIGIBLE:'해당 보스전 참여 기록이 없어 보상을 받을 수 없습니다.',
  GUILD_BOSS_EXPEDITION_ACTIVE:'원정 중에는 보상 또는 장비를 수령할 수 없습니다.',

 };
 for(const [code,message] of Object.entries(messages))if(raw.includes(code))return message;
 return '원정단 요청에 실패했습니다. 다시 시도해 주세요.';
}

export async function associationGrowthRpc<T>(name:string,body:Record<string,unknown>):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:supabaseConfig.publishableKey,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const raw=await response.text();
 if(!response.ok){if(raw.includes('GAME_SESSION_LOST'))throw new GameSessionLostError();throw Error(associationGrowthError(raw));}
 return JSON.parse(raw) as T;
}
