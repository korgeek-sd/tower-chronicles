import type {CombatActor,GameState,Weapon} from '../types';
import type {MonsterActionDecision,MonsterSkillDefinition} from './monsterAi';
import {damage} from './damage';
import {resolveDirectHits,type DirectHitResult} from './directHits';
import {stats,equippedItem,log} from './state';
import {PASSIVES} from '../data/config';
import {applyEffect,EFFECTS,modifier,hasEffect,removeEffectById} from './effects';
import {consumeDirectHitReaction,prepareReactive} from './reactions';
import type {BattleFxCollector} from './battleFx';

const other=(actor:CombatActor):CombatActor=>actor==='player'?'monster':'player';
function actorAttack(s:GameState,actor:CombatActor){const e=s.expedition!;if(actor==='monster')return e.monster.attack*(1+modifier(e,'monster','attack'));const base=stats(s,e.equipment),passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined,berserk=passive==='berserker'&&e.hp/base.hp<=PASSIVES.berserker.threshold?1+PASSIVES.berserker.value:1;return base.attack*(1+modifier(e,'player','attack'))*berserk;}
function actorDefense(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.defense*(1+modifier(e,'monster','defense')):stats(s,e.equipment).defense*(1+modifier(e,'player','defense'));}
function actorSkillPower(s:GameState,actor:CombatActor){const e=s.expedition!;return actor==='monster'?e.monster.skillPower:stats(s,e.equipment).skillPower;}
function receivedDamageMultiplier(s:GameState,actor:CombatActor){if(actor==='monster')return Math.max(0,1+modifier(s.expedition!,'monster','receivedDamage'));const e=s.expedition!,base=stats(s,e.equipment),passive=equippedItem(s,'accessory',e.equipment)?.kind as keyof typeof PASSIVES|undefined;let value=1+modifier(e,'player','receivedDamage');if(passive==='unyielding'&&e.hp/base.hp<=PASSIVES.unyielding.threshold)value*=1-PASSIVES.unyielding.value;return Math.max(0,value);}
function resolveReaction(s:GameState,target:CombatActor,fx?:BattleFxCollector){const e=s.expedition!,prepared=consumeDirectHitReaction(e,target);if(!prepared)return;log(s,'['+prepared.prepare.name+'] 반응 · 준비된 행동 소모');log(s,'['+prepared.reaction.name+'] 즉시 발동');resolveActorSkill(s,target,prepared.reaction,{allowReactive:false,fx});}
function merge(results:DirectHitResult[]):DirectHitResult {const resolutions=results.flatMap(r=>r.resolutions),hits=results.flatMap(r=>r.hits);return {remaining:results.at(-1)?.remaining??0,total:hits.reduce((a,b)=>a+b,0),hits,triggerPoints:results.reduce((a,b)=>a+b.triggerPoints,0),incomingTotal:results.reduce((a,b)=>a+b.incomingTotal,0),absorbedByShield:results.reduce((a,b)=>a+b.absorbedByShield,0),resolutions};}

export interface DirectHitFxContext {weaponId?:Weapon;skillId?:string}
export function resolveActorDirectHits(s:GameState,attacker:CombatActor,hitCount=1,multiplier=1,allowReactive=true,fx?:BattleFxCollector,context:DirectHitFxContext={}):DirectHitResult {
  const e=s.expedition!,target=other(attacker),count=Math.max(1,Math.floor(hitCount)),results:DirectHitResult[]=[];
  for(let i=0;i<count;i++){
    const result=resolveDirectHits(
      e,
      attacker,
      target,
      1,
      ()=>damage(actorAttack(s,attacker),actorDefense(s,target),multiplier*receivedDamageMultiplier(s,target)),
      allowReactive?(hitTarget)=>resolveReaction(s,hitTarget,fx):undefined,
      resolution=>fx?.emit({
        source:attacker,
        target,
        kind:'DIRECT_HIT',
        weaponId:context.weaponId,
        skillId:context.skillId,
        hitIndex:i,
        hitCount:count,
        damage:resolution.hpDamage,
        absorbedByShield:resolution.absorbedByShield
      })
    );
    results.push(result);
    const remaining=count-i-1;
    if(e.pendingRevival){
      if(remaining>0)e.pendingRevival.steps.push({kind:'DIRECT_HITS',attacker,remainingHits:remaining,multiplier,allowReactive});
      break;
    }
    if(target==='player'&&e.hp<=0&&e.bag.revival>0){
      e.pendingRevival={source:'DIRECT_HIT',steps:remaining>0?[{kind:'DIRECT_HITS',attacker,remainingHits:remaining,multiplier,allowReactive}]:[]};
      log(s,'치명상 · 회생 포션 사용 여부를 선택하세요.');
      break;
    }
    if(e.hp<=0||e.monster.currentHp<=0)break;
  }
  return merge(results);
}
export function directHitLog(result:DirectHitResult,index?:number){const prefix=index===undefined?'':(index+1)+'타 · ',hp=result.total+' 피해',shield=result.absorbedByShield>0?' · 보호막 '+result.absorbedByShield+' 흡수':'';return prefix+hp+shield;}

