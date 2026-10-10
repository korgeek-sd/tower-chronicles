import {GRADES,type TreeSkill} from './catalog';
export type SkillEnhancementLevel=0|1|2|3;
export function skillEnhancementLevel(value:unknown):SkillEnhancementLevel {
 return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=3?value as SkillEnhancementLevel:0;
}
export function enhancementCost(grade:TreeSkill['grade'],current:number){
 if(!Number.isInteger(current)||current<0||current>=3)return null;
 return {level:current+1,books:[2,3,5][current],gold:500*2**GRADES.indexOf(grade)*2**current,bonus:(current+1)*5};
}
export function enhancedSkill(skill:TreeSkill,level:unknown):TreeSkill {
 const multiplier=1+skillEnhancementLevel(level)*.05;
 const percent=(n:string)=>String(Math.round(Number(n)*multiplier*100)/100);
 const power=skill.power.endsWith(' MP')?`${Math.round(parseFloat(skill.power)*multiplier)} MP`:skill.power.replace(/(\d+(?:\.\d+)?)%/g,(_,n:string)=>percent(n)+'%');
 const effect=skill.effect.replace(/(\d+(?:\.\d+)?)%/g,(_,n:string)=>percent(n)+'%').replace(/MP (\d+) 회복/g,(_,n:string)=>`MP ${Math.round(Number(n)*multiplier)} 회복`);
 return {...skill,power,effect};
}
