import {advanceSkillTurns,skillTurnsLeft} from './turns';
import type {CombatContinuationStep,GameState,GeneralPotion,Potion} from '../types';
import {COMBAT,SKILLS,POTIONS,PASSIVES,CONFIG} from '../data/config';
import {stats,weaponOf,equippedItem,log} from './state';
import {reward} from './drops';
import {leave} from './expedition';
import {postBattle} from '../events/service';
import {random} from '../events/rng';
import {applyEffect,applyIncomingDamage,clearBattleEffects,expireTurnEffects,modifier,periodicDelta} from './effects';
import {resolveBattleJobId,resolvePlayerCombatKit} from '../jobs/service';
import {jobById} from '../jobs/catalog';
import {beginMonsterTurn,chooseMonsterAction,createMonsterRuntime,definitionForRuntime,useMonsterAction} from './monsterAi';
import {directHitLog,resolveActorDirectHits,resolveMonsterAction} from './monsterSkills';
import {clearReactivePrepared} from './reactions';
import type {BattleFxCollector} from './battleFx';

export {damage} from './damage';
const skillById=(id:string)=>SKILLS.find(skill=>skill.id===id);
function heal(s:GameState,amount:number){const e=s.expedition!,before=e.hp;e.hp=Math.min(stats(s,e.equipment).hp,e.hp+amount);return Math.max(0,e.hp-before);}
function startPlayerTurn(s:GameState){const e=s.expedition!;e.phase='PLAYER_TURN';e.playerTurn++;e.pendingFlee=false;for(const key of Object.keys(e.buffs)){e.buffs[key]=Math.max(0,e.buffs[key]-1);if(e.buffs[key]===0)delete e.buffs[key];}advanceSkillTurns(e,SKILLS.map(skill=>skill.id));}
function defeatMonster(s:GameState,rng:()=>number){const e=s.expedition!;e.monster.currentHp=0;e.monsterRuntime=null;clearReactivePrepared(e);const defeatedBoss=e.events.activeBossId!==null;reward(s,rng);if(e.pendingFlee){if(defeatedBoss){e.bossTracking.bossDefeated=true;e.events.bossKillCountThisExpedition++;}return leave(s);}return postBattle(s,defeatedBoss,rng);}
function canOfferRevival(s:GameState){const e=s.expedition;return !!e&&e.bag.revival>0&&!e.pendingRevival;}
function applyPeriodicDelta(s:GameState,actor:'player'|'monster',delta:number,fx?:BattleFxCollector){
  const e=s.expedition!;
  if(delta<0){
    const result=applyIncomingDamage(e,actor,-delta),before=actor==='player'?e.hp:e.monster.currentHp,after=Math.max(0,before-result.hpDamage);
    if(actor==='player')e.hp=after;else e.monster.currentHp=after;
    fx?.emit({source:actor,target:actor,kind:'STATUS',effectId:'periodic_damage',damage:result.hpDamage,absorbedByShield:result.absorbedByShield});
    log(s,(actor==='player'?'지속 피해 · ':'적 지속 피해 · ')+result.hpDamage+(result.absorbedByShield>0?' · 보호막 '+result.absorbedByShield+' 흡수':''));
    return;
  }
  if(delta>0){
    const before=actor==='player'?e.hp:e.monster.currentHp;
    if(actor==='player')e.hp=Math.min(stats(s,e.equipment).hp,e.hp+delta);else e.monster.currentHp=Math.min(e.monster.hp,e.monster.currentHp+delta);
    const healed=(actor==='player'?e.hp:e.monster.currentHp)-before;
    if(healed>0)fx?.emit({source:actor,target:actor,kind:'HEAL',effectId:'periodic_heal',healing:healed});
    log(s,(actor==='player'?'재생 회복 · ':'적 지속 회복 · ')+delta);
  }
}
function afterPlayerPeriodic(s:GameState,rng:()=>number){const e=s.expedition!;expireTurnEffects(e,'player',e.playerTurn);e.time++;if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0){clearBattleEffects(e);return defeatMonster(s,rng);}e.phase='MONSTER_TURN';return s;}
function finishPlayerTurn(s:GameState,rng:()=>number,fx?:BattleFxCollector){const e=s.expedition!,delta=periodicDelta(e,'player',stats(s,e.equipment).hp,e.playerTurn);applyPeriodicDelta(s,'player',delta,fx);if(e.hp<=0&&canOfferRevival(s)){e.pendingRevival={source:'PERIODIC_DAMAGE',steps:[{kind:'AFTER_PLAYER_PERIODIC'}]};log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');return s;}return afterPlayerPeriodic(s,rng);}
function afterMonsterAction(s:GameState,rng:()=>number=random,fx?:BattleFxCollector){const e=s.expedition!,delta=periodicDelta(e,'monster',e.monster.hp,e.monsterTurn);applyPeriodicDelta(s,'monster',delta,fx);expireTurnEffects(e,'monster',e.monsterTurn);if(e.hp<=0)return leave(s,true);if(e.monster.currentHp<=0){clearBattleEffects(e);return defeatMonster(s,rng);}if(e.pendingFlee){log(s,'도망에 성공했습니다.');return leave(s);}startPlayerTurn(s);return s;}

export function canPlayerAct(s:GameState){return !!s.expedition&&s.expedition.pendingRevival===null&&s.expedition.events.phase==='BATTLE'&&s.expedition.phase==='PLAYER_TURN'&&s.expedition.hp>0&&s.expedition.monster.currentHp>0&&!s.expedition.bossTracking.pendingBossId;}
export function canUseSkill(s:GameState,id:string){const e=s.expedition,skill=skillById(id),jobReady=!!jobById(resolveBattleJobId(s))?.combatKit,activeIds=resolvePlayerCombatKit(s).activeSkillIds;return !!e&&!!skill&&canPlayerAct(s)&&activeIds.includes(id)&&(jobReady||(s.learned.includes(id)&&skill.weapons.includes(weaponOf(s,e.equipment))))&&skillTurnsLeft(e,id)===0&&(skill.condition!=='enemyLow'||e.monster.currentHp/e.monster.hp<=COMBAT.enemyLow)&&(skill.condition!=='selfLow'||e.hp/stats(s,e.equipment).hp<=COMBAT.selfLow);}
export function canUsePotion(s:GameState,potion:Potion){const e=s.expedition;if(!(potion in POTIONS)||potion==='revival'||!e||!canPlayerAct(s)||e.bag[potion]<1)return false;return e.hp<stats(s,e.equipment).hp;}
export function hasPlayableBattleAction(s:GameState){return canPlayerAct(s);}
function appendFinish(e:NonNullable<GameState['expedition']>,step:CombatContinuationStep){if(e.pendingRevival)e.pendingRevival.steps.push(step);}
export function passPlayerTurn(state:GameState,rng:()=>number=random,fx?:BattleFxCollector):GameState {if(!canPlayerAct(state))return state;const s=structuredClone(state);log(s,'행동할 수 없어 이번 턴을 넘깁니다.');return finishPlayerTurn(s,rng,fx);}
export function basicAttack(state:GameState,rng:()=>number=random,fx?:BattleFxCollector):GameState {
  if(!canPlayerAct(state))return state;
  const s=structuredClone(state),e=s.expedition!,weapon=weaponOf(s,e.equipment),hitResult=resolveActorDirectHits(s,'player',weapon==='bow'?2:1,1,true,fx,{weaponId:weapon});
  if(e.monster.definitionId==='black_vein_armor_breaker'&&e.monster.currentHp>0){
    for(const _ of hitResult.hits){
      const result=applyEffect(e,'monster','fracture','player',e.monsterTurn);
      if(result?.thresholdTriggered)fx?.emit({source:'player',target:'monster',kind:'ARMOR_BREAK',effectId:'fracture'});
    }
  }
  if(hitResult.hits.length===1)log(s,'당신의 공격 · '+directHitLog(hitResult));
  else hitResult.resolutions.forEach((value,index)=>log(s,'당신의 활 공격 '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));
  const passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined;
  if(passive==='vampire'&&e.hp>0){
    const healed=heal(s,hitResult.total*PASSIVES.vampire.value);
    if(healed>0)fx?.emit({source:'player',target:'player',kind:'HEAL',effectId:'vampire',healing:healed});
  }
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
  return finishPlayerTurn(s,rng,fx);
}
export function useBattleSkill(state:GameState,id:string,rng:()=>number=random,fx?:BattleFxCollector):GameState {
  if(!canUseSkill(state,id))return state;
  const s=structuredClone(state),e=s.expedition!,skill=skillById(id)!,weapon=weaponOf(s,e.equipment);
  e.cooldowns['turn:'+id]=skill.cooldown;
  if(skill.effect==='damage'){
    const hit=resolveActorDirectHits(s,'player',1,skill.value*stats(s,e.equipment).skillPower,true,fx,{weaponId:weapon,skillId:id});
    if(e.monster.definitionId==='black_vein_armor_breaker'&&e.monster.currentHp>0){
      const result=applyEffect(e,'monster','fracture','player',e.monsterTurn);
      if(result?.thresholdTriggered)fx?.emit({source:'player',target:'monster',kind:'ARMOR_BREAK',skillId:id,effectId:'fracture'});
    }
    log(s,'['+skill.name+'] · '+hit.total+' 피해');
  }else if(skill.effect==='guard'){
    applyEffect(e,'player','guard','player',e.playerTurn);
    fx?.emit({source:'player',target:'player',kind:'STATUS',skillId:id,effectId:'guard'});
    log(s,'['+skill.name+'] 사용 · '+skill.duration+'턴 지속');
  }else{
    fx?.emit({source:'player',target:'player',kind:'STATUS',skillId:id,effectId:skill.effect});
    log(s,'['+skill.name+'] 사용 · 현재 수동 턴제에서는 추가 효과 없음');
  }
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_PLAYER_ACTION'});return s;}
  return finishPlayerTurn(s,rng,fx);
}
export function useBattlePotion(state:GameState,potion:Potion,rng:()=>number=random,fx?:BattleFxCollector):GameState {
  if(!canUsePotion(state,potion))return state;
  const s=structuredClone(state),e=s.expedition!,data=POTIONS[potion as GeneralPotion];
  e.bag[potion]--;
  const healed=heal(s,stats(s,e.equipment).hp*data.healRatio);
  if(healed>0)fx?.emit({source:'player',target:'player',kind:'HEAL',effectId:potion,healing:healed});
  log(s,'['+data.name+' 포션] 사용 · 남은 수량 '+e.bag[potion]);
  return finishPlayerTurn(s,rng,fx);
}
export function flee(state:GameState,rng:()=>number=random,fx?:BattleFxCollector):GameState {if(!canPlayerAct(state))return state;const s=structuredClone(state),e=s.expedition!;e.pendingFlee=true;log(s,'도망을 시도합니다. 적의 정상 행동 1회를 버텨야 합니다.');return finishPlayerTurn(s,rng,fx);}
export function resolveMonsterTurn(state:GameState,fx?:BattleFxCollector):GameState {
  if(!state.expedition||state.expedition.pendingRevival||state.expedition.events.phase!=='BATTLE'||state.expedition.phase!=='MONSTER_TURN')return state;
  const s=structuredClone(state),e=s.expedition!;
  e.time++;
  e.monsterTurn++;
  e.monsterRuntime??=createMonsterRuntime(e.monster,e.monsterTurn-1);
  beginMonsterTurn(e.monsterRuntime);
  const definition=definitionForRuntime(e.monster,e.monsterRuntime),decision=chooseMonsterAction(definition,e.monsterRuntime,e.monster,e.hp,stats(s,e.equipment).hp,e.monsterEffects,e.playerEffects);
  useMonsterAction(e.monsterRuntime,decision);
  resolveMonsterAction(s,decision,fx);
  if(e.pendingRevival){appendFinish(e,{kind:'AFTER_MONSTER_ACTION'});return s;}
  return afterMonsterAction(s,random,fx);
}
function continueSteps(s:GameState,steps:CombatContinuationStep[],fx?:BattleFxCollector):GameState {
  while(s.expedition&&steps.length){
    const step=steps.shift()!,e=s.expedition;
    if(step.kind==='DIRECT_HITS'){
      resolveActorDirectHits(s,step.attacker,step.remainingHits,step.multiplier,step.allowReactive,fx);
      if(e.pendingRevival){e.pendingRevival.steps.push(...steps);return s;}
      if(e.hp<=0)return leave(s,true);
      continue;
    }
    if(step.kind==='SKILL_EFFECTS'){
      for(const effect of step.effects){
        const target=effect.target==='SELF'?step.actor:step.actor==='player'?'monster':'player';
        applyEffect(e,target,effect.effectId,step.actor,target==='player'?e.playerTurn:e.monsterTurn);
        fx?.emit({source:step.actor,target,kind:'STATUS',effectId:effect.effectId});
      }
      continue;
    }
    if(step.kind==='AFTER_PLAYER_ACTION')return finishPlayerTurn(s,random,fx);
    if(step.kind==='AFTER_PLAYER_PERIODIC')return afterPlayerPeriodic(s,random);
    if(step.kind==='AFTER_MONSTER_ACTION')return afterMonsterAction(s,random,fx);
    if(step.kind==='AFTER_EVENT_RESULT')return s;
  }
  return s;
}
export function resolveRevivalDecision(state:GameState,use:boolean,fx?:BattleFxCollector):GameState {
  const current=state.expedition?.pendingRevival;
  if(!current)return state;
  const s=structuredClone(state),e=s.expedition!;
  if(!use){e.pendingRevival=null;log(s,'회생 포션을 사용하지 않았습니다.');return leave(s,true);}
  if(e.bag.revival<1)return leave(s,true);
  const steps=[...e.pendingRevival!.steps];
  e.pendingRevival=null;
  e.bag.revival--;
  const before=e.hp;
  e.hp=Math.max(1,Math.round(stats(s,e.equipment).hp*CONFIG.revivalHealRatio));
  fx?.emit({source:'player',target:'player',kind:'HEAL',effectId:'revival',healing:Math.max(0,e.hp-before)});
  log(s,'[회생 포션] 사용 · 전투를 이어갑니다.');
  return continueSteps(s,steps,fx);
}
// Compatibility export: elapsed real time never changes battle state.
export function tick(state:GameState,_dt?:number,_rng?:()=>number){return state;}
