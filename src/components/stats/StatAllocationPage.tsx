import React from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {allocateHuntingStats,getHuntingState,resetHuntingStats} from '../../online/hunting';
import {huntingLevel,initialHuntingState,normalizeStatAllocation,statPointsForLevel,statResetCost,usedStatPoints,type HuntingState,type StatAllocation} from '../../game/hunting/model';
import {StatAllocationScreen} from './StatAllocationScreen';
import './stats.css';
const GUEST_KEY='tower-instant-hunting-guest-v1';
const PENDING_RESET_KEY='tower-stat-reset-request-v1';
type Props={game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;userId:string|null;lease:GameplayLease|null;onHome:()=>void;onRecord?:(record:CloudSaveRecord)=>void;onPrepare?:()=>Promise<void>;onPending?:(v:boolean)=>void};
export function StatAllocationPage({game,setGame,userId,lease,onHome,onRecord,onPrepare,onPending}:Props){
 const [state,setState]=React.useState<HuntingState|null>(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const lock=React.useRef(false);
 const guestState=()=>{try{const data=JSON.parse(localStorage.getItem(GUEST_KEY)??'null');return data&&Number.isFinite(data.experience)?data as HuntingState:initialHuntingState();}catch{return initialHuntingState();}};
 React.useEffect(()=>{let active=true;setState(null);setError('');
  if(userId){if(lease)void getHuntingState(lease).then(s=>{if(active)setState(s);}).catch(()=>{if(active)setError('스탯 정보를 불러오지 못했습니다. 다시 열어주세요.');});}
  else setState(guestState());
  return()=>{active=false;};
 },[userId,lease?.leaseId,lease?.generation]);
 const level=state?huntingLevel(state.experience):null, allocation=normalizeStatAllocation(state?.statAllocation);
 const remaining=state?(state.statPoints??Math.max(0,statPointsForLevel(level!)-usedStatPoints(allocation))):0;
 const resets=state?.statResets??0;
 const saveGuest=(next:HuntingState)=>{localStorage.setItem(GUEST_KEY,JSON.stringify(next));setState(next);};
 async function act(action:'allocate'|'reset',points?:StatAllocation){
  if(lock.current||!state||!level||userId&&!lease)return;
  lock.current=true;setBusy(true);setError('');
  try{
   if(userId&&lease){
    await onPrepare?.();onPending?.(true);
    const resetId=action==='reset'?(localStorage.getItem(PENDING_RESET_KEY)||crypto.randomUUID()):null;
    if(resetId)localStorage.setItem(PENDING_RESET_KEY,resetId);
    const reply=action==='allocate'?await allocateHuntingStats(lease,points!):await resetHuntingStats(lease,resetId!);
    if(resetId)localStorage.removeItem(PENDING_RESET_KEY);
    setState(reply.state);
    onRecord?.(reply.record);
   }else if(action==='allocate'){
    saveGuest({...state,statAllocation:points});
   }else{
    const cost=statResetCost(level,resets);
    if(game.silver<cost)throw Error('스탯 초기화에 필요한 실버가 부족합니다.');
    saveGuest({...state,statAllocation:{hp:0,attack:0,defense:0,crit:0},statResets:resets+1});
    if(cost>0)setGame(g=>({...g,silver:g.silver-cost}));
   }
  }catch(e){setError(e instanceof Error?e.message:'스탯 변경에 실패했습니다. 다시 확인해 주세요.');}
  finally{lock.current=false;setBusy(false);if(userId)onPending?.(false);}
 }
 const reset=()=>{if(!state||!level)return;const cost=statResetCost(level,resets);
  if(window.confirm(cost===0?'첫 번째 스탯 초기화를 무료로 진행할까요?':`스탯을 초기화하고 ${cost.toLocaleString()} 실버를 소모할까요?`))void act('reset');
 };
 return <StatAllocationScreen game={game} level={level} allocation={allocation} remaining={remaining} resets={resets} combatStats={state?.combatStats} busy={busy||!!userId&&!lease} error={error} onHome={onHome} onConfirm={points=>void act('allocate',points)} onReset={reset}/>;
}
