import React,{useEffect,useRef,useState} from 'react';
import type {AppearanceSummonDraw,AppearanceSummonRarity} from '../../online/appearanceSummon';
import {APPEARANCES} from '../../game/data/cosmetics';
import {appearanceSummonPayment} from '../../game/data/appearanceSummonPricing';
import {summonPaymentText} from './AppearanceSummonResultView';
import {appearanceLevel,appearanceShardCount,appearanceShardCost} from '../../game/data/appearanceProgress';
import type {GameState,EquipmentGrade} from '../../game/types';
import '../inventory/equipment-card-reveal.css';
import './appearance-card-reveal.css';
import {stopEffectScope,unlockGameEffectAudio} from '../../audio/gameEffects';
import {setCardMusicDucking} from '../../audio/backgroundMusic';
import {useGameFeel} from '../../gameFeel/react/useGameFeel';
import {readGameFeelPreferences} from '../../gameFeel/preferences';
import {cardTimeline,runCardTimeline} from '../../gameFeel/cardSequence';
import {assetUrl} from '../../game/data/graphics';
import {cardRows,cardSize,remainingCards,cardNameLines} from '../inventory/equipmentCardLayout';
const cardBack=assetUrl('assets/ui/cards/card-back-bronze-seal-v1.webp');
const catalog=new Map(APPEARANCES.map(a=>[a.id,a]));
export const APPEARANCE_CARD_GRADES:Record<AppearanceSummonRarity,EquipmentGrade>={C:'common',B:'uncommon',A:'rare',SR:'heroic',SSR:'legendary'};
function appearanceName(draw:AppearanceSummonDraw){return catalog.get(draw.id)?.name??draw.id;}
function CharacterArt({draw}:{draw:AppearanceSummonDraw}){const path=catalog.get(draw.id)?.imagePath;return path?<img src={assetUrl(path)} alt="" draggable={false}/>:<span>이미지 준비 중</span>;}

function CardSeal(){return <img className="tc-card-back-art" src={cardBack} alt="" aria-hidden="true" draggable={false} width={420} height={600}/>;}
function CardName({name}:{name:string}){
 const lines=cardNameLines(name);
 const style={'--name-length':Math.max(1,Array.from(name).length),'--name-longest':Math.max(1,...lines.map(line=>Array.from(line).length))} as React.CSSProperties;
 return <span className="tc-card-name" style={style}><span className="tc-card-name-full">{name}</span><span className="tc-card-name-compact">{lines.map((line,i)=><span className="tc-card-name-line" key={i}>{line}</span>)}</span></span>;
}
function CardLight({revealed}:{revealed:boolean}){return <span className={'tc-card-reveal-light '+(revealed?'is-impact':'is-flipping')} aria-hidden="true"><span className="tc-card-halo"/><span className="tc-card-flash"/></span>;}

