import type {CombatActor,Expedition} from '../types';
import {applyIncomingDamage,type DamageAbsorption} from './effects';

const hp=(e:Expedition,actor:CombatActor)=>actor==='player'?e.hp:e.monster.currentHp;
const setHp=(e:Expedition,actor:CombatActor,value:number)=>{if(actor==='player')e.hp=value;else e.monster.currentHp=value;};

export interface DirectHitResolution extends DamageAbsorption {hpBefore:number;hpAfter:number}
export interface DirectHitResult {remaining:number;total:number;hits:number[];triggerPoints:number;incomingTotal:number;absorbedByShield:number;resolutions:DirectHitResolution[]}
export function resolveDirectHits(e:Expedition,attacker:CombatActor,target:CombatActor,hitCount:number,damagePerHit:()=>number,onSurvivingDirectHit?:(target:CombatActor,attacker:CombatActor)=>void):DirectHitResult {const values:number[]=[],resolutions:DirectHitResolution[]=[];let triggerPoints=0;for(let index=0;index<Math.max(1,Math.floor(hitCount));index++){if(hp(e,attacker)<=0||hp(e,target)<=0)break;const hpBefore=hp(e,target),absorption=applyIncomingDamage(e,target,Math.max(0,damagePerHit())),dealt=Math.min(hpBefore,absorption.hpDamage),hpAfter=hpBefore-dealt;setHp(e,target,hpAfter);values.push(dealt);resolutions.push({...absorption,hpDamage:dealt,hpBefore,hpAfter});if(absorption.incomingDamage>0)triggerPoints++;if(absorption.incomingDamage>0&&hpAfter>0)onSurvivingDirectHit?.(target,attacker);if(hp(e,attacker)<=0)break;}return {remaining:hp(e,target),total:values.reduce((sum,value)=>sum+value,0),hits:values,triggerPoints,incomingTotal:resolutions.reduce((sum,value)=>sum+value.incomingDamage,0),absorbedByShield:resolutions.reduce((sum,value)=>sum+value.absorbedByShield,0),resolutions};}

