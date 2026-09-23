import React from 'react';
import type {MonsterIntentView} from './combatIntel';

export function MonsterIntentBanner({intent}:{intent:MonsterIntentView}){
  if(intent.kind==='NONE')return null;
  return <div className={'monster-intent intent-'+intent.kind.toLowerCase()} role="alert" aria-live="polite">
    <b>{intent.kind==='CHARGE'?'⚠ '+intent.title:'↶ '+intent.title}</b>
    <strong>{intent.skillName}</strong>
    {intent.description&&<small>{intent.description}</small>}
  </div>;
}
