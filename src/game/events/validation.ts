import type {Expedition} from '../types';
import {bossIdFor} from '../engine/bossTracking';
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string');
const compatibleBossId=(tower:unknown,floor:unknown,id:unknown,current:string|null)=>id===current||(tower==='ore'&&floor===10&&id==='mining_ogre');
export function validEventExpedition(value:unknown):value is Expedition|null {if(value===null)return true;if(!obj(value)||!obj(value.events)||!obj(value.bossTracking))return false;const ev=value.events,p=ev.pendingEvent,boss=bossIdFor(value.tower,value.floor);if(!['BATTLE','EVENT','EVENT_RESULT'].includes(ev.phase)||!['production','test'].includes(ev.mode)||!count(ev.sequence)||!count(ev.bossKillCountThisExpedition)||!strings(ev.recentEventIds)||ev.recentEventIds.some(id=>id.length===0)||new Set(ev.recentEventIds).size!==ev.recentEventIds.length||ev.recentEventIds.length>10||!count(value.bossTracking.progress)||value.bossTracking.pendingBossId!==null||value.bossTracking.encounterReason!==null||(ev.activeBossId!==null&&ev.activeBossId!==boss))return false;
 if(!boss&&(value.bossTracking.progress!==0||ev.bossKillCountThisExpedition!==0))return false;
 if(ev.phase==='BATTLE')return p===null&&['PLAYER_TURN','MONSTER_TURN'].includes(value.phase);
 if(value.phase!=='BATTLE_END'||ev.activeBossId!==null||!obj(p)||p.instanceId!=='event-'+ev.sequence||typeof p.eventId!=='string'||!p.eventId||!['CHOICE','RESULT'].includes(p.state)||(p.bossId!==null&&(!boss||!compatibleBossId(value.tower,value.floor,p.bossId,boss)))||typeof p.resultText!=='string'||!strings(p.resultLines)||!['NORMAL','BOSS'].includes(p.next)||typeof p.randomValue!=='number'||!Number.isFinite(p.randomValue)||p.randomValue<0||p.randomValue>=1)return false;
 if(p.next==='BOSS'&&!p.bossId)return false;
 if(p.bossId&&value.bossTracking.progress!==0)return false;
 return ev.phase==='EVENT'?p.state==='CHOICE'&&p.choiceId===null&&p.outcomeId===null&&p.resultLines.length===0&&p.next==='NORMAL':p.state==='RESULT'&&typeof p.choiceId==='string'&&p.choiceId.length>0&&(p.outcomeId===null||typeof p.outcomeId==='string'&&p.outcomeId.length>0);
}
