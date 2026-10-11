import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {jobById} from '../../game/jobs/catalog';
import {assetUrl} from '../../game/data/graphics';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import './appearance-summon.css';

// Existing artwork previews only: these are not summon rewards or appearance IDs.
const showcase=['relic_collector','lantern_keeper','expedition_medic'].map(id=>jobById(id)!);
export function AppearanceSummonScreen({game,onList}:{game:GameState;onList:()=>void}){
 const [focus,setFocus]=useState(1),[panel,setPanel]=useState<'history'|'rates'|null>(null);
 const modal=useRef<HTMLElement>(null),selected=showcase[focus];
 useEffect(()=>{
  if(!panel)return;
  const previous=document.activeElement as HTMLElement|null;
  modal.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPanel(null);};
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('keydown',escape);previous?.focus();};
 },[panel]);
 return <Screen title="외형 소환" eyebrow="APPEARANCE SUMMON" className="tc-appearance-summon-screen">
  <div className="tc-appearance-summon">
   <Segments items={[['summon','외형 소환'],['list','외형 목록']] as const} value="summon" onChange={value=>{if(value==='list')onList();}} label="외형 메뉴"/>
   <section className="tc-summon-stage" aria-label="캐릭터 외형 미리보기">
    <div className="tc-summon-arches" aria-hidden="true"><i/><i/><i/></div>
    <div className="tc-summon-figures">{showcase.map((figure,index)=><button type="button" key={figure.id} className={'tc-summon-figure '+(index===focus?'is-focused':'')} aria-pressed={index===focus} aria-label={figure.displayName+' 이미지 미리보기'} onClick={()=>setFocus(index)}>{figure.visualAssetKey&&<img src={assetUrl(figure.visualAssetKey)} alt="" draggable={false}/>}<span>{figure.displayName}</span></button>)}</div>
    <span className="tc-summon-preview-note">기존 캐릭터 이미지 미리보기</span>
   </section>
   <section className="tc-summon-feature" aria-live="polite"><small>APPEARANCE PREVIEW</small><h2>{selected.displayName}</h2><div><span>착용 효과</span><b>능력치 확정 예정</b></div></section>
   <div className="tc-summon-wallet"><div><Glyph name="gold"/><span>보유 골드<b>{game.market.gold.toLocaleString()}</b></span></div><div><Glyph name="ticket"/><span>외형 소환권<b>준비 중</b></span></div></div>
   <div className="tc-summon-actions"><button type="button" disabled><strong>1회 소환</strong><small>비용 확정 예정</small></button><button type="button" disabled><strong>10회 소환</strong><small>비용 확정 예정</small></button><button type="button" disabled><strong>소환권 사용</strong><small>준비 중</small></button></div>
   <p className="tc-summon-status" role="status">외형 소환 서버 연결 준비 중</p>
   <div className="tc-summon-utilities"><button type="button" onClick={()=>setPanel('history')}><Glyph name="bestiary"/>소환 기록</button><button type="button" onClick={()=>setPanel('rates')}><Glyph name="search"/>확률 정보</button></div>
  </div>
  {panel&&<div className="tc-summon-modal-backdrop" role="presentation" onClick={()=>setPanel(null)}><section ref={modal} tabIndex={-1} className="tc-summon-modal" role="dialog" aria-modal="true" aria-labelledby="summon-modal-title" onClick={e=>e.stopPropagation()}><header><h2 id="summon-modal-title">{panel==='history'?'소환 기록':'확률 정보'}</h2><button type="button" aria-label="닫기" onClick={()=>setPanel(null)}>×</button></header><p>{panel==='history'?'외형 소환이 시작되면 실제 획득 기록이 여기에 표시됩니다.':'외형 소환 확률과 비용은 확정 후 공개됩니다.'}</p><button type="button" className="tc-action" onClick={()=>setPanel(null)}>닫기</button></section></div>}
 </Screen>;
}
