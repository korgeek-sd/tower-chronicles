import {combatRuntime,resetCombatRuntime} from './battleLifecycle';
import {applyHealing,decayPlayerOverheal,periodicTicks} from './healing';
import {resourceCost,grantBasicAttackResource} from './combatResource';
import {setSkillCooldown} from './cooldowns';
import {advanceSkillTurns,skillTurnsLeft} from './turns';
import type {CombatContinuationStep,GameState,GeneralPotion,Potion} from '../types';
import {COMBAT,SKILLS,POTIONS,CONFIG,WEAPONS} from '../data/config';
import {stats,weaponOf,equippedItem,log} from './state';
import {reward} from './drops';
import {leave} from './expedition';
import {postBattle} from '../events/service';
import {random} from '../events/rng';
import {cleanseEffects,removeEffectById,EFFECTS,isStunned,isSilenced,isRooted,applyEffect,applyIncomingDamage,clearBattleEffects,expireTurnEffects,modifier,periodicDelta} from './effects';
import {resolveBattleJobId} from '../jobs/service';
import {jobById} from '../jobs/catalog';
import {getJobCombatDefinition} from '../jobs/framework';
import {evaluateJobCondition,executeJobSkill,resolveJobDirectHitMultiplier,runJobHook} from '../jobs/resolver';
import {initFiveJobCombatDefinitions} from '../jobs/definitions';

initFiveJobCombatDefinitions();
import {advanceMonsterPhase,beginMonsterTurn,chooseMonsterAction,createMonsterRuntime,definitionForRuntime,useMonsterAction} from './monsterAi';
import {directHitLog,resolveActorDirectHits,resolveMonsterAction} from './monsterSkills';
import {clearReactivePrepared} from './reactions';
import {recordBestiaryDefeat} from './bestiary';
import {accessoryPassive} from './equipmentStats';

