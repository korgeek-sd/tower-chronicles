import type {Expedition,GameState} from '../types';
import type {EventMode,ExpeditionEventDefinition,ExpeditionEvents,EventEffect} from './types';
import {EVENT_CATALOG,BOSS_EVENT} from './catalog';
import {DEV_EVENTS} from './fixtures';
import {EVENT_BALANCE,bossChance,selectNormalEvent,selectBossEvent,meetsConditions,eligible} from './selector';
import {random,unit,weighted,type Rng} from './rng';
import {bossIdFor,bossMonsterFor} from '../engine/bossTracking';
import {monsterFor} from '../engine/drops';
import {stats,log} from '../engine/state';
import {leave} from '../engine/expedition';
import {applyEffect,removeEffectById,EFFECTS} from '../engine/effects';
import {tierOf,POTIONS} from '../data/config';
import {advanceSkillTurns} from '../engine/turns';
import {SKILLS} from '../data/config';
import {createMonsterRuntime} from '../engine/monsterAi';
import {clearReactivePrepared,emptyReactivePrepared} from '../engine/reactions';
let defaultMode:EventMode='production';
export function configureEventMode(mode:EventMode){defaultMode=mode;}
export function initialEvents(mode:EventMode=defaultMode):ExpeditionEvents{return {phase:'BATTLE',mode,pendingEvent:null,sequence:0,recentEventIds:[],bossKillCountThisExpedition:0,activeBossId:null};}
export const catalogFor=(mode:EventMode)=>mode==='test'?DEV_EVENTS:EVENT_CATALOG;
export function definitionFor(e:Expedition){const id=e.events.pendingEvent?.eventId;return id===BOSS_EVENT.id?BOSS_EVENT:catalogFor(e.events.mode).find(d=>d.id===id);}
export function beginEncounter(s:GameState,rng:Rng=random,bossId:string|null=null):GameState {const e=s.expedition;if(!e)return s;const monster=bossId?bossMonsterFor(bossId,e.floor):monsterFor(e.tower,e.floor,rng);if(!monster)throw Error('보스 데이터를 찾을 수 없습니다.');e.events.phase='BATTLE';e.events.pendingEvent=null;e.events.activeBossId=bossId;e.monster=monster;e.monsterRuntime=createMonsterRuntime(monster);e.reactivePrepared=emptyReactivePrepared();if(bossId==='black_vein_armor_breaker'){applyEffect(e,'monster','iron_armor','monster',e.monsterTurn);log(s,'[흑맥 갑주] 전투 시작부터 갑주가 활성화됩니다.');}e.phase='PLAYER_TURN';e.playerTurn++;e.pendingFlee=false;e.spawnAt=0;e.playerTimer=0;e.enemyTimer=0;advanceSkillTurns(e,SKILLS.map(k=>k.id));log(s,monster.name+' 등장');return s;}
export function openEvent(s:GameState,definition:ExpeditionEventDefinition,rng:Rng=random,bossId:string|null=null){const e=s.expedition;if(!e||e.events.pendingEvent||!eligible(s,definition))return;const ev=e.events;if(definition.type==='BOSS'){if(!bossId||bossId!==bossIdFor(e.tower,e.floor))return;e.bossTracking.progress=0;e.bossTracking.pendingBossId=null;e.bossTracking.encounterReason=null;}
 ev.phase='EVENT';e.phase='BATTLE_END';e.monsterRuntime=null;clearReactivePrepared(e);ev.pendingEvent={instanceId:'event-'+(ev.sequence=++s.nextId),eventId:definition.id,bossId,state:'CHOICE',choiceId:null,outcomeId:null,resultText:'',resultLines:[],next:'NORMAL',randomValue:unit(rng)};ev.recentEventIds=[definition.id,...ev.recentEventIds].slice(0,EVENT_BALANCE.repeatWindow);log(s,definition.title+' · 선택 대기');}
