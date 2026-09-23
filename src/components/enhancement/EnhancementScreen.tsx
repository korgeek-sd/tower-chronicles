import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import {enhanceEquipment} from '../../game/engine/enhancement';
import {EnhancementItemCard} from './EnhancementItemCard';
import {EnhancementPreview} from './EnhancementPreview';
import {EnhancementConfirm} from './EnhancementConfirm';
import './enhancement.css';

export function EnhancementScreen({game,setGame,onBack}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onBack:()=>void}){
  const [selectedId,setSelectedId]=useState<string|null>(null),[confirm,setConfirm]=useState(false);
  const items=useMemo(()=>game.items.slice().sort((a,b)=>Number(Object.values(game.equipped).includes(b.id))-Number(Object.values(game.equipped).includes(a.id))||b.tier-a.tier||b.enhancement-a.enhancement||a.id.localeCompare(b.id)),[game.items,game.equipped]);
  const selected=items.find(item=>item.id===selectedId)??null;
  useEffect(()=>{if(selectedId&&!game.items.some(item=>item.id===selectedId)){setSelectedId(null);setConfirm(false);}},[game.items,selectedId]);
  return <section className="enhancement-screen">
    <button className="back" onClick={onBack}>← 공방</button>
    <div className="section-label">WORKSHOP / ENHANCEMENT</div>
    <div className="section-heading"><div><h1>장비 강화</h1><p className="muted">확률에 따라 성공·유지·하락·파괴가 발생합니다.</p></div><span>◉ {game.silver.toLocaleString()} S</span></div>
    <div className="note">+1 시도는 파괴와 하락이 없습니다. +2부터 파괴 위험이 발생하며, 모든 시도는 결과와 관계없이 비용을 소모합니다.</div>
    <div className="enhancement-layout">
      <section className="panel enhancement-list"><h2>보유 장비</h2>{items.length?items.map(item=><EnhancementItemCard key={item.id} item={item} equipped={Object.values(game.equipped).includes(item.id)} selected={selectedId===item.id} onSelect={()=>setSelectedId(item.id)}/>):<p className="muted">강화할 장비가 없습니다.</p>}</section>
      {selected?<EnhancementPreview game={game} item={selected} onAttempt={()=>setConfirm(true)}/>:<section className="panel enhancement-empty"><h2>장비를 선택하세요</h2><p className="muted">강화 단계별 확률, 비용과 다음 성능을 확인할 수 있습니다.</p></section>}
    </div>
    {confirm&&selected&&<EnhancementConfirm game={game} item={selected} onCancel={()=>setConfirm(false)} onConfirm={()=>{setGame(s=>enhanceEquipment(s,selected.id));setConfirm(false);}}/>}
  </section>;
}
