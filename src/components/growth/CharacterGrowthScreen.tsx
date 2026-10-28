import React,{useEffect,useRef,useState} from 'react';
import type {CharacterGrowthSnapshot} from '../../online/characterGrowth';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {jobById} from '../../game/jobs/catalog';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {EquipmentArt} from '../inventory/EquipmentArt';
const sealArt=new URL('../../assets/ui/seals/seal-solar-reference-v1.png',import.meta.url).href;
import {characterGrowthSummary,growthBreakdown,growthValue,GROWTH_STAT_LABELS,type GrowthStat} from './characterGrowth';
import './character-growth.css';

type Props={data:CharacterGrowthSnapshot|null;nickname?:string;loading:boolean;error?:string;accessMessage?:string;
 onRetry:()=>void;onClose:()=>void;onStats:()=>void;onEquipment:()=>void;onSeals:()=>void;onCollection:()=>void;onGrowthRecord:()=>void};
const stats=['hp','attack','defense','critChance'] as const;
const slotNames:Record<string,string>={weapon:'무기',helmet:'투구',armor:'갑옷',gloves:'장갑',boots:'신발',necklace:'목걸이',ring:'반지'};
function Progress({label,value,text}:{label:string;value:number;text:string}){return <div className="tc-character-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={text}><i style={{width:value+'%'}}/></div>;}
function DetailDialog({data,stat,onClose,onStat,onEquipment}:{data:CharacterGrowthSnapshot;stat:GrowthStat|'equipment';onClose:()=>void;onStat:(stat:GrowthStat)=>void;onEquipment:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const el=dialog.current,previous=document.activeElement as HTMLElement|null;if(!el)return;el.showModal();close.current?.focus();return()=>{el.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 const breakdown=stat==='equipment'?null:growthBreakdown(data,stat);
 return <dialog ref={dialog} className="tc-character-dialog" aria-labelledby="character-detail-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} onKeyDown={e=>{
  if(e.key!=='Tab')return;const controls=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}>
  <header><h2 id="character-detail-title">{stat==='equipment'?'장착 장비 능력치':'능력치 상세'}</h2><button ref={close} type="button" aria-label="능력치 상세 닫기" onClick={onClose}>×</button></header>
  {stat==='equipment'?<div className="tc-character-gear-list">
   {data.equipment.length?data.equipment.map(({slot,item,stats:values})=><article key={slot}><EquipmentArt kind={item.kind} grade={item.grade}/><div><small>{slotNames[slot]} · {EQUIPMENT_GRADE_NAMES[item.grade]} · 강화 +{item.enhancement}</small><h3>{EQUIPMENT_DEFINITIONS[item.kind]?.name??item.kind}</h3><p>{Object.entries(values).filter(([,v])=>v!==0).map(([key,v])=>`${GROWTH_STAT_LABELS[key as GrowthStat]} +${growthValue(key as GrowthStat,v)}`).join(' · ')}</p></div></article>):<p>장착한 장비가 없습니다.</p>}
   <button className="tc-character-dialog-action" onClick={onEquipment}>가방에서 장비 관리</button>
  </div>:<>
   <nav className="tc-character-stat-picker" aria-label="상세 능력치 선택">{([...stats,'mp','critDamage','armorPenetration'] as GrowthStat[]).map(key=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>onStat(key)}>{GROWTH_STAT_LABELS[key]}</button>)}</nav>
   <div className="tc-character-detail-total"><span>{GROWTH_STAT_LABELS[stat]}</span><strong>{growthValue(stat,breakdown!.final)}</strong></div>
   <dl className="tc-character-breakdown">{breakdown!.rows.map(row=><div key={row.id}><dt>{row.label}{row.note&&<small>{row.note}</small>}</dt><dd>{row.value>0&&row.id!=='base'?'+':''}{growthValue(stat,row.value)}</dd></div>)}</dl>
   <p className="tc-character-detail-note">현재 장착 기준의 상시 능력치입니다. 인장은 순서대로 곱연산하며, 치명타 확률은 최대 60%입니다.</p>
   <section className="tc-character-food"><h3>일시 효과 · 사냥 시 별도 적용</h3>{(['attack_food','defense_food','experience_food'] as const).map((id,index)=><p key={id}><span>{['공격 음식','방어 음식','경험치 음식'][index]}</span><b>{(data.foodTurns[id]??0)>0?`+10% · ${data.foodTurns[id]}회 남음`:'미적용'}</b></p>)}</section>
  </>}
 </dialog>;
}
export function CharacterGrowthScreen({data,nickname,loading,error,accessMessage,onRetry,onClose,onStats,onEquipment,onSeals,onCollection,onGrowthRecord}:Props){
 const [detail,setDetail]=useState<GrowthStat|'equipment'|null>(null);
 const heading=useRef<HTMLHeadingElement>(null);useEffect(()=>{heading.current?.focus();},[]);
 const summary=data?characterGrowthSummary(data):null;
 const job=data?.currentJobId?jobById(data.currentJobId):null;
 const portrait=data?playerGraphicForJob(data.currentJobId,data.selectedAppearanceId).image.idle:null;
 const attack=data?growthBreakdown(data,'attack'):null;
 const sources=attack?[{label:'기본',value:data!.baseStats.attack},{label:'스탯',value:summary!.allocation.attack},{label:'장비',value:attack.rows.find(r=>r.id==='equipment')!.value},{label:'인장',value:attack.rows.filter(r=>r.id==='association'||r.id==='guardian').reduce((s,r)=>s+r.value,0)},{label:'컬렉션',value:0}]:[];
 const weapon=summary?.weapon;
 return <section className="tc-character-page" aria-label="성장 현황" aria-busy={loading} onKeyDown={e=>{if(e.key==='Escape'&&!detail)onClose();}}>
  <header className="tc-character-heading"><h1 ref={heading} tabIndex={-1}>성장 현황</h1><button type="button" onClick={onClose} aria-label="성장 현황 닫기">×</button></header>
  {!data?<div className="tc-character-unavailable"><p role={error?'alert':'status'}>{accessMessage||error||(loading?'성장 현황을 불러오는 중…':'성장 정보를 확인해 주세요.')}</p>{!accessMessage&&<button type="button" disabled={loading} onClick={onRetry}>{loading?'확인 중…':'다시 확인'}</button>}</div>:<div className="tc-character-content">
   <section className="tc-character-identity" aria-label="캐릭터 성장">
    {portrait&&<img src={assetUrl(portrait)} alt="현재 캐릭터 외형"/>}
    <div className="tc-character-name"><strong>{nickname??'모험가'}</strong><span>{job?.displayName??'직업 미선택'}</span><b>Lv. {summary!.progress.level}</b></div>
    <div className="tc-character-xp"><span>EXP {summary!.xpPercent}%</span><Progress label="캐릭터 경험치" value={summary!.xpPercent} text={summary!.progress.nextExp===0?'최고 레벨':`${summary!.progress.exp} / ${summary!.progress.nextExp}`}/><small>{summary!.progress.nextExp===0?'최고 레벨':`다음 레벨 ${Math.max(0,summary!.progress.nextExp-summary!.progress.exp).toLocaleString()} EXP`} · 미사용 {summary!.points} PT</small></div>
   </section>
   <nav className="tc-character-tabs" aria-label="성장 메뉴"><button type="button" aria-current="page" onClick={()=>setDetail(null)}>종합</button><button type="button" onClick={onStats}>스탯</button><button type="button" onClick={()=>setDetail('equipment')}>장비</button><button type="button" onClick={onCollection}>컬렉션</button></nav>
   <section className="tc-character-panel tc-character-final" aria-label="최종 능력치"><header><h2>최종 능력치</h2><small>현재 장비 · 음식 제외</small></header><div className="tc-character-metrics">{stats.map((key,index)=><button key={key} type="button" onClick={()=>setDetail(key)} aria-label={GROWTH_STAT_LABELS[key]+' '+growthValue(key,data.stats[key])+' 상세 보기'}><img src={assetUrl(['assets/ui/crafting/potion.png','assets/ui/equipment/association_supply_iron_sword.png','assets/ui/equipment/return_corps_plate_armor.png','assets/ui/equipment/expedition_merit_ring.png'][index])} alt=""/><span>{GROWTH_STAT_LABELS[key]}<b>{growthValue(key,data.stats[key])}</b></span></button>)}</div></section>
   <button type="button" className="tc-character-panel tc-character-sources" onClick={()=>setDetail('attack')} aria-label="공격력 구성 상세 보기"><header><h2>공격력 구성</h2><small>{(attack!.rows.find(r=>r.id==='appearance')?.value??0)>0?`외형 +${growthValue('attack',attack!.rows.find(r=>r.id==='appearance')!.value)} 포함 ›`:'상세 계산 ›'}</small></header><div>{sources.map(source=><span key={source.label}><small>{source.label}</small><b>{growthValue('attack',source.value)}</b></span>)}</div></button>
   <div className="tc-character-pair">
    <button type="button" className="tc-character-panel tc-character-weapon" onClick={()=>setDetail('equipment')}><header><h2>장비</h2><small>상세 ›</small></header><div>{weapon?<><EquipmentArt kind={weapon.item.kind} grade={weapon.item.grade}/><span><strong>{EQUIPMENT_DEFINITIONS[weapon.item.kind]?.name??weapon.item.kind}</strong><small>{EQUIPMENT_GRADE_NAMES[weapon.item.grade]} · 강화 +{weapon.item.enhancement}</small><b>공격력 +{growthValue('attack',weapon.stats.attack??0)}</b></span></>:<span>장착한 무기 없음</span>}</div></button>
    <button type="button" className="tc-character-panel tc-character-seals" onClick={onSeals}><header><h2>인장</h2><small>성장 ›</small></header><div>{(['association','guardian'] as const).map(id=><span key={id}><img className="tc-character-seal-art" data-seal={id} src={sealArt} alt=""/><small>{id==='association'?'전투':'수호'} 인장</small><b>{data.seals[id].level} / 30</b></span>)}</div></button>
   </div>
   <button type="button" className="tc-character-panel tc-character-collection" onClick={onCollection}><header><h2>컬렉션</h2><small>{summary!.collection.total?`달성 ${summary!.collection.completed} / ${summary!.collection.total}`:'컬렉션 준비 중'} ›</small></header><Progress label="컬렉션 달성도" value={Math.floor(summary!.collection.completed/Math.max(1,summary!.collection.total)*100)} text={`${summary!.collection.completed} / ${summary!.collection.total}`}/><div><img src={assetUrl('assets/ui/skillbook.jpg')} alt=""/><span><span className="tc-character-collection-values">{(['attack','defense','hp'] as const).map(key=><span key={key}>{GROWTH_STAT_LABELS[key]}<b>+{growthValue(key,summary!.collection.planned[key])}</b></span>)}</span></span></div><p>적용 예정 · 현재 전투 능력치에는 미적용</p></button>
   <footer className="tc-character-actions"><button type="button" onClick={()=>setDetail('attack')}>상세 능력치 보기 ›</button><button type="button" onClick={onGrowthRecord}>생활 숙련도 ›</button></footer>
  </div>}
  {data&&detail&&<DetailDialog data={data} stat={detail} onStat={setDetail} onClose={()=>setDetail(null)} onEquipment={onEquipment}/>}
 </section>;
}