/** Called once by victory. Boss rolls precede the normal pool and consume progress on appearance. */
export function postBattle(s:GameState,defeatedBoss:boolean,rng:Rng=random):GameState {const e=s.expedition;if(!e||e.events.phase!=='BATTLE')return s;e.events.phase='POST_BATTLE';e.phase='BATTLE_END';e.monsterRuntime=null;clearReactivePrepared(e);if(defeatedBoss){e.events.bossKillCountThisExpedition++;e.events.activeBossId=null;e.bossTracking.bossDefeated=true;e.bossTracking.progress=0;log(s,'보스 처치 · 살아서 귀환하면 클리어가 확정됩니다.');return beginEncounter(s,rng);}
 const bossId=bossIdFor(e.tower,e.floor);if(bossId){e.bossTracking.progress=Math.min(EVENT_BALANCE.bossMaxProgress,e.bossTracking.progress+1);if(unit(rng)<bossChance(e.bossTracking.progress)){const definition=selectBossEvent(s,catalogFor(e.events.mode),rng)??BOSS_EVENT;openEvent(s,definition,rng,bossId);return s;}}
 if(unit(rng)<EVENT_BALANCE.normalChance){const definition=selectNormalEvent(s,catalogFor(e.events.mode),rng);if(definition){openEvent(s,definition,rng);return s;}}
 return beginEncounter(s,rng);
}
function apply(s:GameState,effect:EventEffect,lines:string[]){const e=s.expedition!;switch(effect.kind){
 case 'HEAL_HP':{const before=e.hp;e.hp=Math.min(stats(s,e.equipment).hp,e.hp+Math.floor(stats(s,e.equipment).hp*effect.ratio));lines.push('HP +'+(e.hp-before));break;}
 case 'TAKE_DAMAGE':{const damage=Math.min(e.hp,effect.amount);e.hp-=damage;lines.push('HP -'+damage);break;}
 case 'TAKE_DAMAGE_RATIO':{const raw=Math.floor(stats(s,e.equipment).hp*effect.ratio),damage=Math.min(e.hp,Math.max(effect.minimum??0,raw));e.hp-=damage;lines.push('HP -'+damage);break;}
 case 'ADD_POTION':e.bag[effect.potion]+=effect.amount;lines.push(POTIONS[effect.potion].name+' 포션 +'+effect.amount);break;
 case 'CONSUME_POTION':{const used=Math.min(e.bag[effect.potion],effect.amount);e.bag[effect.potion]-=used;lines.push(POTIONS[effect.potion].name+' 포션 -'+used);break;}
 case 'ADD_EXPEDITION_SILVER':e.loot.silver+=effect.amount;lines.push('Silver +'+effect.amount+' · 원정 임시 보관');break;
 case 'ADD_TEMP_LOOT':{const loot=effect.loot;if(loot.kind==='MATERIAL'){const tower=loot.tower==='CURRENT'?e.tower:loot.tower,tier=loot.tier==='CURRENT'?tierOf(e.floor):loot.tier;e.loot.materials[tower][tier-1]+=loot.amount;lines.push('T'+tier+' 재료 +'+loot.amount+' · 원정 임시 보관');}else{e.loot.items[loot.itemId]=(e.loot.items[loot.itemId]??0)+loot.amount;lines.push('발견물 +'+loot.amount+' · 원정 임시 보관');}break;}
 case 'APPLY_EFFECT':applyEffect(e,'player',effect.effectId,'player',e.playerTurn);{const active=e.playerEffects.find(x=>x.effectId===effect.effectId);if(active)active.scope=effect.scope;}lines.push((EFFECTS[effect.effectId]?.name??effect.effectId)+' 적용');break;
 case 'REMOVE_EFFECT':removeEffectById(e,'player',effect.effectId);lines.push((EFFECTS[effect.effectId]?.name??effect.effectId)+' 해제');break;
 case 'START_BOSS_BATTLE':e.events.pendingEvent!.next='BOSS';break;
 case 'NO_EFFECT':break;
 default:{const exhaustive:never=effect;throw Error(String(exhaustive));}
}}
/** Instance and phase guard: stale clicks and saved RESULT states never pay twice.
 * A persisted random ticket is assigned at appearance, preventing reload rerolls. */
