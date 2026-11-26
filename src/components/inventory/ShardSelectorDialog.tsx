import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {redeemShardSelector,VillageLifeRejected} from '../../online/villageLife';
import {APPEARANCES} from '../../game/data/cosmetics';
import {appearanceLevel,appearanceShardCount,APPEARANCE_UNLOCK_COST} from '../../game/data/appearanceProgress';
import {assetUrl} from '../../game/data/graphics';

import './shard-selector.css';

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
 return <dialog ref={dialog} className="tc-shard-sheet" aria-labelledby="shard-selector-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header className="tc-shard-heading">
   <div><h2 id="shard-selector-title">SSR 외형 조각 선택</h2><small>선택권 {stock}장</small></div>
   <button type="button" aria-label="닫기" disabled={busy} onClick={onClose}>×</button>
  </header>
  <div className="tc-shard-choices">{choices.map(appearance=>{
   const active=selected===appearance.id;
   const count=appearanceShardCount(game.cosmetics,appearance.id);
   const unlocks=appearanceLevel(game.cosmetics,appearance.id)===0 && count<APPEARANCE_UNLOCK_COST && count+3>=APPEARANCE_UNLOCK_COST;
   return <button type="button" className="tc-shard-choice" key={appearance.id} disabled={busy||!!pending.current} aria-pressed={active} onClick={()=>{setSelected(appearance.id);setMessage('');}}>
    {appearance.imagePath&&<img alt="" src={assetUrl(appearance.imagePath)}/>}
    <span><strong>{appearance.name}</strong><small>{active?count+'개 → '+(count+3)+'개':'보유 '+count+'개'}</small>
     {unlocks&&<small>수령 후 해금 가능</small>}
    </span>
   </button>;
  })}</div>
  <footer>{message&&<p role="alert">{message}</p>}
   <button type="button" className="tc-shard-use" disabled={disabled||busy||!lease||!choice||stock<1} onClick={()=>void receive()}>
    {busy?'사용 중…':pending.current?'결과 확인':'사용하기'}
    <span><img src={assetUrl('assets/ui/shop/appearance_summon_ticket_pixel.webp')} alt="선택권"/> ×1</span>
   </button>
  </footer>
 </dialog>;
}
