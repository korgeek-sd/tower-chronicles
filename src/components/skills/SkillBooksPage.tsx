import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {skillBooksRpc,type SkillBookSnapshot} from '../../online/skillBooks';
import {SkillTreeScreen} from './SkillTreeScreen';
export function SkillBooksPage({game,onHome,lease,onSnapshot,initialSkillId,onMarket}:{game:GameState;onHome:()=>void;lease:GameplayLease|null;onSnapshot:(s:SkillBookSnapshot)=>void;initialSkillId?:string|null;onMarket?:(id:string)=>void}){
 const [state,setState]=useState<SkillBookSnapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const generation=useRef(0),pending=useRef(false),snapshotCallback=useRef(onSnapshot);snapshotCallback.current=onSnapshot;
 useEffect(()=>{const token=++generation.current;setState(null);setError('');pending.current=false;if(!lease)return;setBusy(true);pending.current=true;skillBooksRpc(lease).then(s=>{if(token===generation.current){setState(s);snapshotCallback.current(s);}}).catch(e=>{if(token===generation.current)setError(e instanceof Error?e.message:'현황을 불러오지 못했습니다.');}).finally(()=>{if(token===generation.current){setBusy(false);pending.current=false;}});return()=>{generation.current++;};},[lease?.leaseId,lease?.generation,refresh]);
 const act=async(id:string,expectedLevel?:number)=>{if(!lease||pending.current)return;const token=generation.current;pending.current=true;setBusy(true);setError('');try{const s=await skillBooksRpc(lease,id,expectedLevel);if(token===generation.current){setState(s);snapshotCallback.current(s);}}catch(e){if(token===generation.current){setError(e instanceof Error?e.message:'스킬 처리에 실패했습니다.');try{const s=await skillBooksRpc(lease);if(token===generation.current){setState(s);snapshotCallback.current(s);}}catch{}}}finally{if(token===generation.current){pending.current=false;setBusy(false);}}};
 const initialSkill=SKILL_TREE_CATALOG.find(skill=>skill.id===initialSkillId);
 const display=state?{...game,skillEnhancements:state.enhancements??{},market:{...game.market,gold:state.gold??state.record?.payload.market.gold??game.market.gold},skillBooks:{...game.skillBooks,...state.books},learned:[...game.learned.filter(id=>!SKILL_TREE_CATALOG.some(skill=>skill.id===id)), ...state.learned]}:game;
 return <SkillTreeScreen game={display} onHome={onHome} initialWeapon={initialSkill?.weapon} initialType={initialSkill?.type} initialSkillId={initialSkillId??undefined} onMarket={onMarket} onLearn={lease&&state? id=>act(id):undefined} onEnhance={lease&&state?act:undefined} busy={busy} error={error} loginRequired={!lease} onRefresh={lease?()=>setRefresh(n=>n+1):undefined}/>;
}
