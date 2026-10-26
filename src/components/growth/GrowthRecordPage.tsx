import React,{useEffect,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {loadGrowthRecord} from './growthRecord';
import {GrowthRecordScreen} from './GrowthRecordScreen';

type Props={userId:string|null;lease:GameplayLease|null;nickname?:string;onClose:()=>void;onStats:()=>void;onProduction:()=>void;onCraft:()=>void};
export function GrowthRecordPage({userId,lease,nickname,...actions}:Props){
 const identity=JSON.stringify([userId,lease?.leaseId,lease?.generation,lease?.clientInstanceId]);
 const [record,setRecord]=useState<(Awaited<ReturnType<typeof loadGrowthRecord>>&{identity:string})|null>(null);
 const [retry,setRetry]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  setRecord(null);setLoading(!!userId&&!!lease);
  if(userId&&lease){
   setLoading(true);
   void loadGrowthRecord(lease).then(next=>{if(active){setRecord({...next,identity});setLoading(false);}});
  }
  return()=>{active=false;};
 },[identity,retry]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setRetry(n=>n+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 const current=record?.identity===identity?record:null;
 const accessMessage=!userId?'로그인 후 성장 기록을 확인할 수 있습니다.':!lease?'플레이 권한을 확인하고 있습니다.':'';
 return <GrowthRecordScreen {...actions} nickname={nickname} hunting={current?.hunting??null} life={current?.life??null} loading={loading&&!!userId&&!!lease} huntingError={current?.huntingError} lifeError={current?.lifeError} accessMessage={accessMessage} navigationEnabled={!!userId&&!!lease} onRetry={()=>setRetry(n=>n+1)}/>;
}