export interface AppearanceCardRevealProps{
 draws:AppearanceSummonDraw[];game:GameState;available:boolean;busy?:boolean;error?:string;pendingRolls?:1|10|null;
 onRepeat:(rolls:1|10)=>void;onClose:()=>void;onList:()=>void;onEquip?:(id:string)=>void;
 skipReveal?:boolean;onSkipRevealChange?:(value:boolean)=>void;replayed?:boolean;
}
export function AppearanceCardReveal({draws,game,available,busy=false,error='',pendingRolls=null,onRepeat,onClose,onList,onEquip,skipReveal=false,onSkipRevealChange,replayed=false}:AppearanceCardRevealProps){
 const rewards=draws.map(draw=>({...draw,grade:APPEARANCE_CARD_GRADES[draw.rarity]}));
 const quantity=game.cosmetics.summonTickets??0,gold=game.market.gold;
 const onePayment=appearanceSummonPayment(1,quantity),tenPayment=appearanceSummonPayment(10,quantity);
 const skipAtMount=useRef(skipReveal||replayed);
 const initialOpened=()=>new Set<number>(skipAtMount.current?rewards.map((_,i)=>i):[]);
 const feel=useGameFeel();
 const sequence=useRef<(()=>void)|null>(null);
 const [charging,setCharging]=useState<Set<number>>(new Set()),[spotlight,setSpotlight]=useState<number|null>(null),[reduced,setReduced]=useState(skipAtMount.current);
 const [returning,setReturning]=useState(false);
 const area=useRef<HTMLDivElement>(null),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const openedRef=useRef(initialOpened()),timers=useRef<number[]>([]),batchRef=useRef(false);
 const [opened,setOpened]=useState<Set<number>>(initialOpened),[settled,setSettled]=useState<Set<number>>(initialOpened),[batch,setBatch]=useState(false),[selected,setSelected]=useState<number|null>(null),[size,setSize]=useState(70);
 const total=rewards.length,rows=cardRows(total),all=settled.size===total;
 useEffect(()=>{const el=area.current!;const observer=new ResizeObserver(([entry])=>setSize(cardSize(total,entry.contentRect.width,entry.contentRect.height)));observer.observe(el);if(!skipAtMount.current)feel.play('card.deal');return()=>{observer.disconnect();timers.current.forEach(window.clearTimeout);sequence.current?.();stopEffectScope('equipment-cards');setCardMusicDucking(false);};},[total]);
 const later=(fn:()=>void,delay:number)=>{timers.current.push(window.setTimeout(fn,delay));};
 const start=(indices:number[])=>{
  if(batchRef.current||!indices.length)return;
  const reduce=readGameFeelPreferences();setReduced(reduce);unlockGameEffectAudio();
  batchRef.current=true;setBatch(true);indices.forEach(i=>openedRef.current.add(i));
  sequence.current=runCardTimeline(cardTimeline(rewards.map(r=>r.grade),indices,reduce),event=>{
   const {index,phase}=event,legend=rewards[index].grade==='legendary';
   if(phase==='charge'){
    setCharging(old=>new Set([...old,index]));
    if(!reduce){feel.play('card.charge');if(legend){setReturning(false);setSpotlight(index);setCardMusicDucking(true);}}
   }else if(phase==='flip'){
    setCharging(old=>{const next=new Set(old);next.delete(index);return next;});
    setOpened(old=>new Set([...old,index]));if(!reduce)feel.play('card.flip');
   }else if(phase==='impact'){
    setSettled(old=>new Set([...old,index]));feel.play('card.result',{grade:rewards[index].grade});
   }else if(phase==='return'){setReturning(true);
   }else if(legend){setSpotlight(null);setCardMusicDucking(false);}
  },()=>{batchRef.current=false;setBatch(false);setCharging(new Set());setSpotlight(null);setCardMusicDucking(false);},(fn,ms)=>window.setTimeout(fn,ms),id=>window.clearTimeout(id));
 };
 const reveal=(index:number)=>{if(!openedRef.current.has(index))start([index]);};
 const revealAll=()=>start(remainingCards(total,openedRef.current));
 const skip=()=>{
  setReduced(true);
  sequence.current?.();stopEffectScope('equipment-cards');setCardMusicDucking(false);
  const every=new Set(rewards.map((_,i)=>i));openedRef.current=every;
  setOpened(every);setSettled(every);setCharging(new Set());setSpotlight(null);batchRef.current=false;setBatch(false);
 };
 useEffect(()=>{const hide=()=>{if(document.hidden&&batchRef.current)skip();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[total]);
 const dismissDetails=()=>{const index=selected;setSelected(null);if(index!==null)later(()=>buttons.current[index]?.focus(),0);};
 const repeatBlocked=busy||!available||batch||!all||pendingRolls!==null;
 let offset=0;
 return <section className={'tc-card-stage tc-appearance-card-stage'+(batch?' is-playing':'')+(reduced?' is-reduced':'')} onKeyDown={e=>{if(e.key==='Escape'&&selected!==null){e.preventDefault();e.stopPropagation();dismissDetails();}}}>
  <header className="tc-appearance-card-header"><h2 id="summon-modal-title">외형 소환</h2><button type="button" className="tc-box-close" aria-label="소환 결과 닫기" disabled={busy||pendingRolls!==null} onClick={onClose}>×</button></header><p className="tc-card-instruction">{all?'공개한 카드를 눌러 상세 정보를 확인하세요':'카드를 눌러 외형을 확인하세요'}</p>
  <div ref={area} inert={selected!==null||spotlight!==null} className="tc-card-area"><div className="tc-card-rows" style={{'--card-width':`${size}px`} as React.CSSProperties}>
   {rows.map((length,row)=>{const start=offset;offset+=length;return <div className={'tc-card-row'+(spotlight!==null&&spotlight>=start&&spotlight<offset?' has-flying-card':'')} key={row}>{rewards.slice(start,start+length).map((reward,j)=>{
    const index=start+j,visible=opened.has(index),ready=settled.has(index);
    const flying=spotlight===index;
    const travelStyle=flying?{
     '--travel-x':((length-1)/2-j)*(size+8)+'px',
     '--travel-y':((rows.length-1)/2-row)*(size/.7+8)+'px',
     '--travel-scale':Math.min(220,(area.current?.clientHeight??size/.7)*.7*.9)/size,
    } as React.CSSProperties:undefined;
    return <button ref={el=>{buttons.current[index]=el;}} key={index} style={travelStyle} type="button" className={'tc-card-tile'+(flying?(returning?' is-flying is-returning':' is-flying'):'')+(visible?' is-revealed':'')+(visible?' grade-'+reward.grade:'')+(ready?' is-settled':'')+(visible&&!ready?' is-flipping':'')+(charging.has(index)?' is-charging grade-'+reward.grade:'')} aria-label={ready?`${appearanceName(reward)} 상세 보기`:`외형 카드 ${index+1} ${visible?'공개 중':'공개'}`} aria-disabled={batch} onClick={()=>{if(batchRef.current)return;if(ready)setSelected(index);else reveal(index);}}>
     <span className="tc-card-turn" aria-hidden="true"><span className="tc-card-face tc-card-back"><CardSeal/><span className="tc-bronze-reflection" style={{maskImage:`url(${cardBack})`}}/></span><span className={'tc-card-face tc-card-front grade-'+reward.grade}><span className="tc-card-rank">{reward.rarity}</span><span className="tc-card-art"><CharacterArt draw={reward}/></span><CardName name={appearanceName(reward)}/><span className="tc-appearance-shard-caption">조각 ×1</span></span></span>
     {visible&&<CardLight key={ready?'impact':'flip'} revealed={ready}/>}
    </button>;
   })}</div>;})}
  </div></div>
  <div className="tc-card-repeat-footer" inert={selected!==null}>
   <div className="tc-card-stock-row"><div className="tc-card-stock-count tc-appearance-wallet"><span>소환권 <b>{quantity.toLocaleString()}장</b></span><span>골드 <b>{gold.toLocaleString()} G</b></span></div><button type="button" className="tc-card-inventory" disabled={busy||batch||pendingRolls!==null} onClick={onList}>외형 목록 ›</button></div>
   <div className="tc-card-repeat-actions">
    {!all||batch?<button type="button" className="tc-card-reveal-all" onClick={batch?skip:revealAll}>{batch?'연출 건너뛰기':'모두 공개'}</button>:<>
     <button type="button" className="tc-card-repeat-one" disabled={repeatBlocked||gold<onePayment.goldSpent} onClick={()=>onRepeat(1)}><span className="tc-card-repeat-label">한 번 더 소환</span><span className="tc-card-repeat-cost">{summonPaymentText(onePayment)}</span></button>
     <button type="button" className="tc-card-repeat-ten" disabled={repeatBlocked||gold<tenPayment.goldSpent} onClick={()=>onRepeat(10)}><span className="tc-card-repeat-label">10회 연속 소환</span><span className="tc-card-repeat-cost">{summonPaymentText(tenPayment)}</span></button>
    </>}
   </div>
   <div className="tc-card-repeat-settings"><label><input type="checkbox" checked={skipReveal} disabled={busy} onChange={e=>onSkipRevealChange?.(e.target.checked)}/> 다음 카드 연출 건너뛰기</label></div>
   {busy?<p className="tc-card-repeat-status" role="status">외형 소환 처리 중…</p>:error?<div className="tc-card-repeat-error"><p role="status">{error}</p>{pendingRolls!==null&&<button type="button" disabled={!available} onClick={()=>onRepeat(pendingRolls)}>이전 결과 다시 확인</button>}</div>:null}
  </div>
  {selected!==null&&(()=>{const reward=rewards[selected],appearance=catalog.get(reward.id),level=appearanceLevel(game.cosmetics,reward.id),shards=appearanceShardCount(game.cosmetics,reward.id),cost=appearanceShardCost(level),equipped=game.cosmetics.selectedAppearanceId===reward.id,unlocked=game.cosmetics.unlockedAppearanceIds.includes(reward.id),canEquip=unlocked&&!equipped&&!game.expedition&&!busy&&pendingRolls===null&&!!onEquip;return <div className="tc-card-detail-cover"><section className="tc-card-detail tc-appearance-card-detail" role="region" aria-label="획득 외형 상세"><h3>{appearanceName(reward)}</h3><p>{reward.rarity} · 전용 조각 ×1</p><CharacterArt draw={reward}/><p>{appearance?.description??''}</p><dl><div><dt>보유 조각</dt><dd>{shards}개</dd></div><div><dt>{level===0?'해금 진행도':cost?'강화 진행도':'외형 레벨'}</dt><dd>{cost?shards+' / '+cost:'Lv.'+level+' MAX'}</dd></div></dl>{unlocked&&<button type="button" disabled={!canEquip} onClick={()=>onEquip?.(reward.id)}>{equipped?'착용 중':game.expedition?'원정 중 변경 불가':'착용하기'}</button>}<button autoFocus onClick={dismissDetails}>카드로 돌아가기</button></section></div>;})()}
 </section>;
}