export {damage} from './damage';
const skillById=(id:string)=>SKILLS.find(skill=>skill.id===id);
function heal(s:GameState,amount:number){applyHealing(s,'player',amount,{canCrit:false});}
function startPlayerTurn(s:GameState,rng:()=>number=random):GameState{const e=s.expedition!;e.phase='PLAYER_TURN';e.playerTurn++;e.pendingFlee=false;for(const key of Object.keys(e.buffs)){e.buffs[key]=Math.max(0,e.buffs[key]-1);if(e.buffs[key]===0)delete e.buffs[key];}advanceSkillTurns(e,SKILLS.map(skill=>skill.id));if(isStunned(e,'player')){log(s,'기절 · 플레이어 턴을 넘깁니다.');return finishPlayerTurn(s,rng);}return s;}
function defeatMonster(s:GameState,rng:()=>number){const e=s.expedition!;e.monster.currentHp=0;e.monsterRuntime=null;clearReactivePrepared(e);const defeatedBoss=e.events.activeBossId!==null,wasFlee=e.pendingFlee;recordBestiaryDefeat(s,e.monster);reward(s,rng);resetCombatRuntime(e,stats(s,e.equipment).hp);if(wasFlee){if(defeatedBoss){e.bossTracking.bossDefeated=true;e.events.bossKillCountThisExpedition++;}return leave(s);}return postBattle(s,defeatedBoss,rng);}
function canOfferRevival(s:GameState){const e=s.expedition;return !!e&&e.bag.revival>0&&!e.pendingRevival;}
function applyTurnPeriodic(s:GameState,actor:'player'|'monster',rng:()=>number){
 const e=s.expedition!,turn=actor==='player'?e.playerTurn:e.monsterTurn,maxHp=actor==='player'?stats(s,e.equipment).hp:e.monster.hp;
 const ticks=periodicTicks(e,actor,turn);
 for(const {effect,definition} of ticks){
  if(definition.behavior!=='PERIODIC_DAMAGE')continue;
  const amount=(definition.payload?.amount??0)*effect.stackCount;
  if(actor==='player')e.hp=Math.max(0,e.hp-amount);else e.monster.currentHp=Math.max(0,e.monster.currentHp-amount);
  log(s,(actor==='player'?'지속 피해 · ':'적 지속 피해 · ')+amount);
 }
 if((actor==='player'?e.hp:e.monster.currentHp)<=0)return;
 for(const {effect,definition} of ticks)if(definition.behavior==='PERIODIC_HEAL'){
  const healed=applyHealing(s,actor,maxHp*(definition.payload?.amount??0)*effect.stackCount,{canCrit:effect.sourceActorId==='player',source:effect.sourceActorId,rng});
  log(s,'재생 회복 · '+healed.amount+(healed.critical?' · 치명타!':''));
 }
}
function afterPlayerPeriodic(s:GameState,rng:()=>number){const e=s.expedition!;decayPlayerOverheal(e,stats(s,e.equipment).hp);expireTurnEffects(e,'player',e.playerTurn);e.time++;if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0)return defeatMonster(s,rng);e.phase='MONSTER_TURN';return s;}
function finishPlayerTurn(s:GameState,rng:()=>number){const e=s.expedition!;if(e.monster.currentHp<=0&&e.hp>0)return defeatMonster(s,rng);applyTurnPeriodic(s,'player',rng);if(e.hp<=0&&canOfferRevival(s)){e.pendingRevival={source:'PERIODIC_DAMAGE',resumeTurn:'MONSTER_TURN',steps:[]};log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');return s;}return afterPlayerPeriodic(s,rng);}
function afterMonsterAction(s:GameState,rng:()=>number=random){const e=s.expedition!;if(e.monster.currentHp<=0&&e.hp>0)return defeatMonster(s,rng);applyTurnPeriodic(s,'monster',rng);expireTurnEffects(e,'monster',e.monsterTurn);if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0)return defeatMonster(s,rng);if(e.pendingFlee){log(s,'도망에 성공했습니다.');return leave(s);}return startPlayerTurn(s,rng);}

export function canPlayerAct(s:GameState){return !!s.expedition&&s.expedition.pendingRevival===null&&s.expedition.events.phase==='BATTLE'&&s.expedition.phase==='PLAYER_TURN'&&s.expedition.hp>0&&s.expedition.monster.currentHp>0&&!s.expedition.bossTracking.pendingBossId&&!isStunned(s.expedition,'player');}
export function canUseSkill(s:GameState,id:string){
  return false;
}
export function canUsePotion(s:GameState,potion:Potion){const e=s.expedition;if(!(potion in POTIONS)||potion==='revival'||!e||!canPlayerAct(s)||e.bag[potion]<1||combatRuntime(e).healingPotionUses>=5)return false;return true;}
export function hasPlayableBattleAction(s:GameState){return canPlayerAct(s);}
function appendFinish(e:NonNullable<GameState['expedition']>,step:CombatContinuationStep){if(e.pendingRevival){e.pendingRevival.steps=[];e.pendingRevival.resumeTurn=step.kind==='AFTER_MONSTER_ACTION'?'PLAYER_TURN':'MONSTER_TURN';}}
export function passPlayerTurn(state:GameState,rng:()=>number=random):GameState {if(!canPlayerAct(state))return state;const s=structuredClone(state);log(s,'행동할 수 없어 이번 턴을 넘깁니다.');return finishPlayerTurn(s,rng);}
export function basicAttack(state:GameState,rng:()=>number=random):GameState {
  if(!canPlayerAct(state))return state;
  const s=structuredClone(state),e=s.expedition!,weapon=weaponOf(s,e.equipment),identity=WEAPONS[weapon],hitCount=identity.basicHitMultipliers.length;
  const jobMult = resolveJobDirectHitMultiplier(s, 'BASIC');
  const hitResult=resolveActorDirectHits(s,'player',hitCount,identity.basicHitMultipliers[0]*jobMult,true,rng,hitCount);
  if(hitResult.hits.length===1)log(s,'당신의 공격 · '+directHitLog(hitResult));else hitResult.resolutions.forEach((value,index)=>log(s,'당신의 활 공격 '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.critical?' · 치명타!':'')+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));
  grantBasicAttackResource(e,hitResult.triggerPoints);
  const passive=accessoryPassive(equippedItem(s,'accessory',e.equipment));
  if(passive?.kind==='vampire'&&e.hp>0)heal(s,hitResult.total*passive.value);
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
  return finishPlayerTurn(s,rng);
}
export function useBattleSkill(state:GameState,id:string,rng:()=>number=random):GameState {
  return state;
}
export function useBattlePotion(state:GameState,potion:Potion,rng:()=>number=random):GameState {
  if(!canUsePotion(state,potion))return state;
  const s=structuredClone(state),e=s.expedition!,data=POTIONS[potion as GeneralPotion];
  e.bag[potion]--;combatRuntime(e).healingPotionUses++;
  const { healMultiplier } = runJobHook(s, 'BEFORE_HEAL', { actionType: 'POTION' });
  const ratio = data.healRatio * healMultiplier;
  heal(s,stats(s,e.equipment).hp*ratio);
  log(s,'['+data.name+' 포션] 사용 · 남은 수량 '+e.bag[potion]);
  return finishPlayerTurn(s,rng);
}
export function flee(state:GameState,rng:()=>number=random):GameState {if(!canPlayerAct(state)||isRooted(state.expedition!,'player'))return state;const s=structuredClone(state),e=s.expedition!;e.pendingFlee=true;log(s,'도망을 시도합니다. 적의 정상 행동 1회를 버텨야 합니다.');return finishPlayerTurn(s,rng);}
export function resolveMonsterTurn(state:GameState,rng:()=>number=random):GameState {if(!state.expedition||state.expedition.pendingRevival||state.expedition.events.phase!=='BATTLE'||state.expedition.phase!=='MONSTER_TURN')return state;const s=structuredClone(state),e=s.expedition!;e.time++;e.monsterTurn++;e.monsterRuntime??=createMonsterRuntime(e.monster,e.monsterTurn-1);beginMonsterTurn(e.monsterRuntime);advanceMonsterPhase(definitionForRuntime(e.monster,e.monsterRuntime),e.monsterRuntime,e.monster,e.hp,stats(s,e.equipment).hp,e.monsterEffects,e.playerEffects);if(isStunned(e,'monster')){e.monsterRuntime.preparedActionId=null;log(s,'기절 · 적 턴을 넘깁니다.');return afterMonsterAction(s,rng);}const definition=definitionForRuntime(e.monster,e.monsterRuntime),decision=isSilenced(e,'monster')&&!e.monsterRuntime.preparedActionId?{kind:'BASIC_ATTACK' as const}:chooseMonsterAction(definition,e.monsterRuntime,e.monster,e.hp,stats(s,e.equipment).hp,e.monsterEffects,e.playerEffects,rng);useMonsterAction(e.monsterRuntime,decision);resolveMonsterAction(s,decision,rng);if(e.pendingRevival){appendFinish(e,{kind:'AFTER_MONSTER_ACTION'});return s;}return afterMonsterAction(s,rng);}
export function resolveRevivalDecision(state:GameState,use:boolean,rng:()=>number=random):GameState {
 const current=state.expedition?.pendingRevival;if(!current)return state;
 const s=structuredClone(state),e=s.expedition!;
 if(!use||e.bag.revival<1){e.pendingRevival=null;log(s,'회생 포션을 사용하지 않았습니다.');return leave(s,true);}
 const context=e.pendingRevival!,legacy=context.steps??[];
 const resume=context.resumeTurn??(legacy.some(x=>x.kind==='AFTER_MONSTER_ACTION')?'PLAYER_TURN':'MONSTER_TURN');
 e.pendingRevival=null;e.bag.revival--;if(e.monsterRuntime){e.monsterRuntime.eventFlags??={};e.monsterRuntime.eventFlags.revived=true;}e.hp=Math.max(1,Math.round(stats(s,e.equipment).hp*CONFIG.revivalHealRatio));
 cleanseEffects(e,'player');
 for(const x of [...e.playerEffects])if(EFFECTS[x.effectId]?.behavior==='SHIELD')removeEffectById(e,'player',x.effectId);
 combatRuntime(e).combatQueue=[];e.reactivePrepared.player=null;
 log(s,'[회생 포션] 사용 · 전투를 이어갑니다.');
 if(context.source==='EVENT_DAMAGE')return s;
 if(context.source==='PERIODIC_DAMAGE'){expireTurnEffects(e,'player',e.playerTurn);e.time++;}
 if(resume==='PLAYER_TURN'){expireTurnEffects(e,'monster',e.monsterTurn);return startPlayerTurn(s,rng);}else e.phase='MONSTER_TURN';
 return s;
}
// Compatibility export: elapsed real time never changes battle state.
export function tick(state:GameState,_dt?:number,_rng?:()=>number){return state;}
