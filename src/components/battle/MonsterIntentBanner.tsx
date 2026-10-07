import React from 'react';
import type {MonsterIntentView} from './combatIntel';

export function MonsterIntentBanner({intent}:{intent:MonsterIntentView}){
  if(intent.kind==='NONE')return null;
  return <div className={'tc-ref-intent monster-intent intent-'+intent.kind.toLowerCase()} role="alert" aria-live="polite">
    <b>{intent.kind==='CHARGE'?'⚠ '+intent.title:'↶ '+intent.title}</b>
    <strong>{intent.skillName}</strong>
    {intent.description&&<small className="tc-intent-timing">{intent.description}</small>}
    {intent.attackInfo&&<span className="tc-intent-attack">{intent.attackInfo}</span>}
    {intent.threats&&<span className="tc-intent-threats">{intent.threats}</span>}
    {intent.guidance&&<small className="tc-intent-guidance">{intent.guidance}</small>}
  </div>;
}
