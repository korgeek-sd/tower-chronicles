import React,{useEffect,useRef,useState} from 'react';
import {InventorySlot,ItemStack} from '@malilion/block-ui-react';
import '@malilion/block-ui-react/styles.css';
import {Glyph} from '../../ui/mobile';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {CraftItemArt} from './CraftItemArt';
import './craft-screen.css';
import './forge-craft.css';
import './forge-craft-layout.css';
import {CraftPendingIndicator,CraftReceiptNotifications} from './CraftFeedback';
import {CRAFT_RECIPES,PRODUCT_NAMES,craftLimit,craftPreview,lifeMasteryTrack,lifeMasteryLevel,lifeMasteryBonus,craftDurationSeconds,LIFE_MASTERY_NAMES,LIFE_MASTERY_LEVEL_XP,LIFE_MASTERY_MAX_XP,type ProductId} from '../../game/life/crafting';
import {LIFE_MATERIAL_NAMES,type VillageLifeState,type CraftQueueJob} from '../../online/villageLife';

export type ConfirmedCraftResult={requestId:string;product:ProductId;quantity:number};
type Props={state:VillageLifeState;busy:boolean;count:number;recipe:ProductId;confirmedResult?:ConfirmedCraftResult|null;onRecipe:(id:ProductId)=>void;onCount:(n:number)=>void;onCraft:(id:ProductId)=>void;onTravel?:(id:string)=>void;onMap?:()=>void;onFindMaterials?:(item:ProductId,count:number)=>void;onOpenInventory?:()=>void;queue?:CraftQueueJob[];now?:number;onClaim?:(id:string)=>void;onCancel?:(id:string)=>void};

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

