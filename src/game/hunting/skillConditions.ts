export const CONDITION_OPTIONS=[
 ['always','항상'],['hp_pct_gte','HP(%) 이상'],['hp_pct_lte','HP(%) 이하'],['hp_gte','HP 이상'],['hp_lte','HP 이하'],
 ['mp_pct_gte','MP(%) 이상'],['mp_pct_lte','MP(%) 이하'],['mp_gte','MP 이상'],['mp_lte','MP 이하'],
 ['turn_gte','턴 이상'],['turn_lte','턴 이하'],['turn_every','매 N턴'],['enemy_hp_pct_gte','적 HP(%) 이상'],['enemy_hp_pct_lte','적 HP(%) 이하'],
 ['shield_present','보호막 있음'],['shield_absent','보호막 없음'],['buff_present','공격 준비 있음'],['buff_absent','공격 준비 없음'],
 ['bleed_present','출혈 있음'],['bleed_absent','출혈 없음'],['poison_present','중독 있음'],['poison_absent','중독 없음'],['burn_present','화상 있음'],['burn_absent','화상 없음'],
 ['enemy_dot_present','적 지속 피해 있음'],['enemy_dot_absent','적 지속 피해 없음'],['enemy_defense_present','적 방어 감소 있음'],['enemy_defense_absent','적 방어 감소 없음'],
] as const;
export type ConditionKind=typeof CONDITION_OPTIONS[number][0];
export interface SkillCondition {kind:ConditionKind;value?:number}
export interface SkillSetup {slots:(string|null)[];conditions:Record<string,SkillCondition[]>}
export const needsConditionValue=(kind:string)=>/_gte$|_lte$|_every$/.test(kind);
export function validSkillConditions(value:unknown):value is SkillCondition[]{
 return Array.isArray(value)&&value.length<=2&&value.every(c=>c&&CONDITION_OPTIONS.some(([id])=>id===c.kind)&&(!needsConditionValue(c.kind)||(Number.isInteger(c.value)&&c.value>=(c.kind.startsWith('turn_')?1:0)&&c.value<=(c.kind.includes('_pct_')?100:999999))));
}
export const conditionLabel=(c:SkillCondition)=>{const label=CONDITION_OPTIONS.find(([id])=>id===c.kind)?.[1]??'항상';return needsConditionValue(c.kind)?c.kind==='turn_every'?'매 '+c.value+'턴':label.replace(' 이상',' '+c.value+' 이상').replace(' 이하',' '+c.value+' 이하'):label;};
export const conditionsLabel=(conditions?:SkillCondition[])=>conditions?.length?conditions.map(conditionLabel).join(' · '):'항상';
export interface ConditionContext {hp:number;maxHp:number;mp:number;maxMp:number;enemyHp:number;enemyMaxHp:number;turn:number;shield:number;buff:boolean;effects:Record<string,number|undefined>;enemyDot:boolean;enemyDefenseDown:boolean}
export function matchesSkillConditions(conditions:SkillCondition[]|undefined,c:ConditionContext):boolean{
 if(!conditions)return true;if(!validSkillConditions(conditions))return false;
 return conditions.every(({kind,value=0})=>{
  if(kind==='always')return true;
  if(kind==='turn_every')return c.turn%value===0;
  const numeric:Record<string,number>={hp:c.hp,hp_pct:c.hp/Math.max(1,c.maxHp)*100,mp:c.mp,mp_pct:c.mp/Math.max(1,c.maxMp)*100,enemy_hp_pct:c.enemyHp/Math.max(1,c.enemyMaxHp)*100,turn:c.turn};
  const match=kind.match(/^(.*)_(gte|lte)$/);if(match)return match[2]==='gte'?numeric[match[1]]>=value:numeric[match[1]]<=value;
  const states:Record<string,boolean>={shield:c.shield>0,buff:c.buff,bleed:(c.effects.bleedUntil??0)>=c.turn,poison:(c.effects.poisonUntil??0)>=c.turn,burn:(c.effects.burnUntil??0)>=c.turn,enemy_dot:c.enemyDot,enemy_defense:c.enemyDefenseDown};
  const name=kind.replace(/_(present|absent)$/,'');return kind.endsWith('_present')?states[name]===true:states[name]===false;
 });
}
