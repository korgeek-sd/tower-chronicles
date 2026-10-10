import {damage} from './model';
export interface MonsterSkill {name:string;power:number;effect:string;value:number;hits:number;penetration:number;turns:number[]}
export interface MonsterUnit {id:string;name:string;description:string;image:string;hp:number;attack:number;defense:number;role:string;skills:MonsterSkill[]}
export interface MonsterEffects {
 [key:string]:number|undefined;
 bleed?:number;bleedUntil?:number;poison?:number;poisonUntil?:number;burn?:number;burnUntil?:number;
 attack_down?:number;attack_downUntil?:number;defense_down?:number;defense_downUntil?:number;
 vulnerable?:number;shield?:number;reflect?:number;attack_buff?:number;silenceUntil?:number;delayUntil?:number;
}
export const HUNT_MONSTER_SKILLS_PATTERN=[0,1,0,2] as const;
export function monsterSkillAt(monster:MonsterUnit,turn:number):MonsterSkill {
 return monster.skills[HUNT_MONSTER_SKILLS_PATTERN[(turn-1)%4]];
}
export function damageOverTime(effects:MonsterEffects,turn:number,attack:number){
 const values=(['bleed','poison','burn'] as const).filter(kind=>(effects[kind+'Until']??0)>=turn);
 return values.map(kind=>({name:kind,damage:Math.max(1,Math.floor(attack*(effects[kind]??0)))}));
}
export function playerAttackFactor(effects:MonsterEffects,turn:number){return (effects.attack_downUntil??0)>=turn?1-(effects.attack_down??0):1;}
export function playerDefenseFactor(effects:MonsterEffects,turn:number){return (effects.defense_downUntil??0)>=turn?1-(effects.defense_down??0):1;}
export function blocksPlayerSkill(effects:MonsterEffects,turn:number){return (effects.silenceUntil??0)>=turn||(effects.delayUntil??0)>=turn;}
export function takeMonsterShield(damageValue:number,effects:MonsterEffects){
 const hit=(effects.shield??0)>0?Math.max(1,Math.floor(damageValue*(1-(effects.shield??0)))):damageValue;
 const reflected=(effects.reflect??0)>0?Math.floor(hit*effects.reflect!):0;
 return {hit,reflected,effects:{...effects,shield:0,reflect:0}};
}
export interface MonsterAction {damage:number;heal:number;skillName:string;hits:number;line:string;effects:MonsterEffects}
export function resolveMonsterAction(monster:MonsterUnit,turn:number,playerDefense:number,guard:boolean,monsterHp:number,effects:MonsterEffects={}):MonsterAction {
 const skill=monsterSkillAt(monster,turn),active=(effects.attack_buff??0);
 const vulnerable=effects.vulnerable??0;
 const modifier=(1+active)*(1+vulnerable)*(guard?.5:1);
 let total=0;
 for(let i=0;i<skill.hits;i++)if(skill.power>0)total+=damage(monster.attack,playerDefense,skill.power*modifier,skill.penetration);
 let heal=0;const next:MonsterEffects={...effects,attack_buff:0,vulnerable:0};
 switch(skill.effect){
  case 'bleed':case 'poison':case 'burn':
   next[skill.effect]=skill.value;next[skill.effect+'Until']=turn+2;break;
  case 'attack_down':case 'defense_down':
   next[skill.effect]=skill.value;next[skill.effect+'Until']=turn+2;break;
  case 'shield':next.shield=skill.value;break;
  case 'shield_heal':next.shield=skill.value;heal=Math.floor(monster.hp*.03);break;
  case 'reflect':next.reflect=skill.value;break;
  case 'attack_buff':next.attack_buff=skill.value;break;
  case 'vulnerable':next.vulnerable=skill.value;break;
  case 'silence':next.silenceUntil=turn+1;break;
  case 'delay':next.delayUntil=turn+1;break;
  case 'heal':heal=Math.floor(monster.hp*skill.value);break;
  case 'leech':heal=Math.floor(total*skill.value);break;
 }
 heal=Math.min(Math.max(0,monster.hp-monsterHp),heal);
 const line=monster.name+'의 '+skill.name+'! '+(skill.power>0?total+' 피해':'효과 발동')+(skill.hits>1?' · '+skill.hits+'연타':'')+(heal>0?' · HP +'+heal:'')+(skill.effect!=='none'&&skill.effect!=='leech'&&skill.effect!=='heal'?' · '+effectName(skill.effect):'');
 return {damage:total,heal,skillName:skill.name,hits:skill.hits,line,effects:next};
}
export function effectName(effect:string):string {
 return ({bleed:'출혈',poison:'중독',burn:'화상',attack_down:'공격력 감소',defense_down:'방어력 감소',vulnerable:'취약',shield:'피해 감소',reflect:'피해 반사',heal:'HP 회복',leech:'흡혈',silence:'스킬 봉인',delay:'스킬 지연',attack_buff:'위력 강화',shield_heal:'보호막·재생'} as Record<string,string>)[effect]??'';
}
export function monsterSkillDescription(skill:MonsterSkill):string {
 const text=skill.power>0?'공격력 '+Math.round(skill.power*100)+'%'+(skill.hits>1?' × '+skill.hits:'')+' 피해':'피해 없음';
 return text+(skill.penetration?' · 방어 관통 '+Math.round(skill.penetration*100)+'%':'')+(skill.effect!=='none'?' · '+effectName(skill.effect):'');
}
