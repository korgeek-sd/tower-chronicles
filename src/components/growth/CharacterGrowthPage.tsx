import React,{useEffect,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getCharacterGrowth,type CharacterGrowthSnapshot} from '../../online/characterGrowth';
import {CharacterGrowthScreen} from './CharacterGrowthScreen';
type Props={userId:string|null;lease:GameplayLease|null;nickname?:string;onClose:()=>void;onStats:()=>void;onEquipment:()=>void;onSeals:()=>void;onCollection:()=>void;onGrowthRecord:()=>void};
export function CharacterGrowthPage({userId,lease,nickname,...actions}:Props){
 const identity=JSON.stringify([userId,lease?.leaseId,lease?.generation,lease?.clientInstanceId]);
 const [snapshot,setSnapshot]=useState<{identity:string;data:CharacterGrowthSnapshot}|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setSnapshot(null);setError('');setLoading(!!userId&&!!lease);
  if(userId&&lease)void getCharacterGrowth(lease).then(data=>{if(active)setSnapshot({identity,data});}).catch(e=>{if(active)setError(e instanceof Error?e.message:'성장 정보를 확인하지 못했습니다.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[identity,retry]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setRetry(n=>n+1);};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 return <CharacterGrowthScreen {...actions} nickname={nickname} data={snapshot?.identity===identity?snapshot.data:null} loading={loading} error={error} accessMessage={!userId?'로그인 후 성장 현황을 확인할 수 있습니다.':!lease?'플레이 권한을 확인하고 있습니다.':''} onRetry={()=>setRetry(n=>n+1)}/>;
}
