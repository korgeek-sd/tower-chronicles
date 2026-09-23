import type {ActiveEffect,Expedition} from '../../game/types';
import {EFFECTS,activeShield} from '../../game/engine/effects';
import {monsterDefinitionFor,preparedMonsterSkill} from '../../game/engine/monsterAi';
import {reactivePreparedSkill} from '../../game/engine/reactions';

export type MonsterIntentKind='CHARGE'|'REACTIVE'|'NONE';
export interface MonsterIntentView {
  kind:MonsterIntentKind;
  title:string;
  skillName?:string;
  description?:string;
}
export interface CombatEffectView {
  id:string;
  name:string;
  description:string;
  category:'BUFF'|'DEBUFF'|'SPECIAL';
  stacks:number;
  turns:number;
  modifierPercent?:number;
  shieldCurrent?:number;
  shieldMax?:number;
  shieldHits?:number;
}
export interface MonsterSkillView {
  id:string;
  name:string;
  description:string;
  kind:'damage'|'charge'|'reactive_prepare'|'effect';
  cooldown:number;
  cooldownRemaining:number;
  ready:boolean;
}
export interface MonsterCombatIntel {
  intent:MonsterIntentView;
  effects:CombatEffectView[];
  shield:CombatEffectView|null;
  skills:MonsterSkillView[];
}

export function combatEffectView(effect:ActiveEffect):CombatEffectView {
  const definition=EFFECTS[effect.effectId];
  return {
    id:effect.effectId,
    name:definition?.name??effect.effectId,
    description:definition?.description??'',
    category:definition?.category??'SPECIAL',
    stacks:effect.stackCount,
    turns:effect.remainingDuration,
    ...(definition?.payload?.multiplier!==undefined?{modifierPercent:Math.round(definition.payload.multiplier*100*effect.stackCount)}:{}),
    ...(effect.currentShield!==undefined?{shieldCurrent:effect.currentShield,shieldMax:definition?.shieldAmount}:{}),
    ...(effect.currentShieldHits!==undefined?{shieldHits:effect.currentShieldHits}:{}),
  };
}

export function monsterIntentView(expedition:Expedition):MonsterIntentView {
  const prepared=preparedMonsterSkill(expedition.monster,expedition.monsterRuntime);
  if(prepared)return {kind:'CHARGE',title:'강공격 준비 중',skillName:prepared.name,description:'다음 적 행동에 발동합니다.'};
  const reactive=reactivePreparedSkill(expedition,'monster');
  if(reactive)return {kind:'REACTIVE',title:'반격 준비',skillName:reactive.prepare.name,description:'직접 공격을 받으면 반응합니다.'};
  return {kind:'NONE',title:'준비 행동 없음'};
}

export function monsterSkillViews(expedition:Expedition):MonsterSkillView[] {
  const definition=monsterDefinitionFor(expedition.monster),runtime=expedition.monsterRuntime;
  const reactionIds=new Set((definition.skills??[]).filter(skill=>skill.kind==='reactive_prepare'&&skill.reactionSkillId).map(skill=>skill.reactionSkillId!));
  return (definition.skills??[]).filter(skill=>!reactionIds.has(skill.id)).map(skill=>{
    const cooldownRemaining=runtime?.skillCooldowns[skill.id]??0;
    return {id:skill.id,name:skill.name,description:skill.description,kind:skill.kind,cooldown:skill.cooldown,cooldownRemaining,ready:cooldownRemaining===0};
  });
}

export function monsterCombatIntel(expedition:Expedition):MonsterCombatIntel {
  const shield=activeShield(expedition,'monster');
  return {
    intent:monsterIntentView(expedition),
    effects:expedition.monsterEffects.map(combatEffectView),
    shield:shield?combatEffectView(shield):null,
    skills:monsterSkillViews(expedition),
  };
}
