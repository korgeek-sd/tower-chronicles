import {supabaseConfig} from './config';
import {getFreshSession} from './auth';

export type WebsocketKind='session'|'market';
export type MonitorSeverity='NORMAL'|'WARNING'|'CRITICAL';

export interface MonitorSnapshot {
 captured_at:string;
 interval_seconds:number;
 db_calls_per_min:number|string;
 realtime_messages_per_min:number|string;
 websocket_connections:number;
 save_writes_per_min:number|string;
 active_game_sessions:number;
 severity:MonitorSeverity;
 alerts:unknown[];
}
export interface MonitorAlert {
 metric:string;
 active:boolean;
 severity:MonitorSeverity;
 current_value:number|string;
 threshold_value:number|string;
 baseline_value:number|string;
 first_seen_at:string|null;
 last_seen_at:string|null;
 occurrences:number;
}
export interface SystemMonitoring {
 latest:MonitorSnapshot|null;
 history:MonitorSnapshot[];
 activeAlerts:MonitorAlert[];
}

const headers=(token:string)=>({
 apikey:supabaseConfig!.publishableKey,
 Authorization:'Bearer '+token,
 'Content-Type':'application/json',
});

async function rpc<T>(name:string,body:Record<string,unknown>={}):Promise<T>{
 if(!supabaseConfig)throw Error('Supabase 공개 설정이 필요합니다.');
 const session=await getFreshSession();
 if(!session)throw Error('Google 로그인이 필요합니다.');
 const response=await fetch(supabaseConfig.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:headers(session.accessToken),body:JSON.stringify(body),
 });
 const raw=await response.text();
 if(!response.ok){
  if(raw.includes('MONITORING_FORBIDDEN'))throw Error('MONITORING_FORBIDDEN');
  return Promise.reject(new Error('모니터링 요청을 처리하지 못했습니다.'));
 }
 return (raw?JSON.parse(raw):null) as T;
}

export const setWebsocketPresence=(
 kind:WebsocketKind,
 clientInstanceId:string,
 platform:string,
 connected:boolean,
)=>rpc<boolean>('set_websocket_presence',{
 p_client_instance_id:clientInstanceId,
 p_socket_kind:kind,
 p_platform:platform,
 p_connected:connected,
});

export const loadSystemMonitoring=()=>rpc<SystemMonitoring>('get_system_monitoring');