function formatCraftTime(milliseconds:number){const total=Math.max(0,Math.ceil(milliseconds/1000));const two=(v:number)=>String(v).padStart(2,'0');return total>=3600?`${two(Math.floor(total/3600))}:${two(Math.floor(total%3600/60))}:${two(total%60)}`:`${two(Math.floor(total/60))}:${two(total%60)}`;}
export function CraftScreen({state,busy,count,recipe,confirmedResult,onRecipe,onCount,onCraft,onTravel,onMap,onFindMaterials,onOpenInventory,queue=[],now=0,onClaim,onCancel}:Props){
 const town=state.towns.find(t=>t.id===state.location)!,recipes=CRAFT_RECIPES,r=recipes.find(r=>r.id===recipe)??recipes[0],track=lifeMasteryTrack(r.id),mastery=state.lifeMasteries?.[track]??0,level=lifeMasteryLevel(mastery),nextXp=LIFE_MASTERY_LEVEL_XP[level]??null,bonus=lifeMasteryBonus(mastery);
 const local=town.kind==='city'||town.kind===r.kind,locationHint=r.kind==='city'?'노바르에서 제작':`${r.kind==='herb'?'약초':'농사'} 마을 또는 노바르에서 제작`;
 const limit=craftLimit(state,r.id),quantity=Math.max(1,Math.min(100,Math.floor(count)||1)),queueFull=queue.length>=3;
 const queuedMastery=queue.reduce((total,job)=>total+(lifeMasteryTrack(job.item)===track?job.count:0),0);
 const preview=craftPreview(r.id,quantity,Math.min(LIFE_MASTERY_MAX_XP,mastery+queuedMastery),state.craftCarry?.[r.id]??0),base=r.base*quantity,required=quantity*10,owned=state.materials[r.material]??0,canCraft=!busy&&!queueFull&&quantity<=limit;
 const craftState=busy?'working':queueFull?'queue-full':state.vitality<1&&r.material!=='stone'?'action-points':owned<required?'materials':!local?'location':state.vitality<quantity?'action-points':'ready';
 const mainActionEnabled=!busy&&(canCraft||queueFull||craftState==='materials'&&!!onFindMaterials||craftState==='location'&&!!onTravel||craftState==='action-points'&&!!onOpenInventory);
 const mainLabel=busy?'제작 중…':queueFull?'제작 대기열 확인':craftState==='materials'?(r.material==='stone'?'장비 분해하러 가기':r.material==='herb'?'약초 채집하러 가기':'농사하러 가기'):craftState==='location'?'제작 가능한 마을 이동':craftState==='action-points'?'활력 회복 포션 확인':`제작하기 ${quantity}회`;
 const [confirm,setConfirm]=useState(false),[receipts,setReceipts]=useState<ConfirmedCraftResult[]>([]);
 const dismissReceipt=React.useCallback((id:string)=>setReceipts(v=>v.filter(r=>r.requestId!==id)),[]);
 const craftButton=useRef<HTMLButtonElement>(null),queueTitle=useRef<HTMLHeadingElement>(null);
 const shownRequest=useRef(confirmedResult?.requestId),feel=useGameFeel();
 useEffect(()=>{
  if(!confirmedResult||shownRequest.current===confirmedResult.requestId||busy)return;
  shownRequest.current=confirmedResult.requestId;
  if(confirmedResult.quantity>0){setReceipts(previous=>[confirmedResult,...previous].slice(0,3));feel.play('ui.confirm');}
 },[busy,confirmedResult,feel]);
 return <div className="tc-craft tc-game-craft tc-blueprint-craft tc-forge-craft" data-craft-state={craftState} role="region" aria-label="제작소" tabIndex={-1} aria-busy={busy}>
  <header className="tc-craft-header">
   <div className="tc-craft-mastery-symbol"><CraftItemArt id={r.material}/></div>
   <div className="tc-workshop-location">
    <span>{LIFE_MASTERY_NAMES[track]} <b>Lv.{level}</b> <em>{mastery.toLocaleString()} / {nextXp===null?'MAX':nextXp.toLocaleString()}</em></span>
    <div className="tc-craft-mastery-meter" role="progressbar" aria-label="생활 숙련도" aria-valuemin={LIFE_MASTERY_LEVEL_XP[level-1]??0} aria-valuemax={nextXp??LIFE_MASTERY_MAX_XP} aria-valuenow={mastery}><i style={{width:(nextXp===null?100:100*Math.max(0,Math.min(1,(mastery-(LIFE_MASTERY_LEVEL_XP[level-1]??0))/(nextXp-(LIFE_MASTERY_LEVEL_XP[level-1]??0)))) )+'%'}}/></div>
   </div>
   <span className="tc-craft-bonus">제작 +{bonus}%</span>
   <div className="tc-craft-ap"><span>⚡ 생활 활력 <b>{state.vitality} / 100</b></span><div role="progressbar" aria-label="생활 활력" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,state.vitality)}><i style={{width:Math.max(0,Math.min(100,state.vitality))+'%'}}/></div></div>
   <button className="tc-craft-travel tc-feel-press" type="button" disabled={busy} onClick={local?onMap:()=>onTravel?.('city')}>{local?'마을 이동':'노바르로 이동'}</button>
  </header>
  <div className="tc-forge-shell">
   <aside className="tc-craft-recipes" aria-label="제작 도안 목록">
    <div className="tc-item-tabs" role="group" aria-label="제작 도안">{recipes.map(item=><button type="button" key={item.id} className={'tc-feel-press '+(r.id===item.id?'active':'')} aria-pressed={r.id===item.id} disabled={busy} onClick={()=>onRecipe(item.id)}><CraftItemArt id={item.id}/><span>{PRODUCT_NAMES[item.id]}</span></button>)}</div>
   </aside>
   <div className="tc-forge-workspace">
   <section className={'tc-craft-board'+(busy?' working':'')} aria-label="제작 작업대">
    <div className="tc-craft-result">
     <div className="tc-craft-result-halo"><InventorySlot className="tc-craft-slot tc-craft-product-slot" size="lg" label={PRODUCT_NAMES[r.id]}><ItemStack name={PRODUCT_NAMES[r.id]} icon={<CraftItemArt id={r.id}/>}/></InventorySlot></div>
     <div className="tc-craft-result-copy">
      <small className="tc-craft-result-eyebrow">예상 완성품 미리보기</small>
      <div className="tc-craft-result-caption"><h3>{PRODUCT_NAMES[r.id]}</h3><span className="tc-craft-category">소모품</span></div>
      <p className="tc-craft-description">{r.description}</p>
      <div className="tc-craft-owned">보유 {(state.products?.[r.id]??0).toLocaleString()}개</div>
      <div className="tc-craft-result-forecast">예상 제작 <b className="tc-craft-yield">×{preview.quantity.toLocaleString()}</b></div>
     </div>
    </div>
    <div className="tc-craft-material" data-sufficient={owned>=required}>
     <div className="tc-craft-material-heading"><strong>✦ 필요 재료</strong><span>필요 수량　보유 수량</span></div>
     <div className="tc-craft-material-row">
      <InventorySlot className={'tc-craft-slot'+(owned<required?' insufficient':'')} size="lg" label={LIFE_MATERIAL_NAMES[r.material]}><ItemStack name={LIFE_MATERIAL_NAMES[r.material]} icon={<CraftItemArt id={r.material}/>}/></InventorySlot>
      <div className="tc-craft-material-copy"><b>{LIFE_MATERIAL_NAMES[r.material]}</b><small>{owned<required?`부족 ${required-owned}개`:'재료 확보'}</small></div>
      <strong className="tc-craft-material-amount">{required.toLocaleString()} <i>/</i> <span className={owned<required?'insufficient':''}>{owned.toLocaleString()}</span></strong>
     </div>
    </div>
    <div className="tc-craft-breakdown"><span>기본 생산 <b>{base.toLocaleString()}</b></span><span>숙련 보너스 <b>+{(preview.quantity-base).toLocaleString()}</b></span></div>
   </section>
  <footer className="tc-craft-footer">
   <div className="tc-life-quantity">
    <div className="tc-craft-section-title"><h3>제작 횟수</h3><span>최대 {limit}회</span></div>
    <div role="group" aria-label="제작 횟수">
     <button type="button" className="tc-feel-press tc-craft-step" aria-label="제작 횟수 감소" disabled={busy||quantity<=1} onClick={()=>onCount(Math.max(1,quantity-1))}>−</button>
     <output className="tc-craft-count" aria-live="polite">{quantity}회</output>
     <button type="button" className="tc-feel-press tc-craft-step" aria-label="제작 횟수 증가" disabled={busy||quantity>=100} onClick={()=>onCount(Math.min(100,quantity+1))}>＋</button>
     <button type="button" className="tc-feel-press tc-craft-preset" aria-pressed={quantity===10} disabled={busy} onClick={()=>onCount(10)}>10회</button>
     <button type="button" className="tc-feel-press tc-craft-preset" aria-pressed={limit>0&&quantity===limit} disabled={busy||limit<1} onClick={()=>onCount(limit)}>최대</button>
    </div>
   </div>
   <div className="tc-craft-cost-line">
    <span>◉ 제작 비용 <b>활력 {quantity}</b></span>
    <span>◷ 제작 시간 <b>{formatCraftTime(craftDurationSeconds(r.id,quantity)*1000)}</b></span>
   </div>
   <button ref={craftButton} type="button" className="tc-action tc-feel-press tc-craft-main" disabled={!mainActionEnabled} onClick={()=>{feel.play('ui.press');if(queueFull){queueTitle.current?.focus();queueTitle.current?.scrollIntoView?.({behavior:'smooth',block:'nearest'});}else if(craftState==='materials')onFindMaterials?.(r.id,quantity);else if(craftState==='location')onTravel?.('city');else if(craftState==='action-points')onOpenInventory?.();else if(canCraft)setConfirm(true);}}><Glyph name="craft"/><span>{mainLabel}</span><small>{craftState==='materials'?`부족 ${Math.max(0,required-owned).toLocaleString()}`:craftState==='ready'?`×${preview.quantity.toLocaleString()}`:''}</small></button>
   <div className="tc-craft-status" role="status">{busy?'제작 요청 처리 중…':queueFull?'제작 대기열이 가득 찼습니다':craftState==='materials'?`재료 부족 · ${required-owned}개 더 필요 · 수급 화면으로 이동`:!local?locationHint:craftState==='action-points'?`활력 부족 · ${quantity-state.vitality} 더 필요`:`제작 가능 · 활력 ${quantity} · 재료 ${required}개 소비`}</div>
   {busy&&<CraftPendingIndicator/>}
  </footer>
   </div>
  </div>
  <section className="tc-craft-queue" aria-label="제작 대기열">
   <div className="tc-craft-queue-header"><span className="tc-craft-queue-symbol" aria-hidden="true">⌛</span><h3 ref={queueTitle} tabIndex={-1}>제작 대기열</h3><b>{queue.length} / 3</b><small>순차 제작 · 수동 수령</small></div>
   <div className="tc-craft-queue-list">
    {Array.from({length:3},(_,slot)=>{
     const job=queue[slot];
     if(!job)return <div key={slot} className="tc-craft-queue-card empty"><span className="tc-craft-queue-plus" aria-hidden="true">＋</span><span>빈 슬롯</span></div>;
     const status=now>=job.endsAt?'complete':now>=job.startsAt?'crafting':'waiting';
     const progress=Math.max(0,Math.min(100,100*(now-job.startsAt)/Math.max(1,job.endsAt-job.startsAt)));
     return <div key={job.id} className={'tc-craft-queue-card '+status}>
      <div className="tc-craft-queue-item"><CraftItemArt id={job.item}/><div><strong>{PRODUCT_NAMES[job.item]}</strong><small>×{job.quantity.toLocaleString()}</small></div></div>
      <div className="tc-craft-queue-state">{status==='complete'?'제작 완료':status==='crafting'?'제작 중':'대기 중'}</div>
      {status==='crafting'&&<div className="tc-craft-queue-progress" role="progressbar" aria-label={PRODUCT_NAMES[job.item]+' 제작 진행률'} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:progress+'%'}}/></div>}
      {status!=='complete'&&<small className="tc-craft-queue-time">{status==='waiting'?'예상 '+formatCraftTime(job.durationSeconds*1000):formatCraftTime(job.endsAt-now)}</small>}
      {status==='complete'?<button type="button" className="tc-feel-press tc-craft-claim" onClick={()=>onClaim?.(job.id)} disabled={busy||!onClaim}>수령</button>:<button type="button" className="tc-feel-press tc-craft-cancel" onClick={()=>onCancel?.(job.id)} disabled={busy||!onCancel}>취소</button>}
     </div>;
    })}
   </div>
  </section>
  <CraftReceiptNotifications receipts={receipts} onDismiss={dismissReceipt}/>
  {confirm&&<CraftDialog returnFocus={craftButton} label="제작 확인" onClose={()=>setConfirm(false)}><div className="tc-craft-confirm-art"><CraftItemArt id={r.id}/></div><h3>제작 확인</h3><p>{PRODUCT_NAMES[r.id]} {quantity}회 제작</p><p>활력 {quantity}, 재료 {required}개를 사용해 대기열에 등록합니다.</p><p>제작 시간 {formatCraftTime(craftDurationSeconds(r.id,quantity)*1000)} · 완료 후 수동 수령</p><div className="tc-craft-dialog-actions"><button type="button" onClick={()=>setConfirm(false)}>취소</button><button type="button" disabled={!canCraft} onClick={()=>{setConfirm(false);onCraft(r.id);}}>제작 확정</button></div></CraftDialog>}
 </div>;
}
