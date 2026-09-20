import type {CombatActor,GameState} from '../types';
import type {MonsterActionDecision,MonsterSkillDefinition} from './monsterAi';
import {damage} from './damage';
import {resolveDirectHits,type DirectHitResult} from './directHits';
import {stats,equippedItem,log,recordCombatEvent} from './state';
import {PASSIVES} from '../data/config';
import {applyEffect,EFFECTS,modifier} from './effects';
import {consumeDirectHitReaction,prepareReactive} from './reactions';
import {applyJobDamageTakenHooks,applyJobHpTakenRageGain,checkJobHpThresholdHooks} from '../jobs/resolver';
import {random} from '../events/rng';

const other=(actor:CombatActor):CombatActor=>actor==='player'?'monster':'player';
function actorAttack(s:GameState,actor:CombatActor){const e=s.expedition!;if(actor==='monster')return e.monster.attack*(1+modifier(e,'monster','attack'));const base=stats(s,e.equipment),passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined,berserk=passive==='berserker'&&e.hp/base.hp<=PASSIVES.berserker.threshold?1+PASSIVES.berserker.value:1;return base.attack*(1+modifier(e,'player','attack'))*berserk;}
function actorDefense(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.defense*(1+modifier(e,'monster','defense')):stats(s,e.equipment).defense*(1+modifier(e,'player','defense'));}
function actorSkillPower(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.skillPower:stats(s,e.equipment).skillPower;}
function receivedDamageMultiplier(s:GameState,actor:CombatActor){if(actor==='monster')return Math.max(0,1+modifier(s.expedition!,'monster','receivedDamage'));const e=s.expedition!,base=stats(s,e.equipment),passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined;let value=1+modifier(e,'player','receivedDamage');if(passive==='unyielding'&&e.hp/base.hp<=PASSIVES.unyielding.threshold)value*=1-PASSIVES.unyielding.value;return Math.max(0,value);}
function resolveReaction(s:GameState,target:CombatActor){
  const e=s.expedition!;
  // Check Duelist 받아치기 (duelist_counter_stance) first if target is player
  if (target === 'player' && e.playerEffects.some(ef => ef.effectId === 'duelist_counter_stance')) {
    e.playerEffects = e.playerEffects.filter(ef => ef.effectId !== 'duelist_counter_stance');
    log(s, '[받아치기] 반격 발동 · 180% 즉시 반격!');
    resolveActorDirectHits(s, 'player', 1, 1.8 * stats(s, e.equipment).skillPower, false, random);
    return;
  }
  const prepared=consumeDirectHitReaction(e,target);
  if(!prepared)return;
  log(s,'['+prepared.prepare.name+'] 반응 · 준비된 행동 소모');
  log(s,'['+prepared.reaction.name+'] 즉시 발동');
  resolveActorSkill(s,target,prepared.reaction,{allowReactive:false});
}
function merge(results:DirectHitResult[]):DirectHitResult {const resolutions=results.flatMap(r=>r.resolutions),hits=results.flatMap(r=>r.hits);return {remaining:results.at(-1)?.remaining??0,total:hits.reduce((a,b)=>a+b,0),hits,triggerPoints:results.reduce((a,b)=>a+b.triggerPoints,0),incomingTotal:results.reduce((a,b)=>a+b.incomingTotal,0),absorbedByShield:results.reduce((a,b)=>a+b.absorbedByShield,0),resolutions};}
export function resolveActorDirectHits(s:GameState,attacker:CombatActor,hitCount=1,multiplier=1,allowReactive=true,rng:()=>number=()=>1,defenseDivisor=1):DirectHitResult {
  const e=s.expedition!,target=other(attacker),count=Math.max(1,Math.floor(hitCount)),results:DirectHitResult[]=[];
  for(let i=0;i<count;i++){
    const playerStats=attacker==='player'?stats(s,e.equipment):null,critical=!!playerStats&&rng()<(playerStats.critChance??.05),criticalMultiplier=critical?(playerStats!.critDamage??1.5):1;
    const rawDamage = damage(actorAttack(s,attacker),actorDefense(s,target)/Math.max(1,defenseDivisor),multiplier*receivedDamageMultiplier(s,target),criticalMultiplier);
    const finalDamage = target === 'player' ? applyJobDamageTakenHooks(s, rawDamage, true) : rawDamage;

    const result=resolveDirectHits(e,attacker,target,1,()=>({damage:finalDamage,critical}),allowReactive?(hitTarget)=>resolveReaction(s,hitTarget):undefined,resolution=>{
      recordCombatEvent(s,{kind:'DIRECT_DAMAGE',attacker,target,hitIndex:i+1,hitCount:count,incomingDamage:resolution.incomingDamage,absorbedByShield:resolution.absorbedByShield,hpDamage:resolution.hpDamage,critical:resolution.critical});
      if (target === 'player' && resolution.hpDamage > 0) {
        applyJobHpTakenRageGain(s, resolution.hpDamage);
        checkJobHpThresholdHooks(s);
      }
    });
    results.push(result);
    const remaining=count-i-1;
    if(e.pendingRevival){if(remaining>0)e.pendingRevival.steps.push({kind:'DIRECT_HITS',attacker,remainingHits:remaining,multiplier,allowReactive,defenseDivisor});break;}
    if(target==='player'&&e.hp<=0&&e.bag.revival>0){e.pendingRevival={source:'DIRECT_HIT',steps:remaining>0?[{kind:'DIRECT_HITS',attacker,remainingHits:remaining,multiplier,allowReactive,defenseDivisor}]:[]};log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');break;}
    if(e.hp<=0||e.monster.currentHp<=0)break;
  }
  return merge(results);
}
export function directHitLog(result:DirectHitResult,index?:number){const prefix=index===undefined?'':(index+1)+'타 · ',hp=result.total+' 피해',critical=result.resolutions.some(hit=>hit.critical)?' · 치명타!':'',shield=result.absorbedByShield>0?' · 보호막 '+result.absorbedByShield+' 흡수':'';return prefix+hp+critical+shield;}
function applySkillEffects(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition){const e=s.expedition!;for(const effect of skill.effects??[]){if(!EFFECTS[effect.effectId]){log(s,'['+skill.name+'] 알 수 없는 효과가 무시되었습니다.');continue;}const target=effect.target==='SELF'?actor:other(actor),turn=target==='monster'?e.monsterTurn:e.playerTurn,result=applyEffect(e,target,effect.effectId,actor,turn);log(s,'['+skill.name+'] '+(target==='monster'?'적':'플레이어')+'에게 '+EFFECTS[effect.effectId].name+' 적용'+(result&&result.newStacks>1?' ×'+result.newStacks:''));if(result?.thresholdTriggered&&result.message)log(s,result.message);}}
export function resolveActorSkill(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition,options:{allowReactive?:boolean}={}):DirectHitResult|undefined {if(skill.kind==='reactive_prepare'){prepareReactive(s.expedition!,actor,actor==='monster'?s.expedition!.monsterRuntime?.definitionId??s.expedition!.monster.definitionId??'':skill.id,skill);return;}let result:DirectHitResult|undefined;if(skill.kind==='damage'||skill.kind==='charge')result=resolveActorDirectHits(s,actor,skill.hits??1,(skill.multiplier??1)*actorSkillPower(s,actor),options.allowReactive!==false);if(s.expedition!.pendingRevival){if(skill.effects?.length)s.expedition!.pendingRevival.steps.push({kind:'SKILL_EFFECTS',actor,effects:skill.effects.map(x=>({effectId:x.effectId,target:x.target==='SELF'?'SELF':'TARGET'}))});}else applySkillEffects(s,actor,skill);return result;}
export function resolveMonsterAction(s:GameState,decision:MonsterActionDecision){const e=s.expedition!,skill=decision.skill;if(decision.kind==='BASIC_ATTACK'){const hit=resolveActorDirectHits(s,'monster');log(s,e.monster.name+'의 기본 공격 · '+directHitLog(hit));return;}if(!skill){log(s,e.monster.name+'의 행동 데이터를 찾지 못해 기본 공격으로 전환합니다.');return resolveMonsterAction(s,{kind:'BASIC_ATTACK'});}if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='charge'){log(s,'['+skill.name+'] 준비 시작 · 다음 적 행동에 발동');return;}if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='reactive_prepare'){resolveActorSkill(s,'monster',skill);log(s,'['+skill.name+'] 반격 준비 · 직접 피격 시 발동');return;}if(decision.kind==='PREPARED_DISCHARGE')log(s,'['+skill.name+'] 준비 공격 발동');else log(s,'['+skill.name+'] 사용');const hit=resolveActorSkill(s,'monster',skill);if(hit){if((skill.hits??1)===1)log(s,'['+skill.name+'] · '+directHitLog(hit));else hit.resolutions.forEach((value,index)=>log(s,'['+skill.name+'] '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));}}
