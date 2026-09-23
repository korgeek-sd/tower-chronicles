import React from 'react';
import type {CombatEffectView} from './combatIntel';

function label(effect:CombatEffectView){
  const parts=[effect.name];
  if(effect.modifierPercent!==undefined)parts.push((effect.modifierPercent>0?'+':'')+effect.modifierPercent+'%');
  if(effect.shieldCurrent!==undefined)parts.push('보호막 '+effect.shieldCurrent+(effect.shieldMax!==undefined?'/'+effect.shieldMax:''));
  if(effect.shieldHits!==undefined)parts.push(effect.shieldHits+'회 방어');
  if(effect.stacks>1)parts.push(effect.stacks+'중첩');
  parts.push(effect.turns+'턴');
  return parts.join(' · ');
}

export function CombatEffectStrip({effects}:{effects:CombatEffectView[]}){
  if(!effects.length)return null;
  return <div className="monster-effect-strip" aria-label="적 상태 효과">
    {effects.map((effect,index)=><span key={effect.id+'-'+index} className={'effect-'+effect.category.toLowerCase()} title={effect.description}>{label(effect)}</span>)}
  </div>;
}
