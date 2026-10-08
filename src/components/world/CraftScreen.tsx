import React,{useEffect,useRef,useState} from 'react';
import {InventorySlot,ItemStack} from '@malilion/block-ui-react';
import '@malilion/block-ui-react/styles.css';
import {Glyph} from '../../ui/mobile';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {CraftItemArt} from './CraftItemArt';
import './craft-screen.css';
import {CRAFT_RECIPES,PRODUCT_NAMES,craftLimit,craftPreview,type ProductId} from '../../game/life/crafting';
import {LIFE_MATERIAL_NAMES,type VillageLifeState} from '../../online/villageLife';

export type ConfirmedCraftResult={requestId:string;product:ProductId;quantity:number};
type Props={state:VillageLifeState;busy:boolean;count:number;recipe:ProductId;confirmedResult?:ConfirmedCraftResult|null;onRecipe:(id:ProductId)=>void;onCount:(n:number)=>void;onCraft:(id:ProductId)=>void;onTravel?:(id:string)=>void;onMap?:()=>void};

function CraftDialog({label,onClose,returnFocus,children}:{label:string;onClose:()=>void;returnFocus:React.RefObject<HTMLButtonElement|null>;children:React.ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const element=dialog.current!,previous=returnFocus.current;
  element.showModal();
  element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  return()=>{
   element.close();
   if(previous?.isConnected){
    const workshop=previous.closest<HTMLElement>('.tc-game-craft');
    const target=previous.disabled?(workshop?.querySelector<HTMLButtonElement>('.tc-item-tabs button[aria-pressed="true"]:not(:disabled)')??workshop):previous;
    target?.focus();
   }
  };
 },[]);
 return <dialog ref={dialog} className="tc-craft-dialog" aria-label={label} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }}>{children}</dialog>;
}

