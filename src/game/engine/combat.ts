import {advanceSkillTurns,skillTurnsLeft} from './turns';
import type {CombatContinuationStep,GameState,GeneralPotion,Potion} from '../types';
import {COMBAT,SKILLS,POTIONS,PASSIVES,CONFIG,WEAPONS} from '../data/config';
import {stats,weaponOf,equippedItem,log} from './state';
import {reward} from './drops';
import {leave} from './expedition';
import {postBattle} from '../events/service';
import {random} from '../events/rng';
import {applyEffect,applyIncomingDamage,clearBattleEffects,expireTurnEffects,modifier,periodicDelta} from './effects';
import {resolveBattleJobId,resolvePlayerCombatKit} from '../jobs/service';
import {jobById} from '../jobs/catalog';
import {getJobCombatDefinition} from '../jobs/framework';
import {executeJobSkill,resolveJobDirectHitMultiplier} from '../jobs/resolver';
import {initFiveJobCombatDefinitions} from '../jobs/definitions';

initFiveJobCombatDefinitions();
import {beginMonsterTurn,chooseMonsterAction,createMonsterRuntime,definitionForRuntime,useMonsterAction} from './monsterAi';
import {directHitLog,resolveActorDirectHits,resolveMonsterAction} from './monsterSkills';
import {clearReactivePrepared} from './reactions';

