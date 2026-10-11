import {SKILL_TREE_CATALOG,type TreeSkill,type TreeWeapon} from '../skills/catalog';
import {skillEnhancementLevel} from '../skills/enhancement';
import {damage,type CombatStats} from './model';

export const HUNT_ACTIVE_SLOTS=6,HUNT_PASSIVE_SLOTS=3,BASE_MP=100,MP_PER_POINT=10;
export type HuntingWeapon=TreeWeapon;
export type SkillLevels=Readonly<Record<string,number>>;
export const catalogSkill=(id:string):TreeSkill|undefined=>SKILL_TREE_CATALOG.find(s=>s.id===id);
export const validSkillForWeapon=(skill:TreeSkill,weapon:HuntingWeapon)=>skill.weapon==='any'||skill.weapon===weapon;
export function validateCombatPreset(skills:readonly string[],learned:readonly string[],weapon:HuntingWeapon) {
 if(skills.length>HUNT_ACTIVE_SLOTS+HUNT_PASSIVE_SLOTS||new Set(skills).size!==skills.length)return false;
 let active=0,passive=0;
 for(const id of skills){
  if(['heavy','guard','quick'].includes(id)){active++;continue;}
  const skill=catalogSkill(id);
  if(!skill||!learned.includes(id)||!validSkillForWeapon(skill,weapon))return false;
  if(skill.type==='active')active++;else passive++;
 }
 return active<=HUNT_ACTIVE_SLOTS&&passive<=HUNT_PASSIVE_SLOTS;
}
export const maxHuntingMp=(allocation:{mp?:number}|undefined)=>BASE_MP+Math.max(0,Math.floor(allocation?.mp??0))*MP_PER_POINT;
export const effectiveSkillPower=(skill:TreeSkill,level:number)=>Number.parseFloat(skill.power)*(1+skillEnhancementLevel(level)*.05);
export const weaponForHunt=(kind:string|null|undefined):HuntingWeapon=>kind==='outer_guard_longbow'?'bow':kind==='archive_standard_arcane_staff'?'staff':'sword';
export interface CatalogCombatState {
 hp:number;maxHp:number;monsterHp:number;mp:number;maxMp:number;shield:number;shieldUntil:number;
 prep:number;prepUntil:number;monsterDot:number;monsterDotUntil:number;monsterDefenseDown:number;monsterDefenseDownUntil:number;
 oathAvailable:boolean;oathShieldRatio:number;passiveDamage:number;passiveAccuracy:number;sixthMark:boolean;sixthPrepRatio:number;activeCount:number;
}
export function initialCatalogCombat(player:CombatStats,mp:number,passiveIds:readonly string[],levels:SkillLevels,weapon:HuntingWeapon):CatalogCombatState{
 let maxHp=player.hp,passiveDamage=0,passiveAccuracy=0,oathAvailable=false,oathShieldRatio=.15,sixthMark=false,sixthPrepRatio=.15;
 for(const id of passiveIds){
  const s=catalogSkill(id);if(!s||s.type!=='passive'||!validSkillForWeapon(s,weapon))continue;
  const value=effectiveSkillPower(s,levels[id]??0);
  if(s.family==='return_oath'){maxHp=Math.round(maxHp*(1+value/100));oathAvailable=true;oathShieldRatio=value/100;}
  if(s.family==='sixth_mark'){sixthMark=true;sixthPrepRatio=value/100;}
  if((s.family==='sword_mastery'&&weapon==='sword')||(s.family==='bow_mastery'&&weapon==='bow')||(s.family==='staff_mastery'&&weapon==='staff'))passiveDamage+=value/100;
  if(s.family==='bow_mastery'&&weapon==='bow')passiveAccuracy+=value/100;
 }
 return {hp:maxHp,maxHp,monsterHp:0,mp,maxMp:mp,shield:0,shieldUntil:0,prep:0,prepUntil:0,monsterDot:0,monsterDotUntil:0,monsterDefenseDown:0,monsterDefenseDownUntil:0,oathAvailable,oathShieldRatio,passiveDamage,passiveAccuracy,sixthMark,sixthPrepRatio,activeCount:0};
}
export interface SkillCastResult {state:CatalogCombatState;line:string;hit:number;used:boolean;guard:boolean;cooldown:number;reflected:number}
export function castCatalogSkill(id:string,level:number,turn:number,state:CatalogCombatState,player:CombatStats,monsterDefense:number,rng:()=>number,effectShield=0,effectReflect=0,attackFactor=1):SkillCastResult|null {
 const s=catalogSkill(id);if(!s||s.type!=='active'||s.mp>state.mp)return null;
 const next={...state,mp:state.mp-s.mp,activeCount:state.activeCount+1};
 const family=s.family,value=effectiveSkillPower(s,level);
 const gradeIndex=['C','B','A','S','SR','SSR'].indexOf(s.grade);
 const accuracyBonus=family==='bow_shot'?(gradeIndex===0?5:gradeIndex===1?8:0):0;
 const chance=Math.min(100,s.chance+(family.startsWith('bow_')?state.passiveAccuracy*100:0)+accuracyBonus);
 let hit=0,reflected=0,guard=false,cd=1,line='탐사자의 '+s.name+'!';
 const success=rng()*100<chance;
 if(!success){line+=' 발동 실패';}
 else if(family==='restore'){const gained=Math.max(0,Math.min(next.maxMp-next.mp,Math.round(value)));next.mp+=gained;line+=' MP +'+gained;cd=3;}
 else if(family==='heal'){const gained=Math.max(0,Math.min(next.maxHp-next.hp,Math.floor(next.maxHp*value/100)));next.hp+=gained;line+=' HP +'+gained;cd=4;}
 else if(family==='shield'){next.shield=Math.floor(next.maxHp*value/100);next.shieldUntil=turn+2;line+=' 보호막 '+next.shield;cd=4;}
 else if(family==='prepare'){next.prep=value/100;next.prepUntil=turn+2;line+=' 다음 공격 +'+Math.round(value)+'%';cd=3;}
 else {
  const pen=family==='sword_strike'?[0,0,.05,.1,.15,.2][['C','B','A','S','SR','SSR'].indexOf(s.grade)]:family==='bow_shot'?[0,0,.05,.1,.15,.2][['C','B','A','S','SR','SSR'].indexOf(s.grade)]:0;
  const ignoreDefense=next.monsterDefenseDownUntil>=turn?next.monsterDefenseDown:0;
  const crit=rng()<player.critChance;
  const prep=next.prepUntil>=turn?next.prep:0;
  const effectiveAttack=player.attack*attackFactor*(1+next.passiveDamage);
  const mult=value/100*(1+prep)*(crit?player.critDamage:1);
  const hits=family==='bow_volley'?(gradeIndex===5?4:gradeIndex>=3?3:2):1;
  const raw=Array.from({length:hits},()=>damage(effectiveAttack,monsterDefense*(1-ignoreDefense),mult/hits,Math.max(0,Math.min(1,player.armorPenetration+pen)))).reduce((a,b)=>a+b,0);
  hit=effectShield>0?Math.max(1,Math.floor(raw*(1-effectShield))):raw;
  reflected=Math.floor(hit*effectReflect);
  next.hp=Math.max(0,next.hp-reflected);
  next.monsterHp=Math.max(0,next.monsterHp-hit);
  next.prep=0;next.prepUntil=0;
  if(family==='sword_wound'||family==='bow_volley'||family==='staff_flame'){
   const gradeIndex=['C','B','A','S','SR','SSR'].indexOf(s.grade);
   const percent=family==='sword_wound'?[8,10,12,15,18,22][gradeIndex]:family==='bow_volley'?[0,8,10,12,15,18][gradeIndex]:[0,10,12,15,18,22][gradeIndex];
   next.monsterDot=Math.floor(effectiveAttack*percent*(1+skillEnhancementLevel(level)*.05)/100);
   next.monsterDotUntil=turn+2;
  }
  if(family==='sword_wound'&&s.grade!=='C'){const healRate=[0,.05,.07,.1,.12,.15][['C','B','A','S','SR','SSR'].indexOf(s.grade)];next.hp=Math.min(next.maxHp,next.hp+Math.floor(hit*healRate));}
  if(family==='staff_rift'){next.monsterDefenseDown=[3,5,8,11,15,20][gradeIndex]*(1+skillEnhancementLevel(level)*.05)/100;next.monsterDefenseDownUntil=turn+2;}
  line+=' '+hit+' 피해'+(hits>1?' · '+hits+'연타':'')+(crit?' · 치명타':'');
 }
 if(next.sixthMark&&next.activeCount%6===0){next.mp=Math.min(next.maxMp,next.mp+80);next.prep=Math.max(next.prep,next.sixthPrepRatio);next.prepUntil=turn+2;line+=' · 각인 MP +80';}
 return {state:next,line,hit,used:true,guard,cooldown:cd,reflected};
}
export function applyCatalogTurnStart(state:CatalogCombatState,turn:number){
 if(state.monsterDotUntil>=turn&&state.monsterDot>0)return {...state,monsterHp:Math.max(0,state.monsterHp-state.monsterDot)};
 return state;
}
export function takeCatalogMonsterDamage(state:CatalogCombatState,amount:number,turn:number){
 const next={...state};let hit=amount;
 if(next.shieldUntil>=turn&&next.shield>0){const absorbed=Math.min(hit,next.shield);hit-=absorbed;next.shield-=absorbed;}
 next.hp=Math.max(0,next.hp-hit);
 if(next.hp<=0&&next.oathAvailable){next.hp=1;next.oathAvailable=false;next.shield=Math.max(next.shield,Math.floor(next.maxHp*next.oathShieldRatio));next.shieldUntil=turn+2;}
 return {state:next,damage:hit};
}