export function CraftScreen({state,busy,count,recipe,confirmedResult,onRecipe,onCount,onCraft,onTravel,onMap}:Props){
 const town=state.towns.find(t=>t.id===state.location)!,recipes=CRAFT_RECIPES,r=recipes.find(r=>r.id===recipe)??recipes[0],mastery=state.craftMastery??0;
 const local=town.kind==='city'||town.kind===r.kind,locationHint=r.kind==='city'?'노바르에서 제작':`${r.kind==='herb'?'약초':'농사'} 마을 또는 노바르에서 제작`;
 const limit=craftLimit(state,r.id),quantity=Math.max(1,Math.min(100,Math.floor(count)||1));
 const preview=craftPreview(r.id,quantity,mastery,state.craftCarry?.[r.id]??0),base=r.base*quantity,required=quantity*10,owned=state.materials[r.material]??0,canCraft=!busy&&quantity<=limit;
 const [confirm,setConfirm]=useState(false),[completed,setCompleted]=useState<{id:ProductId;quantity:number}|null>(null);
 const craftButton=useRef<HTMLButtonElement>(null);
 const shownRequest=useRef(confirmedResult?.requestId),feel=useGameFeel();
 useEffect(()=>{
  if(!confirmedResult||shownRequest.current===confirmedResult.requestId||busy)return;
  shownRequest.current=confirmedResult.requestId;
  if(confirmedResult.quantity>0){setCompleted({id:confirmedResult.product,quantity:confirmedResult.quantity});feel.play('ui.confirm');}
 },[busy,confirmedResult,feel]);
 return <div className="tc-craft tc-game-craft" role="region" aria-label="제작소" tabIndex={-1} aria-busy={busy}>
  <header className="tc-craft-header">
   <div className="tc-workshop-location"><span>{town.name}</span><small>제작 숙련도 <b>{mastery.toLocaleString()}</b> · +{Math.min(50,Math.floor(mastery/100))}%</small></div>
   <div className="tc-craft-ap"><span>생활 행동력 <b>{state.actionPoints} / 100</b></span><div role="progressbar" aria-label="생활 행동력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.actionPoints}><i style={{width:Math.max(0,Math.min(100,state.actionPoints))+'%'}}/></div></div>
   <button type="button" disabled={busy} onClick={local?onMap:()=>onTravel?.('city')}>{local?'마을 이동':'노바르로 이동'}</button>
  </header>
  <div className="tc-craft-scroll">
   <section className="tc-craft-recipes" aria-label="전체 5종 제작 도안">
    <div className="tc-item-tabs" role="group" aria-label="제작 도안">{recipes.map(item=><button type="button" key={item.id} className={'tc-feel-press '+(r.id===item.id?'active':'')} aria-pressed={r.id===item.id} disabled={busy} onClick={()=>onRecipe(item.id)}><CraftItemArt id={item.id}/><span>{PRODUCT_NAMES[item.id]}</span></button>)}</div>
   </section>
   <section className={'tc-craft-board'+(busy?' working':'')} aria-label="제작 작업대">
    <div className="tc-craft-section-title"><span>{busy?'제작 요청 처리 중…':local?'재료 → 완성품':locationHint}</span></div>
    <div className="tc-craft-material"><InventorySlot className={'tc-craft-slot'+(owned<required?' insufficient':'')} size="lg" label={LIFE_MATERIAL_NAMES[r.material]}><ItemStack name={LIFE_MATERIAL_NAMES[r.material]} icon={<CraftItemArt id={r.material}/>}/></InventorySlot><div><small>필요 재료</small><strong>{LIFE_MATERIAL_NAMES[r.material]}</strong><span>{owned.toLocaleString()} / {required.toLocaleString()}</span><em className={owned<required?'insufficient':''}>{owned<required?`부족 ${required-owned}개`:'재료 확보'}</em></div></div>
    <div className="tc-craft-arrow" aria-hidden="true"><i/><span>◇</span><i/></div>
    <div className="tc-craft-result">
     <small>예상 완성품 미리보기</small>
     <div className="tc-craft-result-halo"><InventorySlot className="tc-craft-slot tc-craft-product-slot" size="lg" label={PRODUCT_NAMES[r.id]}><ItemStack name={PRODUCT_NAMES[r.id]} icon={<CraftItemArt id={r.id}/>}/></InventorySlot></div>
     <h3>{PRODUCT_NAMES[r.id]}</h3><b className="tc-craft-yield">×{preview.quantity.toLocaleString()}</b><span className="tc-craft-owned">보유 {(state.products?.[r.id]??0).toLocaleString()}개</span>
    </div>
    <p className="tc-craft-description">{r.description}</p>
    <div className="tc-craft-breakdown"><span>기본 생산 <b>{base.toLocaleString()}</b></span><span>숙련 보너스 <b>+{(preview.quantity-base).toLocaleString()}</b></span></div>
   </section>
   <div className="tc-life-quantity"><div className="tc-craft-section-title"><h3>제작 횟수</h3><span>최대 {limit}회</span></div><div role="group" aria-label="제작 횟수">{[1,10,limit].map((value,index)=><button type="button" className="tc-feel-press" key={index} disabled={busy||value<1||value>limit} aria-pressed={quantity===value&&(index<2||value!==1&&value!==10)} onClick={()=>onCount(value)}>{index===2?'최대':value+'회'}</button>)}</div></div>
  </div>
  <footer className="tc-craft-footer">
   <button ref={craftButton} type="button" className="tc-action tc-feel-press tc-craft-main" disabled={!canCraft} onClick={()=>{feel.play('ui.press');setConfirm(true);}}><Glyph name="craft"/><span>{busy?'제작 중…':`제작하기 ${quantity}회`}</span><small>×{preview.quantity.toLocaleString()}</small></button>
   <div className="tc-craft-status" role="status">{busy?'제작 요청 처리 중…':!local?locationHint:limit===0?'재료 또는 행동력이 부족합니다.':quantity>limit?'선택한 횟수에 필요한 재료 또는 행동력이 부족합니다.':`행동력 ${quantity} · 재료 ${required}개 소비`}</div>
   {busy&&<div className="tc-craft-progress" role="progressbar" aria-label="제작 요청 처리 중"><span/></div>}
  </footer>
  {completed&&<CraftDialog returnFocus={craftButton} label="제작 완료" onClose={()=>setCompleted(null)}><div className="tc-craft-success"><small>CRAFT COMPLETE</small><div className="tc-craft-reward"><CraftItemArt id={completed.id}/></div><h3>제작 완료!</h3><p>{PRODUCT_NAMES[completed.id]} <strong>×{completed.quantity.toLocaleString()}</strong></p><span>완성품을 가방에 보관했습니다.</span><button type="button" onClick={()=>setCompleted(null)}>확인</button></div></CraftDialog>}
  {confirm&&<CraftDialog returnFocus={craftButton} label="제작 확인" onClose={()=>setConfirm(false)}><div className="tc-craft-confirm-art"><CraftItemArt id={r.id}/></div><h3>제작 확인</h3><p>{PRODUCT_NAMES[r.id]} {quantity}회 제작</p><p>행동력 {quantity}, 재료 {required}개 소비</p><div className="tc-craft-dialog-actions"><button type="button" onClick={()=>setConfirm(false)}>취소</button><button type="button" disabled={!canCraft} onClick={()=>{setConfirm(false);onCraft(r.id);}}>제작 확정</button></div></CraftDialog>}
 </div>;
}
