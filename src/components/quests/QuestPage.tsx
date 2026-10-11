import React,{useEffect,useRef,useState} from 'react';
import {QuestScreen} from './QuestScreen';
import {getQuests,claimQuest,QuestRejected,validQuestClaim,questRewardSummary,type QuestBoard,type QuestClaim,type QuestEntry,type QuestPeriod} from '../../online/quests';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import type {AppPage} from '../mobile/CoreScreens';
export function QuestPage({userId,lease,onMove,onPrepare,onPending,onRecord}:{userId:string|null;lease:GameplayLease|null;onMove:(page:AppPage)=>void;onPrepare:()=>Promise<void>;onPending:(busy:boolean)=>void;onRecord:(record:CloudSaveRecord)=>void}){
 const [board,setBoard]=useState<QuestBoard|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const alive=useRef(true),lock=useRef(false),pending=useRef<QuestClaim|null>(null),callbacks=useRef({onPrepare,onPending,onRecord});callbacks.current={onPrepare,onPending,onRecord};
 const key=userId?'tower-quest-pending:'+userId:null;
 async function refresh(){if(lock.current||!lease||!userId)return;lock.current=true;try{const next=await getQuests(lease,userId);if(alive.current){setBoard(next);setError('');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'의뢰를 불러오지 못했습니다.');}finally{lock.current=false;}}
 async function execute(request:QuestClaim){if(lock.current||!lease||!userId)return;lock.current=true;setBusy(true);setError('');let economyPending=false;
  try{
   await callbacks.current.onPrepare();if(!alive.current)return;
   callbacks.current.onPending(true);economyPending=true;
   if(key)localStorage.setItem(key,JSON.stringify(request));pending.current=request;
   const result=await claimQuest(lease,userId,request);if(!alive.current)return;
   callbacks.current.onRecord(result.record);setBoard(result.board);setMessage(questRewardSummary(result.reward)+' 수령 완료');
   if(key)localStorage.removeItem(key);pending.current=null;
  }catch(e){if(alive.current){if(e instanceof QuestRejected){if(key)localStorage.removeItem(key);pending.current=null;}setError(e instanceof Error?e.message:'수령 결과를 다시 확인해 주세요.');}}
  finally{lock.current=false;if(economyPending)callbacks.current.onPending(false);if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;
  if(!lease||!userId){setError('로그인 후 플레이 권한을 확보하면 의뢰를 이용할 수 있습니다.');return()=>{alive.current=false;};}
  if(key)try{const raw=localStorage.getItem(key);if(raw){const value:unknown=JSON.parse(raw);if(validQuestClaim(value))pending.current=value;else localStorage.removeItem(key);}}catch{}
  if(pending.current)void execute(pending.current);else void refresh();
  const focus=()=>{if(pending.current)void execute(pending.current);else void refresh();};window.addEventListener('focus',focus);
  const timer=window.setInterval(()=>{if(!pending.current&&document.visibilityState==='visible')void refresh();},30000);
  return()=>{alive.current=false;window.removeEventListener('focus',focus);window.clearInterval(timer);};
 },[]);
 const claim=(period:QuestPeriod,q:QuestEntry)=>{if(!board)return;if(pending.current){void execute(pending.current);return;}void execute({period,day:period==='daily'?board.dailyKey:board.weeklyKey,id:q.id});};
 return <QuestScreen onMove={onMove} board={board} onClaim={claim} busy={busy} error={error} message={message} onRetry={()=>{if(pending.current)void execute(pending.current);else void refresh();}}/>;
}
