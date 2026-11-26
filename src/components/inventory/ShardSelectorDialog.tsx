import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {redeemShardSelector,VillageLifeRejected} from '../../online/villageLife';
import {APPEARANCES} from '../../game/data/cosmetics';
import {appearanceLevel,appearanceShardCount,APPEARANCE_UNLOCK_COST} from '../../game/data/appearanceProgress';
import {assetUrl} from '../../game/data/graphics';

const choices=APPEARANCES.filter(appearance=>appearance.rarity==='SSR');
type Props={
 game:GameState;lease:GameplayLease|null;stock:number;disabled:boolean;
 onClose:()=>void;
 onReceived:(name:string,result:Awaited<ReturnType<typeof redeemShardSelector>>)=>void;
};
export function ShardSelectorDialog({game,lease,stock,disabled,onClose,onReceived}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const pending=useRef<{id:string;appearance:string;stock:number}|null>(null);
 const locked=useRef(false),mounted=useRef(false);
 const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const choice=choices.find(a=>a.id===selected);
 const balance=appearanceShardCount(game.cosmetics,selected);
 useEffect(()=>{
  mounted.current=true;
  const element=dialog.current;
  element?.showModal();
  return ()=>{mounted.current=false;element?.close();};
 },[]);
 async function receive(){
  if(!choice||!lease||disabled||locked.current)return;
  locked.current=true;setBusy(true);setMessage('');
  const request=pending.current??{id:crypto.randomUUID(),appearance:choice.id,stock};
  pending.current=request;
  try{
   const result=await redeemShardSelector(lease,request.id,request.appearance,request.stock);
   if(mounted.current)onReceived(choice.name,result);
  }catch(error){
   if(error instanceof VillageLifeRejected)pending.current=null;
   if(mounted.current)setMessage(error instanceof Error?error.message:'수령 결과를 다시 확인해 주세요.');
  }finally{
   locked.current=false;if(mounted.current)setBusy(false);
  }
 }
 return <dialog ref={dialog} aria-labelledby="shard-selector-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}} style={{width:'min(92vw,420px)',maxHeight:'85dvh',overflowY:'auto',background:'#171614',color:'#f0e4ce',border:'1px solid #96754f',padding:16}}>
  <h2 id="shard-selector-title">SSR 외형 조각 선택권</h2>
  <p>보유 {stock}장 · 원하는 외형의 조각 3개를 받습니다.</p>
  <div style={{display:'grid',gap:4}}>{choices.map(a=>
   <button key={a.id} disabled={busy||!!pending.current} aria-pressed={selected===a.id} onClick={()=>{setSelected(a.id);setMessage('');}} style={{display:'flex',alignItems:'center',gap:8,padding:6,textAlign:'left',color:'inherit',background:selected===a.id?'#4b3d29':'#242322',border:'1px solid '+(selected===a.id?'#eac478':'#514b41')}}>
    {a.imagePath&&<img src={assetUrl(a.imagePath)} alt="" width="40" height="40" style={{objectFit:'contain',imageRendering:'pixelated'}}/>}
    <span>{a.name}<br/><small>보유 조각 {appearanceShardCount(game.cosmetics,a.id)}개</small></span>
   </button>)}</div>
  {choice&&<p>{choice.name} · {balance}개 → {balance+3}개 {appearanceLevel(game.cosmetics,selected)===0&&balance+3>=APPEARANCE_UNLOCK_COST?' · 해금 가능':''}</p>}
  {message&&<p role="alert">{message}</p>}
  <button className="tc-action secondary" disabled={busy} onClick={onClose}>닫기</button>
  <button className="tc-action" disabled={disabled||busy||!lease||!choice} onClick={()=>void receive()}>{busy?'수령 중…':pending.current?'수령 결과 확인':'조각 3개 받기'}</button>
 </dialog>;
}
