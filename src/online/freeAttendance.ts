import {getFreshSession} from './auth';
import {getDeviceId,type CloudSaveRecord} from './cloudSave';
import {supabaseConfig} from './config';
import type {GameplayLease} from './gameSession';

/** Free rewards are defined and granted exclusively by the server. */
export interface FreeAttendanceStatus {
 todayKst:string;
 cycleStartKst:string;
 cycleNumber:number;
 currentDay:number;
 claimedDays:number[];
 todayClaimed:boolean;
}
export interface FreeAttendanceClaim {
 alreadyClaimed:boolean;
 reward:{silver:number;tickets:number};
 status:FreeAttendanceStatus;
 record:CloudSaveRecord;
}

const errors:Record<string,string>={
 GAME_SESSION_LOST:'현재 기기의 플레이 권한이 종료되었습니다.',
 CLOUD_SAVE_REQUIRED:'클라우드 저장을 먼저 완료해 주세요.',
 SERVER_WALLET_REQUIRED:'서버 지갑을 불러오지 못했습니다.',
 ATTENDANCE_DAY_INVALID:'출석 일자를 확인하지 못했습니다.',
 AUTH_REQUIRED:'Google 로그인 후 출석 보상을 받을 수 있습니다.',
 AUTH_SESSION_INVALID:'로그인 세션이 만료되었습니다.',
};

async function attendanceRpc<T>(name:'get_free_attendance_status'|'claim_free_attendance',lease:GameplayLease,userId:string):Promise<T>{
 if(!supabaseConfig)throw Error('온라인 서버 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session||session.userId!==userId)throw Error('Google 로그인 상태를 확인해 주세요.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',cache:'no-store',
  headers:{
   apikey:supabaseConfig.publishableKey,
   Authorization:'Bearer '+session.accessToken,
   'Content-Type':'application/json',
  },
  body:JSON.stringify({
   p_lease_id:lease.leaseId,
   p_generation:lease.generation,
   p_client_instance_id:lease.clientInstanceId,
   p_device_id:getDeviceId(),
  }),
 });
 const body=await response.text();
 if(!response.ok){
  for(const [code,message] of Object.entries(errors))if(body.includes(code))throw Error(message);
  throw Error('출석 서버 응답을 확인하지 못했습니다.');
 }
 if((await getFreshSession())?.userId!==userId)throw Error('로그인 계정이 변경되었습니다.');
 return JSON.parse(body) as T;
}

export function getFreeAttendanceStatus(lease:GameplayLease,userId:string){
 return attendanceRpc<FreeAttendanceStatus>('get_free_attendance_status',lease,userId);
}
export function claimFreeAttendance(lease:GameplayLease,userId:string){
 return attendanceRpc<FreeAttendanceClaim>('claim_free_attendance',lease,userId);
}