export function resolveEvent(state:GameState,instanceId:string,choiceId:string):GameState {const current=state.expedition,p=current?.events.pendingEvent;if(!current||current.pendingRevival||current.events.phase!=='EVENT'||p?.state!=='CHOICE'||p.instanceId!==instanceId)return state;const definition=definitionFor(current),choice=definition?.choices.find(c=>c.id===choiceId);if(!definition&&choiceId==='missing_skip'){const n=structuredClone(state),ev=n.expedition!.events;ev.phase='EVENT_RESULT';ev.pendingEvent!.state='RESULT';ev.pendingEvent!.choiceId=choiceId;ev.pendingEvent!.resultText='남은 기록을 뒤로하고 탐사를 계속합니다.';return n;}if(!choice||!meetsConditions(state,choice.conditions))return state;if(choice.effects.some(e=>e.kind==='START_BOSS_BATTLE')&&!p.bossId)return state;
 const s=structuredClone(state),e=s.expedition!,pending=e.events.pendingEvent!;pending.state='RESULT';pending.choiceId=choiceId;e.events.phase='EVENT_RESULT';const skipped=choice.behavior==='SKIP';const outcome=skipped?null:weighted(choice.outcomes??[],()=>pending.randomValue);pending.outcomeId=outcome?.id??null;pending.resultText=outcome?.resultText??choice.resultText??'선택한 행동을 마쳤습니다.';const effects=skipped?[]:[...choice.effects,...(outcome?.effects??[])];for(const effect of effects){apply(s,effect,pending.resultLines);if(e.hp<=0)break;}log(s,pending.resultText);pending.resultLines.forEach(line=>log(s,line));if(e.hp<=0){if(e.bag.revival>0){e.pendingRevival={source:'EVENT_DAMAGE',steps:[{kind:'AFTER_EVENT_RESULT'}]};log(s,'치명상 · 부활 포션 사용 여부를 선택하세요.');return s;}return leave(s,true);}return s;}
export function continueEvent(state:GameState,instanceId:string,rng:Rng=random):GameState {const e=state.expedition,p=e?.events.pendingEvent;if(!e||e.pendingRevival||e.events.phase!=='EVENT_RESULT'||p?.state!=='RESULT'||p.instanceId!==instanceId)return state;return beginEncounter(structuredClone(state),rng,p.next==='BOSS'?p.bossId:null);}
/** One compatibility conversion, preserving active bosses and unfinished old encounters. */
export function upgradeEvents(e:Expedition){e.events=initialEvents('production');e.events.bossKillCountThisExpedition=e.bossTracking.bossDefeated?1:0;const pending=e.bossTracking.pendingBossId;const id=bossIdFor(e.tower,e.floor);if(id&&bossMonsterFor(id,e.floor)?.name===e.monster.name&&e.monster.currentHp>0)e.events.activeBossId=id;e.bossTracking.progress=Math.min(EVENT_BALANCE.bossMaxProgress,Math.floor(e.bossTracking.progress/100*EVENT_BALANCE.bossMaxProgress));if(pending){e.events.phase='EVENT';e.phase='BATTLE_END';e.bossTracking.progress=0;e.bossTracking.pendingBossId=null;e.bossTracking.encounterReason=null;e.events.sequence=1;e.events.pendingEvent={instanceId:'event-1',eventId:BOSS_EVENT.id,bossId:pending,state:'CHOICE',choiceId:null,outcomeId:null,resultText:'',resultLines:[],next:'NORMAL',randomValue:0};}}