function applySkillEffects(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition,fx?:BattleFxCollector){
  const e=s.expedition!;
  for(const effect of skill.effects??[]){
    if(!EFFECTS[effect.effectId]){
      log(s,'['+skill.name+'] 알 수 없는 효과가 무시되었습니다.');
      continue;
    }
    const target=effect.target==='SELF'?actor:other(actor),turn=target==='monster'?e.monsterTurn:e.playerTurn,result=applyEffect(e,target,effect.effectId,actor,turn);
    fx?.emit({source:actor,target,kind:'STATUS',skillId:skill.id,effectId:effect.effectId});
    log(s,'['+skill.name+'] '+(target==='monster'?'적':'플레이어')+'에게 '+EFFECTS[effect.effectId].name+' 적용'+(result&&result.newStacks>1?' ×'+result.newStacks:''));
    if(result?.thresholdTriggered&&result.message)log(s,result.message);
  }
}
export function resolveActorSkill(s:GameState,actor:CombatActor,skill:MonsterSkillDefinition,options:{allowReactive?:boolean;fx?:BattleFxCollector}={}):DirectHitResult|undefined {
  if(skill.kind==='reactive_prepare'){
    prepareReactive(s.expedition!,actor,actor==='monster'?s.expedition!.monsterRuntime?.definitionId??s.expedition!.monster.definitionId??'':skill.id,skill);
    return;
  }
  let result:DirectHitResult|undefined;
  if(skill.kind==='damage'||skill.kind==='charge'){
    const multiplier=skill.conditionalMultiplier&&hasEffect(s.expedition!.playerEffects,skill.conditionalMultiplier.effectId)?skill.conditionalMultiplier.multiplier:skill.multiplier??1;
    result=resolveActorDirectHits(s,actor,skill.hits??1,multiplier*actorSkillPower(s,actor),options.allowReactive!==false,options.fx,{skillId:skill.id});
  }
  if(s.expedition!.pendingRevival){
    if(skill.effects?.length)s.expedition!.pendingRevival.steps.push({kind:'SKILL_EFFECTS',actor,effects:skill.effects.map(x=>({effectId:x.effectId,target:x.target==='SELF'?'SELF':'TARGET'}))});
  }else{
    applySkillEffects(s,actor,skill,options.fx);
    for(const effectId of skill.consumeEffectIds??[])removeEffectById(s.expedition!,actor,effectId);
  }
  return result;
}
export function resolveMonsterAction(s:GameState,decision:MonsterActionDecision,fx?:BattleFxCollector){
  const e=s.expedition!,skill=decision.skill;
  if(decision.kind==='BASIC_ATTACK'){
    const hit=resolveActorDirectHits(s,'monster',1,1,true,fx);
    log(s,e.monster.name+'의 기본 공격 · '+directHitLog(hit));
    return;
  }
  if(!skill){
    log(s,e.monster.name+'의 행동 데이터를 찾지 못해 기본 공격으로 전환합니다.');
    return resolveMonsterAction(s,{kind:'BASIC_ATTACK'},fx);
  }
  if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='charge'){
    log(s,'['+skill.name+'] 준비 시작 · 다음 적 행동에 발동');
    return;
  }
  if(decision.kind==='ACTIVE_SKILL'&&skill.kind==='reactive_prepare'){
    resolveActorSkill(s,'monster',skill,{fx});
    log(s,'['+skill.name+'] 반격 준비 · 직접 피격 시 발동');
    return;
  }
  if(decision.kind==='PREPARED_DISCHARGE')log(s,'['+skill.name+'] 준비 공격 발동');
  else log(s,'['+skill.name+'] 사용');
  const hit=resolveActorSkill(s,'monster',skill,{fx});
  if(hit){
    if((skill.hits??1)===1)log(s,'['+skill.name+'] · '+directHitLog(hit));
    else hit.resolutions.forEach((value,index)=>log(s,'['+skill.name+'] '+(index+1)+'타 · '+value.hpDamage+' 피해'+(value.absorbedByShield>0?' · 보호막 '+value.absorbedByShield+' 흡수':'')));
  }
}
