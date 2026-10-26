import React,{useEffect,useRef,useState} from 'react';
import {huntingProgress,normalizeStatAllocation,statPointsForLevel,usedStatPoints,type HuntingState} from '../../game/hunting/model';
import type {LifeMasteryTrack} from '../../game/life/crafting';
import type {VillageLifeState} from '../../online/villageLife';
import {assetUrl} from '../../game/data/graphics';
import {CraftItemArt} from '../world/CraftItemArt';
import {Glyph} from '../../ui/mobile';
import {growthMasteryProgress} from './growthRecord';
import './growth-record.css';

const tracks:[LifeMasteryTrack,string,'herb'|'wheat'|'challenge_ticket',string][]=[
 ['herb','약초','herb','약초 채집 · 회복 포션 제작'],
 ['farm','농업','wheat','농사 · 떡볶이·감자튀김·빵 제작'],
 ['ticket','도전권 제작','challenge_ticket','분해석으로 점령전 도전권 제작'],
];
type Props={nickname?:string;hunting:HuntingState|null;life:VillageLifeState|null;loading:boolean;huntingError?:string;lifeError?:string;accessMessage?:string;navigationEnabled?:boolean;onClose:()=>void;onStats:()=>void;onProduction:()=>void;onCraft:()=>void;onRetry:()=>void};
function Progress({label,value,max,text}:{label:string;value:number;max:number;text:string}){
 return <div className="tc-growth-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}><i style={{width:Math.max(0,Math.min(100,value/Math.max(1,max)*100))+'%'}}/></div>;
}
export function GrowthRecordScreen({nickname,hunting,life,loading,huntingError,lifeError,accessMessage,navigationEnabled=true,onClose,onStats,onProduction,onCraft,onRetry}:Props){
 const [expanded,setExpanded]=useState<LifeMasteryTrack|null>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 const character=hunting&&Number.isFinite(hunting.experience)?huntingProgress(hunting.experience):null;
 const percent=character?character.nextExp===0?100:Math.floor(character.exp/character.nextExp*100):null;
 const points=character&&hunting?Math.max(0,hunting.statPoints??statPointsForLevel(character.level)-usedStatPoints(normalizeStatAllocation(hunting.statAllocation))):null;
 const error=[huntingError,lifeError].filter(Boolean).join(' ');
 return <section className="tc-growth-page" aria-label="성장 기록" aria-busy={loading} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose();}}}>
  <header className="tc-growth-heading"><h1 ref={heading} tabIndex={-1}>성장 기록</h1><button type="button" className="tc-feel-press" aria-label="성장 기록 닫기" onClick={onClose}>×</button></header>
  <div className="tc-growth-scroll">
   {(accessMessage||loading)&&<p className="tc-growth-notice" role="status">{accessMessage||'성장 기록을 불러오는 중…'}</p>}
   {error&&<div className="tc-growth-error" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={onRetry}>다시 확인</button></div>}
   <section className="tc-growth-character" aria-label="캐릭터 성장">
    <img className="tc-growth-backdrop" src={assetUrl('assets/backgrounds/hub/novar-village-v2.webp')} alt="" aria-hidden="true"/>
    <div className="tc-growth-crest" aria-hidden="true"><Glyph name="association"/></div>
    <div className="tc-growth-identity"><span>{nickname??'모험가'}</span><small>캐릭터 레벨</small></div><strong className="tc-growth-level">Lv.{character?.level??'—'}</strong>
    <div className="tc-growth-character-xp"><span>레벨 진행 {percent===null?'—':`${percent}%`}</span>{character?<Progress label="캐릭터 경험치" value={character.nextExp===0?1:character.exp} max={character.nextExp===0?1:character.nextExp} text={character.nextExp===0?'최고 레벨 달성':`${character.exp.toLocaleString()} / ${character.nextExp.toLocaleString()}`}/>:<div className="tc-growth-progress"/>}<small>{character?character.nextExp===0?'최고 레벨 달성':`다음 레벨까지 ${(character.nextExp-character.exp).toLocaleString()} EXP`:'경험치 확인 필요'}</small></div>
    <div className="tc-growth-points"><span>미사용 능력치 <b>{points??'—'}</b></span><button type="button" className="tc-feel-press" disabled={!character||!navigationEnabled} onClick={onStats}>스탯 분배 <span aria-hidden="true">›</span></button></div>
   </section>
   <header className="tc-growth-mastery-heading"><h2>생활 숙련도</h2><small>최대 Lv.10</small></header>
   <div className="tc-growth-tracks">{tracks.map(([key,name,art,method])=>{
    const progress=growthMasteryProgress(life?.lifeMasteries?.[key]),open=expanded===key;
    return <section key={key} className={'tc-growth-track'+(open?' open':'')} data-growth-track={key}>
     <button type="button" className="tc-growth-summary tc-feel-press" aria-expanded={open} aria-controls={`growth-detail-${key}`} onClick={()=>setExpanded(open?null:key)}>
      <CraftItemArt id={art}/><div className="tc-growth-track-main"><div className="tc-growth-track-title"><h3>{name} <b>Lv.{progress?.level??'—'}</b></h3><span>{progress?`제작량 +${progress.bonus}%`:'정보 확인 필요'} <i aria-hidden="true">{open?'⌃':'⌄'}</i></span></div>
       {progress?<Progress label={`${name} 숙련 경험치`} value={progress.required===0?1:progress.earned} max={progress.required===0?1:progress.required} text={progress.required===0?'최대 숙련':`${progress.earned} / ${progress.required}`}/>:<div className="tc-growth-progress"/>}
       <div className="tc-growth-track-xp"><span>{progress?progress.required===0?'MAX':`${progress.earned.toLocaleString()} / ${progress.required.toLocaleString()}`:'—'}</span><small>{progress?progress.required===0?'최대 숙련':`다음 레벨까지 ${progress.remaining.toLocaleString()} EXP`:'숙련 경험치 확인 필요'}</small></div>
      </div>
     </button>
     <div className="tc-growth-detail" id={`growth-detail-${key}`} hidden={!open}><div><small>다음 효과</small><b>{progress?progress.nextBonus===null?'최대 숙련 달성':`Lv.${progress.level+1} · 제작량 +${progress.nextBonus}%`:'숙련도 확인 후 표시'}</b></div><div><small>성장 방법</small><span>{method}</span></div><p>보너스는 제작량에만 적용</p></div>
    </section>;
   })}</div>
   <p className="tc-growth-hint">숙련도를 누르면 성장 정보를 확인할 수 있습니다.</p>
  </div>
  <footer className="tc-growth-actions"><button type="button" className="tc-feel-press" disabled={!navigationEnabled} onClick={onProduction}><Glyph name="kaleon"/>생산하기</button><button type="button" className="tc-feel-press" disabled={!navigationEnabled} onClick={onCraft}><Glyph name="craft"/>제작 공방</button></footer>
 </section>;
}