export {damage} from './damage';
const skillById=(id:string)=>SKILLS.find(skill=>skill.id===id);
function heal(s:GameState,amount:number){const e=s.expedition!;e.hp=Math.min(stats(s,e.equipment).hp,e.hp+amount);}
function startPlayerTurn(s:GameState){const e=s.expedition!;e.phase='PLAYER_TURN';e.playerTurn++;e.pendingFlee=false;for(const key of Object.keys(e.buffs)){e.buffs[key]=Math.max(0,e.buffs[key]-1);if(e.buffs[key]===0)delete e.buffs[key];}advanceSkillTurns(e,SKILLS.map(skill=>skill.id));}
function defeatMonster(s:GameState,rng:()=>number){const e=s.expedition!;e.monster.currentHp=0;e.monsterRuntime=null;clearReactivePrepared(e);const defeatedBoss=e.events.activeBossId!==null;reward(s,rng);if(e.pendingFlee){if(defeatedBoss){e.bossTracking.bossDefeated=true;e.events.bossKillCountThisExpedition++;}return leave(s);}return postBattle(s,defeatedBoss,rng);}
function canOfferRevival(s:GameState){const e=s.expedition;return !!e&&e.bag.revival>0&&!e.pendingRevival;}
function applyPeriodicDelta(s:GameState,actor:'player'|'monster',delta:number){const e=s.expedition!;if(delta<0){const result=applyIncomingDamage(e,actor,-delta),before=actor==='player'?e.hp:e.monster.currentHp,after=Math.max(0,before-result.hpDamage);if(actor==='player')e.hp=after;else e.monster.currentHp=after;log(s,(actor==='player'?'지속 피해 · ':'적 지속 피해 · ')+result.hpDamage+(result.absorbedByShield>0?' · 보호막 '+result.absorbedByShield+' 흡수':''));return;}if(delta>0){if(actor==='player')e.hp=Math.min(stats(s,e.equipment).hp,e.hp+delta);else e.monster.currentHp=Math.min(e.monster.hp,e.monster.currentHp+delta);log(s,(actor==='player'?'재생 회복 · ':'적 지속 회복 · ')+delta);}}
function afterPlayerPeriodic(s:GameState,rng:()=>number){const e=s.expedition!;expireTurnEffects(e,'player',e.playerTurn);e.time++;if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0){clearBattleEffects(e);return defeatMonster(s,rng);}e.phase='MONSTER_TURN';return s;}
function finishPlayerTurn(s:GameState,rng:()=>number){const e=s.expedition!,delta=periodicDelta(e,'player',stats(s,e.equipment).hp,e.playerTurn);applyPeriodicDelta(s,'player',delta);if(e.hp<=0&&canOfferRevival(s)){e.pendingRevival={source:'PERIODIC_DAMAGE',steps:[{kind:'AFTER_PLAYER_PERIODIC'}]};log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');return s;}return afterPlayerPeriodic(s,rng);}
function afterMonsterAction(s:GameState,rng:()=>number=random){const e=s.expedition!,delta=periodicDelta(e,'monster',e.monster.hp,e.monsterTurn);applyPeriodicDelta(s,'monster',delta);expireTurnEffects(e,'monster',e.monsterTurn);if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0){clearBattleEffects(e);return defeatMonster(s,rng);}if(e.pendingFlee){log(s,'도망에 성공했습니다.');return leave(s);}startPlayerTurn(s);return s;}

export function canPlayerAct(s:GameState){return !!s.expedition&&s.expedition.pendingRevival===null&&s.expedition.events.phase==='BATTLE'&&s.expedition.phase==='PLAYER_TURN'&&s.expedition.hp>0&&s.expedition.monster.currentHp>0&&!s.expedition.bossTracking.pendingBossId;}
export function canUseSkill(s:GameState,id:string){
  const e=s.expedition;
  if (!e || !canPlayerAct(s)) return false;
  const jobId = resolveBattleJobId(s);
  const jobDef = getJobCombatDefinition(jobId);
  const activeIds = resolvePlayerCombatKit(s).activeSkillIds;

  // Job active skill
  if (jobDef && activeIds.includes(id)) {
    const jobSkill = jobDef.skills.find(sk => sk.id === id);
    if (!jobSkill) return false;
    if (skillTurnsLeft(e, id) > 0) return false;
    if (id === 'berserker_skill_3' && (e.jobRuntime.resource?.value ?? 0) < 60) return false;
    return true;
  }

  // Legacy skill
  const skill=skillById(id),jobReady=!!jobById(jobId)?.combatKit;
  return !!skill&&activeIds.includes(id)&&(jobReady||(s.learned.includes(id)&&skill.weapons.includes(weaponOf(s,e.equipment))))&&skillTurnsLeft(e,id)===0&&(skill.condition!=='enemyLow'||e.monster.currentHp/e.monster.hp<=COMBAT.enemyLow)&&(skill.condition!=='selfLow'||e.hp/stats(s,e.equipment).hp<=COMBAT.selfLow);
}
export function canUsePotion(s:GameState,potion:Potion){const e=s.expedition;if(!(potion in POTIONS)||potion==='revival'||!e||!canPlayerAct(s)||e.bag[potion]<1)return false;return e.hp<stats(s,e.equipment).hp;}
export function hasPlayableBattleAction(s:GameState){return canPlayerAct(s);}
function appendFinish(e:NonNullable<GameState['expedition']>,step:CombatContinuationStep){if(e.pendingRevival)e.pendingRevival.steps.push(step);}
export function passPlayerTurn(state:GameState,rng:()=>number=random):GameState {if(!canPlayerAct(state))return state;const s=structuredClone(state);log(s,'행동할 수 없어 이번 턴을 넘깁니다.');return finishPlayerTurn(s,rng);}
export function basicAttack(state:GameState,rng:()=>number=random):GameState {
  if(!canPlayerAct(state))return state;
  const s=structuredClone(state),e=s.expedition!,weapon=weaponOf(s,e.equipment),identity=WEAPONS[weapon],hitCount=identity.basicHitMultipliers.length;
  const jobMult = resolveJobDirectHitMultiplier(s, 'BASIC');
  const hitResult=resolveActorDirectHits(s,'player',hitCount,identity.basicHitMultipliers[0]*jobMult,true,rng,hitCount);
  if(e.monster.definitionId==='black_vein_armor_breaker'&&e.monster.currentHp>0)for(const _ of hitResult.hits)applyEffect(e,'monster','fracture','player',e.monsterTurn);
  if(hitResult.hits.length===1)log(s,'당신의 공격 · '+directHitLog(hitResult));else hitResult.resolutions.forEach((value,index)=>log(s,'당신의 활 공격 '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.critical?' · 치명타!':'')+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));
  const passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined;
  if(passive==='vampire'&&e.hp>0)heal(s,hitResult.total*PASSIVES.vampire.value);
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
  return finishPlayerTurn(s,rng);
}
export function useBattleSkill(state:GameState,id:string,rng:()=>number=random):GameState {
  if(!canUseSkill(state,id))return state;
  const s=structuredClone(state),e=s.expedition!;
  const jobId = resolveBattleJobId(s);
  const jobDef = getJobCombatDefinition(jobId);

  // If job skill
  if (jobDef && jobDef.skills.some(sk => sk.id === id)) {
    const ok = executeJobSkill(s, id, rng);
    if (!ok) return state;
    if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
    return finishPlayerTurn(s,rng);
  }

  // Legacy skill
  const skill=skillById(id)!;
  e.cooldowns['turn:'+id]=skill.cooldown;
  if(skill.effect==='damage'){
    const jobMult = resolveJobDirectHitMultiplier(s, 'SKILL', id);
    const hit=resolveActorDirectHits(s,'player',1,skill.value*stats(s,e.equipment).skillPower*jobMult,true,rng);
    if(e.monster.definitionId==='black_vein_armor_breaker'&&e.monster.currentHp>0)applyEffect(e,'monster','fracture','player',e.monsterTurn);
    log(s,'['+skill.name+'] · '+hit.total+' 피해'+(hit.resolutions[0]?.critical?' · 치명타!':''));
  }else if(skill.effect==='guard'){applyEffect(e,'player','guard','player',e.playerTurn);log(s,'['+skill.name+'] 사용 · '+skill.duration+'턴 지속');}else log(s,'['+skill.name+'] 사용 · 현재 수동 턴제에서는 추가 효과 없음');
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
  return finishPlayerTurn(s,rng);
}
export function useBattlePotion(state:GameState,potion:Potion,rng:()=>number=random):GameState {
  if(!canUsePotion(state,potion))return state;
  const s=structuredClone(state),e=s.expedition!,data=POTIONS[potion as GeneralPotion];
  e.bag[potion]--;
  let ratio = data.healRatio;
  if (e.jobRuntime.jobId === 'field_medic') ratio *= 1.2; // Field Medic Passive 2: +20% potion heal
  heal(s,stats(s,e.equipment).hp*ratio);
  log(s,'['+data.name+' 포션] 사용 · 남은 수량 '+e.bag[potion]);
  return finishPlayerTurn(s,rng);
}
export function flee(state:GameState,rng:()=>number=random):GameState {if(!canPlayerAct(state))return state;const s=structuredClone(state),e=s.expedition!;e.pendingFlee=true;log(s,'도망을 시도합니다. 적의 정상 행동 1회를 버텨야 합니다.');return finishPlayerTurn(s,rng);}
export function resolveMonsterTurn(state:GameState):GameState {if(!state.expedition||state.expedition.pendingRevival||state.expedition.events.phase!=='BATTLE'||state.expedition.phase!=='MONSTER_TURN')return state;const s=structuredClone(state),e=s.expedition!;e.time++;e.monsterTurn++;e.monsterRuntime??=createMonsterRuntime(e.monster,e.monsterTurn-1);beginMonsterTurn(e.monsterRuntime);const definition=definitionForRuntime(e.monster,e.monsterRuntime),decision=chooseMonsterAction(definition,e.monsterRuntime,e.monster,e.hp,stats(s,e.equipment).hp,e.monsterEffects,e.playerEffects);useMonsterAction(e.monsterRuntime,decision);resolveMonsterAction(s,decision);if(e.pendingRevival){appendFinish(e,{kind:'AFTER_MONSTER_ACTION'});return s;}return afterMonsterAction(s);}
function continueSteps(s:GameState,steps:CombatContinuationStep[]):GameState {while(s.expedition&&steps.length){const step=steps.shift()!;const e=s.expedition;if(step.kind==='DIRECT_HITS'){resolveActorDirectHits(s,step.attacker,step.remainingHits,step.multiplier,step.allowReactive,random,step.defenseDivisor??1);if(e.pendingRevival){e.pendingRevival.steps.push(...steps);return s;}if(e.hp<=0)return leave(s,true);continue;}if(step.kind==='SKILL_EFFECTS'){for(const effect of step.effects){const target=effect.target==='SELF'?step.actor:step.actor==='player'?'monster':'player';applyEffect(e,target,effect.effectId,step.actor,target==='player'?e.playerTurn:e.monsterTurn);}continue;}if(step.kind==='AFTER_PLAYER_ACTION')return finishPlayerTurn(s,random);if(step.kind==='AFTER_PLAYER_PERIODIC')return afterPlayerPeriodic(s,random);if(step.kind==='AFTER_MONSTER_ACTION')return afterMonsterAction(s,random);if(step.kind==='AFTER_EVENT_RESULT')return s;}return s;}
export function resolveRevivalDecision(state:GameState,use:boolean):GameState {const current=state.expedition?.pendingRevival;if(!current)return state;const s=structuredClone(state),e=s.expedition!;if(!use){e.pendingRevival=null;log(s,'회생 포션을 사용하지 않았습니다.');return leave(s,true);}if(e.bag.revival<1)return leave(s,true);const steps=[...e.pendingRevival!.steps];e.pendingRevival=null;e.bag.revival--;e.hp=Math.max(1,Math.round(stats(s,e.equipment).hp*CONFIG.revivalHealRatio));log(s,'[회생 포션] 사용 · 전투를 이어갑니다.');return continueSteps(s,steps);}
// Compatibility export: elapsed real time never changes battle state.
export function tick(state:GameState,_dt?:number,_rng?:()=>number){return state;}
