import {runCombatQueue,type CombatQueueItem} from './combatQueue';
import type {CombatActor,GameState} from '../types';
import type {MonsterActionDecision,MonsterSkillDefinition} from './monsterAi';
import {damage} from './damage';
import {resolveDirectHits,type DirectHitResult} from './directHits';
import {stats,equippedItem,log,recordCombatEvent} from './state';
import {accessoryPassive} from './equipmentStats';
import {applyEffect,removeEffectById,hasEffect,EFFECTS,modifier} from './effects';
import {checkJobPreparedReaction,consumeJobPreparedReaction,consumeDirectHitReaction,prepareReactive} from './reactions';
import {applyJobDamageTakenHooks,notifyJobHpDamageTaken,checkJobHpThresholdHooks} from '../jobs/resolver';
import {random} from '../events/rng';

const other=(actor:CombatActor):CombatActor=>actor==='player'?'monster':'player';
function actorAttack(s:GameState,actor:CombatActor){const e=s.expedition!;if(actor==='monster')return e.monster.attack*(1+modifier(e,'monster','attack'))*(e.monsterRuntime?.attackMultiplier??1);const base=stats(s,e.equipment),passive=accessoryPassive(equippedItem(s,'accessory',e.equipment)),berserk=passive?.kind==='berserker'&&e.hp/base.hp<=passive.hpRatioAtOrBelow?1+passive.value:1;return base.attack*(1+modifier(e,'player','attack'))*berserk;}
function actorDefense(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.defense*(1+modifier(e,'monster','defense'))*(e.monsterRuntime?.defenseMultiplier??1):stats(s,e.equipment).defense*(1+modifier(e,'player','defense'));}
function actorSkillPower(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.skillPower:stats(s,e.equipment).skillPower;}
function receivedDamageMultiplier(s:GameState,actor:CombatActor){if(actor==='monster')return Math.max(0,1+modifier(s.expedition!,'monster','receivedDamage'));const e=s.expedition!,base=stats(s,e.equipment),passive=accessoryPassive(equippedItem(s,'accessory',e.equipment));let value=1+modifier(e,'player','receivedDamage');if(passive?.kind==='unyielding'&&e.hp/base.hp<=passive.hpRatioAtOrBelow)value*=1-passive.value;return Math.max(0,value);}
function resolveReaction(s:GameState,target:CombatActor,rng:()=>number=random){
  const e=s.expedition!;
  const jobReaction = checkJobPreparedReaction(e, target);
  if (jobReaction) {
    if (jobReaction.consumeOnTrigger) consumeJobPreparedReaction(e, target);
    log(s, '[반격 태세] 준비 반격 발동!');
    resolveActorDirectHits(s, target === 'player' ? 'player' : 'monster', jobReaction.counterHits ?? 1, (jobReaction.counterMultiplier ?? 1) * actorSkillPower(s, target === 'player' ? 'player' : 'monster'), false, rng);
    return;
  }
  const prepared=consumeDirectHitReaction(e,target);
  if(!prepared)return;
  log(s,'['+prepared.prepare.name+'] 반응 · 준비된 행동 소모');
  log(s,'['+prepared.reaction.name+'] 즉시 발동');
  resolveActorSkill(s,target,prepared.reaction,{allowReactive:false,rng});
}
function merge(results:DirectHitResult[]):DirectHitResult {const resolutions=results.flatMap(r=>r.resolutions),hits=results.flatMap(r=>r.hits);return {remaining:results.at(-1)?.remaining??0,total:hits.reduce((a,b)=>a+b,0),hits,triggerPoints:results.reduce((a,b)=>a+b.triggerPoints,0),incomingTotal:results.reduce((a,b)=>a+b.incomingTotal,0),absorbedByShield:results.reduce((a,b)=>a+b.absorbedByShield,0),resolutions};}
export function resolveActorDirectHits(s:GameState,attacker:CombatActor,hitCount=1,multiplier=1,allowReactive=true,rng:()=>number=()=>1,defenseDivisor=1,options:{penetrationRate?:number;critical?:'ALLOWED'|'GUARANTEED';outcome?:'MISS'|'IMMUNE';onHit?:(resolution:import('./directHits').DirectHitResolution)=>void}={}):DirectHitResult {
  const e=s.expedition!,target=other(attacker),count=Math.max(1,Math.floor(hitCount)),results:DirectHitResult[]=[];
  const work:CombatQueueItem[]=Array.from({length:count},(_,i)=>({kind:'DIRECT_HIT',actor:attacker,multiplier,hitIndex:i+1,hitCount:count,canTriggerReaction:allowReactive}));
  runCombatQueue(e,work,item=>{
    if(item.kind!=='DIRECT_HIT')return;
    const i=(item.hitIndex??1)-1;
    const playerStats=attacker==='player'?stats(s,e.equipment):null,outcome=options.outcome??(modifier(e,target,'hitImmunity')>0?'IMMUNE':modifier(e,attacker,'missChance')>0&&rng()<modifier(e,attacker,'missChance')?'MISS':'HIT'),critical=outcome==='HIT'&&(options.critical==='GUARANTEED'||(!!playerStats||options.critical==='ALLOWED')&&rng()<Math.min(1,Math.max(0,(playerStats?.critChance??.05)+modifier(e,attacker,'critChance')))),criticalMultiplier=critical?(playerStats?.critDamage??1.5)+modifier(e,attacker,'critDamage'):1;
    let rawDamage = damage(actorAttack(s,attacker),actorDefense(s,target),multiplier*(1+modifier(e,attacker,'outgoingDamage')),criticalMultiplier,options.penetrationRate??0);
    const jobReaction = allowReactive ? checkJobPreparedReaction(e, target) : undefined;
    if (jobReaction?.incomingDamageMultiplier !== undefined) {
      rawDamage *= jobReaction.incomingDamageMultiplier;
    }
    rawDamage=Math.max(1,Math.floor(rawDamage*receivedDamageMultiplier(s,target)));
    const finalDamage = target === 'player' ? applyJobDamageTakenHooks(s, rawDamage, true,rng) : rawDamage;

    const result=resolveDirectHits(e,attacker,target,1,()=>({damage:finalDamage,critical,outcome}),allowReactive?(hitTarget)=>resolveReaction(s,hitTarget,rng):undefined,resolution=>{
      if(attacker==='player'&&resolution.hpDamage>0&&resolution.hpAfter>0&&e.monster.definitionId==='black_vein_armor_breaker'&&hasEffect(e.monsterEffects,'iron_armor')){
        applyEffect(e,'monster','fracture','player',e.monsterTurn);
        if((e.monsterRuntime?.effectApplications?.['monster:fracture']??0)>=3){removeEffectById(e,'monster','iron_armor');removeEffectById(e,'monster','fracture');applyEffect(e,'monster','exposed_core','player',e.monsterTurn);}
      }
      options.onHit?.(resolution);
      if(resolution.shieldBefore>0&&resolution.shieldAfter===0&&e.monsterRuntime){e.monsterRuntime.eventFlags??={};e.monsterRuntime.eventFlags[target+':shieldBroken']=true;}
      recordCombatEvent(s,{kind:'DIRECT_DAMAGE',outcome:resolution.outcome,origin:allowReactive?'ACTION':'REACTION',attacker,target,hitIndex:i+1,hitCount:count,incomingDamage:resolution.incomingDamage,absorbedByShield:resolution.absorbedByShield,hpDamage:resolution.hpDamage,critical:resolution.critical});
      if (target === 'player'&&resolution.hpAfter>0) {
        notifyJobHpDamageTaken(s, resolution.hpDamage, rng,allowReactive);
        checkJobHpThresholdHooks(s, rng);
      }
    });
    results.push(result);
    if(target==='player'&&e.hp<=0&&e.bag.revival>0&&!e.pendingRevival){e.pendingRevival={source:'DIRECT_HIT',steps:[]};log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');}
    if(e.hp<=0)e.reactivePrepared.player=null;
    if(e.monster.currentHp<=0)e.reactivePrepared.monster=null;
  });
  return merge(results);
}
export function directHitLog(result:DirectHitResult,index?:number){const prefix=index===undefined?'':(index+1)+'타 · ',hp=result.total+' 피해',critical=result.resolutions.some(hit=>hit.critical)?' · 치명타!':'',shield=result.absorbedByShield>0?' · 보호막 '+result.absorbedByShield+' 흡수':'';return prefix+hp+critical+shield;}
function applySkillEffects(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition){const e=s.expedition!;for(const effect of skill.effects??[]){if(!EFFECTS[effect.effectId]){log(s,'['+skill.name+'] 알 수 없는 효과가 무시되었습니다.');continue;}const target=effect.target==='SELF'?actor:other(actor),turn=target==='monster'?e.monsterTurn:e.playerTurn,result=applyEffect(e,target,effect.effectId,actor,turn);log(s,'['+skill.name+'] '+(target==='monster'?'적':'플레이어')+'에게 '+EFFECTS[effect.effectId].name+' 적용'+(result&&result.newStacks>1?' ×'+result.newStacks:''));if(result?.thresholdTriggered&&result.message)log(s,result.message);}}
export function resolveActorSkill(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition,options:{allowReactive?:boolean;rng?:()=>number}={}):DirectHitResult|undefined {if(skill.kind==='reactive_prepare'){prepareReactive(s.expedition!,actor,actor==='monster'?s.expedition!.monsterRuntime?.definitionId??s.expedition!.monster.definitionId??'':skill.id,skill);return;}let result:DirectHitResult|undefined;if(skill.kind==='damage'||skill.kind==='charge')result=resolveActorDirectHits(s,actor,skill.hits??1,(skill.multiplier??1)*actorSkillPower(s,actor),options.allowReactive!==false,options.rng??(()=>1),1,{penetrationRate:skill.penetrationRate,critical:skill.critical,onHit:hit=>{if(hit.hpDamage>0&&hit.hpAfter>0)applySkillEffects(s,actor,{...skill,effects:skill.effects?.filter(x=>x.target==='TARGET')});}});if(!s.expedition!.pendingRevival&&s.expedition!.hp>0&&s.expedition!.monster.currentHp>0)if(!result)applySkillEffects(s,actor,skill);else if(skill.effects?.some(effect=>effect.target==='SELF'))applySkillEffects(s,actor,{...skill,effects:skill.effects.filter(effect=>effect.target==='SELF')});return result;}
export function resolveMonsterAction(s:GameState,decision:MonsterActionDecision,rng:()=>number=random){const e=s.expedition!,skill=decision.skill;if(decision.kind==='BASIC_ATTACK'){const hit=resolveActorDirectHits(s,'monster',1,1,true,rng);log(s,e.monster.name+'의 기본 공격 · '+directHitLog(hit));return;}if(!skill){log(s,e.monster.name+'의 행동 데이터를 찾지 못해 기본 공격으로 전환합니다.');return resolveMonsterAction(s,{kind:'BASIC_ATTACK'},rng);}if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='charge'){log(s,'['+skill.name+'] 준비 시작 · 다음 적 행동에 발동');return;}if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='reactive_prepare'){resolveActorSkill(s,'monster',skill,{rng});log(s,'['+skill.name+'] 반격 준비 · 직접 피격 시 발동');return;}if(decision.kind==='PREPARED_DISCHARGE')log(s,'['+skill.name+'] 준비 공격 발동');else log(s,'['+skill.name+'] 사용');const hit=resolveActorSkill(s,'monster',skill,{rng});if(hit){if((skill.hits??1)===1)log(s,'['+skill.name+'] · '+directHitLog(hit));else hit.resolutions.forEach((value,index)=>log(s,'['+skill.name+'] '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));}}
