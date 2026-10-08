import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {HUNT_SKILLS,HUNT_MAPS,initialHuntingState,resolveHunt,type HuntingState,type HuntMapId} from '../../game/hunting/model';
import {stats} from '../../game/engine/state';
import {getHuntingState,huntOnce,saveHuntingPreset} from '../../online/hunting';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {HuntingScreen} from './HuntingScreen';
import './hunting.css';
const GUEST_KEY='tower-instant-hunting-guest-v1';
function loadGuest():HuntingState {try{const raw=localStorage.getItem(GUEST_KEY);if(raw){const s=JSON.parse(raw);if(Number.isInteger(s.vitality)&&s.vitality>=0&&s.vitality<=100&&Number.isFinite(s.recoveredAt)&&Number.isFinite(s.experience)&&Number.isFinite(s.mastery)&&Array.isArray(s.skills))return s;}}catch{}return initialHuntingState();}
type Props={game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;now:number;lease:GameplayLease|null;userId:string|null;nickname?:string;onPrepare:()=>Promise<void>;onPending:(pending:boolean)=>void;onRecord:(record:CloudSaveRecord)=>void};
export function HuntingPage({game,setGame,now,lease,userId,nickname,onPrepare,onPending,onRecord}:Props){
 const [state,setState]=useState<HuntingState|null>(userId?null:loadGuest),[busy,setBusy]=useState(false),[error,setError]=useState(''),[settings,setSettings]=useState(false),[draft,setDraft]=useState<string[]>([]),[offset,setOffset]=useState(0);
 const lock=useRef(false),alive=useRef(true),pending=useRef<{id:string;map:HuntMapId}|null>(null);
 const pendingKey=userId?'tower-hunt-pending:'+userId:null;
 const accept=(s:HuntingState&{serverNow?:number})=>{setState(s);if(s.serverNow)setOffset(s.serverNow-Date.now());};
 async function refresh(){if(userId){if(!lease)return;try{const result=await getHuntingState(lease);if(alive.current){accept(result);if(!pending.current)setError('');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'사냥 상태를 불러오지 못했습니다.');}}}
 useEffect(()=>{alive.current=true;void refresh();if(pendingKey)try{const raw=localStorage.getItem(pendingKey);if(raw){const p=JSON.parse(raw);if(typeof p.id==='string'&&HUNT_MAPS.some(m=>m.id===p.map)){pending.current=p;setError('이전 사냥 결과를 확인해야 합니다. 다시 확인을 눌러주세요.');}}}catch{}return()=>{alive.current=false;};},[userId,lease?.generation]);
 async function hunt(map:HuntMapId){
  if(lock.current||game.expedition||!state)return;
  if(userId&&!lease){setError('플레이 권한을 확인하고 있습니다.');return;}
  if(pending.current&&pending.current.map!==map){setError('이전 사냥 결과부터 다시 확인해 주세요.');return;}
  lock.current=true;setBusy(true);setError('');
  try{
   if(userId&&lease){
    await onPrepare();if(!alive.current)return;onPending(true);
    if(!pending.current){pending.current={id:crypto.randomUUID(),map};if(pendingKey)localStorage.setItem(pendingKey,JSON.stringify(pending.current));}
    const response=await huntOnce(lease,map,pending.current.id);
    if(!alive.current)return;onRecord(response.record);if(alive.current){accept({...response.state,serverNow:response.serverNow});setSettings(false);}
    pending.current=null;if(pendingKey)localStorage.removeItem(pendingKey);
   }else{
    const resolved=resolveHunt(state,map,stats(game),state.skills,now);localStorage.setItem(GUEST_KEY,JSON.stringify(resolved.state));setState(resolved.state);
    setGame(current=>{const next=structuredClone(current),m=HUNT_MAPS.find(x=>x.id===map)!;next.silver+=resolved.result.silver;next.materials[m.tower][0]+=resolved.result.materialCount;return next;});
   }
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'사냥을 처리하지 못했습니다.');}
  finally{onPending(false);lock.current=false;if(alive.current)setBusy(false);}
 }
 async function savePreset(){if(lock.current||!state)return;lock.current=true;setBusy(true);try{if(userId&&lease){const result=await saveHuntingPreset(lease,draft);if(!alive.current)return;accept(result);}else{const next={...state,skills:draft};localStorage.setItem(GUEST_KEY,JSON.stringify(next));setState(next);}setSettings(false);setError('');}catch(e){setError(e instanceof Error?e.message:'세팅을 저장하지 못했습니다.');}finally{lock.current=false;setBusy(false);}}
 return <><HuntingScreen game={game} hunting={state} now={now+offset} busy={busy||!!userId&&!lease} nickname={nickname} error={error} onHunt={id=>void hunt(id)} onSettings={()=>{setDraft(state?.skills??[]);setSettings(v=>!v);}} onRetry={()=>{if(pending.current&&state)void hunt(pending.current.map);else void refresh();}}/>
 {settings&&<section className="tc-hunt-preset tc-hunt-panel" aria-label="전투 세팅"><h2>스킬 사용 순서</h2><p>위에서부터 사용 가능한 스킬을 선택합니다. 모두 사용할 수 없으면 이번 턴은 대기합니다.</p>{HUNT_SKILLS.map(skill=><label key={skill.id}><input type="checkbox" checked={draft.includes(skill.id)} disabled={busy} onChange={()=>setDraft(ids=>ids.includes(skill.id)?ids.filter(id=>id!==skill.id):[...ids,skill.id])}/><span><b>{skill.name}</b><small>{skill.description}</small></span></label>)}<ol>{draft.map((id,i)=><li key={id}>{HUNT_SKILLS.find(s=>s.id===id)?.name}<button disabled={busy||i===0} aria-label="사용 순서 올리기" onClick={()=>setDraft(ids=>{const next=[...ids];[next[i-1],next[i]]=[next[i],next[i-1]];return next;})}>↑</button></li>)}</ol><button disabled={busy||!!userId&&!lease} onClick={()=>void savePreset()}>세팅 저장</button><button disabled={busy} onClick={()=>setSettings(false)}>닫기</button></section>}
 </>;
}
