import React from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {getHuntingState} from '../../online/hunting';
import {huntingLevel} from '../../game/hunting/model';
import {StatAllocationScreen} from './StatAllocationScreen';
import './stats.css';
export function StatAllocationPage({game,userId,lease,onHome}:{game:GameState;userId:string|null;lease:GameplayLease|null;onHome:()=>void}){
 const [level,setLevel]=React.useState<number|null>(null),[error,setError]=React.useState('');
 React.useEffect(()=>{let active=true;setLevel(null);setError('');
  if(userId){if(lease)void getHuntingState(lease).then(s=>{if(active)setLevel(huntingLevel(s.experience));}).catch(()=>{if(active)setError('레벨을 불러오지 못했습니다. 거점에서 다시 열어주세요.');});}
  else {try{const raw=localStorage.getItem('tower-instant-hunting-guest-v1');const exp=raw?JSON.parse(raw).experience:0;setLevel(huntingLevel(Number.isFinite(exp)?exp:0));}catch{setLevel(1);}}
  return()=>{active=false;};
 },[userId,lease?.leaseId,lease?.generation]);
 return <StatAllocationScreen game={game} level={level} error={error} onHome={onHome}/>;
}
