import React,{useEffect,useRef,useState} from 'react';
import {SSRReveal} from './SSRReveal';
import type {AppearanceSummonDraw} from '../../online/appearanceSummon';
import {APPEARANCES,APPEARANCE_BONUS_LABELS, type AppearanceData} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';

type Payment={ticketsUsed:number;goldSpent:number};
type ActualPayment={ticketsSpent:number;goldSpent:number};
export interface AppearanceSummonResultViewProps{
 draws:AppearanceSummonDraw[];
 /** Confirmed, non-replayed results only. Legacy flag now includes SR and SSR. */
 animateSSR?:boolean;
 payment:ActualPayment;
 repeatPayment:Payment;
 canRepeat:boolean;
 busy:boolean;
 selectedAppearanceId:string;
 expedition:boolean;
 onRepeat:()=>void;
 onClose:()=>void;
 onList:()=>void;
 onEquip?:(id:string)=>void;
 error?:string;
}
const catalog=new Map(APPEARANCES.map(appearance=>[appearance.id,appearance]));
export function summonPaymentText(p:Payment | ActualPayment){
 const tickets='ticketsUsed' in p?p.ticketsUsed:p.ticketsSpent;
 return [tickets?'소환권 '+tickets+'장':'',p.goldSpent?p.goldSpent.toLocaleString('ko-KR')+' G':''].filter(Boolean).join(' + ')||'재화 사용 없음';
}
function SummonArt({appearance,large=false}:{appearance:AppearanceData|undefined;large?:boolean}){
 return appearance?.imagePath
  ? <img className={large?'tc-summon-earned-art is-large':'tc-summon-earned-art'} src={assetUrl(appearance.imagePath)} alt="" draggable={false}/>
  : <span className="tc-summon-art-unavailable">외형 이미지 준비 중</span>;
}
/** Presentation queue only: preserve confirmed server order and duplicate draws. */
export function rareSummonDraws(draws:readonly AppearanceSummonDraw[]){return draws.filter(draw=>draw.rarity==='SR'||draw.rarity==='SSR');}
export function AppearanceSummonResultView({draws,payment,repeatPayment,canRepeat,busy,selectedAppearanceId,expedition,onRepeat,onClose,onList,onEquip,error,animateSSR=false}:AppearanceSummonResultViewProps){
 const [revealed,setRevealed]=useState(false);
 const resultClose=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(revealed)resultClose.current?.focus();},[revealed]);
 const queue=rareSummonDraws(draws);
 const [revealIndex,setRevealIndex]=useState(0);
 const rare=queue[revealIndex];
 const [detailIndex,setDetailIndex]=useState<number|null>(null);
 const isTen=draws.length===10,detail=draws[detailIndex??0],appearance=detail?catalog.get(detail.id):undefined;
 const shownSingle=!isTen||detailIndex!==null;
 const newCount=draws.filter(draw=>!draw.duplicate).length,duplicateCount=draws.length-newCount;
 const isEquipped=!!detail&&selectedAppearanceId===detail.id;
 const canEquip=!!appearance&&!expedition&&!busy&&!isEquipped&&!!onEquip;
 if(animateSSR&&rare&&!revealed)return <SSRReveal key={revealIndex} draw={rare} appearance={catalog.get(rare.id)} total={draws.length} sequenceIndex={revealIndex} sequenceTotal={queue.length} hasNext={revealIndex+1<queue.length} onSkip={()=>setRevealed(true)} onDone={()=>{if(revealIndex+1<queue.length)setRevealIndex(index=>index+1);else setRevealed(true);}} onRepeat={onRepeat} canRepeat={canRepeat} busy={busy} error={error}/>;
 return <div className="tc-summon-result-view">
  <header className="tc-summon-result-header">
   {isTen&&detailIndex!==null?<button type="button" aria-label="10회 소환 결과로 돌아가기" className="tc-summon-result-back" onClick={()=>setDetailIndex(null)}>‹</button>:null}
   <div><h2 id="summon-modal-title">{shownSingle&&isTen?'외형 상세 보기':isTen?'10회 소환 결과':'1회 소환 결과'}</h2><small>{shownSingle&&isTen?'획득한 외형 확인':'탑의 기록에 새로운 흔적이 남았습니다.'}</small></div>
   <button ref={resultClose} type="button" className="tc-summon-result-close" aria-label="소환 결과 닫기" disabled={busy} onClick={onClose}>×</button>
  </header>
  <div className={'tc-summon-result-content'+(shownSingle?' is-single':' is-ten')}>
   {!shownSingle?<div className="tc-summon-result-grid" aria-label="10회 소환으로 획득한 외형 10개">{draws.map((draw,index)=>{
    const item=catalog.get(draw.id);
    return <button type="button" key={index} className={'tc-summon-draw-card tc-summon-rarity-'+draw.rarity.toLowerCase()} data-rarity={draw.rarity} onClick={()=>setDetailIndex(index)} aria-label={draw.rarity+' '+(item?.name??draw.id)+' '+(draw.duplicate?'중복':'신규')+' 상세 보기'}>
     <div className="tc-summon-draw-art"><SummonArt appearance={item}/></div>
     <div className="tc-summon-draw-info"><span className="tc-summon-draw-grade">{draw.rarity}</span><strong>{item?.name??draw.id}</strong><span className={'tc-summon-acquisition '+(draw.duplicate?'is-duplicate':'is-new')}>{draw.duplicate?'중복':'신규'}</span></div>
    </button>;
   })}</div>
   :detail&&<div className={'tc-summon-single-stage tc-summon-rarity-'+detail.rarity.toLowerCase()} data-rarity={detail.rarity}>
     <p className="tc-summon-single-intro">{detail.duplicate?'이미 기록된 외형을 다시 발견했습니다.':'새로운 기록이 발견되었습니다.'}</p>
     <h3>{appearance?.name??detail.id}</h3>
     <strong className="tc-summon-single-grade">{detail.rarity} 등급</strong>
     <div className="tc-summon-single-art"><img className="tc-summon-earned-backdrop" src={assetUrl('assets/backgrounds/summon/summon-altar-v1.webp')} alt=""/><SummonArt appearance={appearance} large/></div>
     <div className={'tc-summon-single-status '+(detail.duplicate?'is-duplicate':'is-new')}>{detail.duplicate?'중복 획득':'신규 획득'}</div>
     <p className="tc-summon-single-description">{appearance?.description??'탑의 기록에 외형이 추가되었습니다.'}</p>
     <div className="tc-summon-single-effect"><strong>외형 효과</strong><span>{appearance?.proposedBonus?APPEARANCE_BONUS_LABELS[appearance.proposedBonus.stat]+' +'+appearance.proposedBonus.percent+'% (예정)':'능력치 변경 없음'}</span><small>외형 능력치 보너스는 현재 적용되지 않습니다.</small></div>
    </div>}
  </div>
  <footer className="tc-summon-result-footer">
   <div className="tc-summon-result-meta">
    {!shownSingle&&<p className="tc-summon-result-count">신규 {newCount}개 · 중복 {duplicateCount}개</p>}
    <p className="tc-summon-result-payment">사용: {summonPaymentText(payment)}</p>
   </div>
   {error&&<p className="tc-summon-repeat-error" role="alert">{error}</p>}
   <button type="button" className="tc-summon-result-repeat tc-feel-press" disabled={busy||!canRepeat} onClick={onRepeat}>
    <strong>{draws.length===10?'10회 다시 소환':'1회 다시 소환'}</strong>
    <small>{canRepeat?summonPaymentText(repeatPayment):'재화 부족'}{busy?' · 소환 중':''}</small>
   </button>
   <div className="tc-summon-result-footer-secondary">
    {shownSingle&&<button type="button" disabled={!canEquip} onClick={()=>{if(detail&&canEquip)onEquip?.(detail.id);}}>{isEquipped?'착용 중':expedition?'원정 중 변경 불가':'착용하기'}</button>}
    <button type="button" disabled={busy} onClick={onList}>외형 목록</button>
    {!shownSingle&&<button type="button" disabled={busy} onClick={onClose}>닫기</button>}
   </div>
  </footer>
 </div>;
}
