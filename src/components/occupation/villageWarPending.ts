import type {VillageWarStageRequest} from '../../online/villageWar';
export const villageWarPendingKey=(userId:string)=>'tower-village-war-stage-one:'+userId;
export function validVillageWarPending(value:unknown,userId:string):value is VillageWarStageRequest{
 if(!value||typeof value!=='object')return false;const r=value as VillageWarStageRequest;
 return typeof r.eventId==='string'&&/^[0-9a-f-]{36}$/i.test(r.eventId)&&r.userId===userId&&typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&typeof r.townId==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(r.townId)&&Number.isInteger(r.frontId)&&r.frontId>=1&&r.frontId<=5&&Number.isSafeInteger(r.expectedEpoch)&&r.expectedEpoch>=0&&['PLACE','REMOVE','CLAIM_EMPTY','ATTACK'].includes(r.action);
}

export const retainVillageWarPending=(code:string|undefined)=>!!code&&['WAR_REQUEST_BUSY','WAR_EVENT_BUSY','WAR_ACTOR_BUSY','WAR_FRONT_BUSY'].includes(code);
