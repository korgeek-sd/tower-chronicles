import type {GameState} from '../../game/types';
import type {BestiaryEntry} from '../../game/data/bestiary';
import {bestiaryFloorLabel} from '../../game/data/bestiary';
import {bestiaryKnowledge,bestiaryProgressFor,type BestiaryKnowledge} from '../../game/engine/bestiary';
import {monsterDefinitionById,type AiCondition} from '../../game/engine/monsterAi';
import {EFFECTS} from '../../game/engine/effects';

export interface BestiarySkillView {
  id:string;
  name:string;
  kind:string;
  description:string|null;
  cooldown:number|null;
  conditions:string[];
}
export interface BestiaryEntryView {
  id:string;
  knowledge:BestiaryKnowledge;
  displayName:string;
  actualName:string;
  boss:boolean;
  floorLabel:string;
  encounters:number;
  defeats:number;
  skills:BestiarySkillView[];
}

const effectName=(id:string)=>EFFECTS[id]?.name??id;
export function aiConditionText(condition:AiCondition):string|null {
  if(condition.kind==='SKILL_READY')return null;
  if(condition.kind==='SELF_HP_BELOW')return '자신 HP '+Math.round(condition.value*100)+'% 미만';
  if(condition.kind==='TARGET_HP_BELOW')return '대상 HP '+Math.round(condition.value*100)+'% 미만';
  if(condition.kind==='SELF_HAS_EFFECT')return '자신에게 '+effectName(condition.effectId)+' 적용 중';
  if(condition.kind==='SELF_MISSING_EFFECT')return '자신에게 '+effectName(condition.effectId)+' 없음';
  if(condition.kind==='TARGET_HAS_EFFECT')return '대상에게 '+effectName(condition.effectId)+' 적용 중';
  if(condition.kind==='TARGET_MISSING_EFFECT')return '대상에게 '+effectName(condition.effectId)+' 없음';
  if(condition.kind==='SELF_EFFECT_STACKS_AT_LEAST')return '자신의 '+effectName(condition.effectId)+' '+condition.requiredStacks+'중첩 이상';
  if(condition.kind==='TARGET_EFFECT_STACKS_AT_LEAST')return '대상의 '+effectName(condition.effectId)+' '+condition.requiredStacks+'중첩 이상';
  return null;
}

export function bestiaryEntryView(game:GameState,entry:BestiaryEntry):BestiaryEntryView {
  const progress=bestiaryProgressFor(game.bestiary,entry.id);
  const knowledge=bestiaryKnowledge(game.bestiary,entry.id,entry.boss);
  const definition=monsterDefinitionById(entry.definitionId);
  const mastered=knowledge==='MASTERED',defeated=knowledge==='DEFEATED'||mastered;
  const reactionIds=new Set((definition?.skills??[]).filter(skill=>skill.kind==='reactive_prepare'&&skill.reactionSkillId).map(skill=>skill.reactionSkillId!));
  const skills=defeated?(definition?.skills??[]).filter(skill=>!reactionIds.has(skill.id)).map(skill=>{
    const rules=(definition?.aiRules??[]).filter(rule=>rule.actionId===skill.id);
    const conditions=mastered?[...new Set(rules.flatMap(rule=>rule.conditions.map(aiConditionText).filter((value):value is string=>!!value)))]:[];
    return {
      id:skill.id,
      name:skill.name,
      kind:skill.kind,
      description:mastered?skill.description:null,
      cooldown:mastered?skill.cooldown:null,
      conditions,
    };
  }):[];
  return {
    id:entry.id,
    knowledge,
    displayName:knowledge==='UNKNOWN'?(entry.boss?'미확인 보스':'미확인 개체'):entry.name,
    actualName:entry.name,
    boss:entry.boss,
    floorLabel:bestiaryFloorLabel(entry),
    encounters:progress.encounters,
    defeats:progress.defeats,
    skills,
  };
}

export const bestiaryDiscoveredCount=(game:GameState,entries:BestiaryEntry[])=>entries.filter(entry=>bestiaryProgressFor(game.bestiary,entry.id).encounters>0).length;
