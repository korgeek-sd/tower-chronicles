import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getAdventurerProfile,getAdventurerRanking,type AdventurerProfile,type AdventurerRanking} from '../../online/adventurerDirectory';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {jobById} from '../../game/jobs/catalog';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {EquipmentArt} from '../inventory/EquipmentArt';
import {GuildEmblem} from '../association/GuildEmblem';
import './adventurer-directory.css';
const number=(v:number)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:2}):'—';
const className=(id:string|null)=>id==='warrior'?'전사':id==='mage'?'마법사':id==='archer'?'궁수':'직업 미선택';
const slots=['weapon','helmet','armor','gloves','boots','necklace','ring'];
const slotLabels=['무기','투구','갑옷','장갑','신발','목걸이','반지'];
function Profile({data}:{data:AdventurerProfile}){
 const portrait=playerGraphicForJob(data.currentJobId,data.selectedAppearanceId).image.idle;
 return <>
  <div className="tc-adventurer-identity">{portrait?<img src={assetUrl(portrait)} alt="착용 외형"/>:<span className="tc-adventurer-portrait-empty" aria-label="외형 이미지 없음"/>}<div><h3>{data.nickname} <span>Lv. {data.level}</span></h3><p>{className(data.classId)} · {data.currentJobId?jobById(data.currentJobId)?.displayName??'기본 외형':'기본 외형'}</p><p>{data.guildEmblem&&<GuildEmblem value={data.guildEmblem} size={26}/>} {data.guildName?data.guildName+' · '+(data.guildRole==='LEADER'?'단장':'단원'):'원정단 미가입'}</p></div></div>
  <div className="tc-adventurer-power"><span>전투력 <strong>{number(data.combatPower)}</strong></span></div>
  <section className="tc-adventurer-card"><h3>최종 능력치</h3><div className="tc-adventurer-metrics">{[['최대 체력',number(data.stats.hp)],['공격력',number(data.stats.attack)],['방어력',number(data.stats.defense)],['치명타 확률',number(data.stats.critChance*100)+'%']].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div></section>
  <section className="tc-adventurer-card"><h3>장착 장비</h3><div className="tc-adventurer-equipment">{slots.map((slot,i)=>{const item=data.equipment.find(e=>e.slot===slot);return <div key={slot}><small>{slotLabels[i]}</small>{item?<><EquipmentArt kind={item.kind} grade={item.grade}/><b>{EQUIPMENT_DEFINITIONS[item.kind]?.name??item.kind}</b><span>{EQUIPMENT_GRADE_NAMES[item.grade]} +{item.enhancement}</span></>:<span>미착용</span>}</div>})}</div></section>
  <section className="tc-adventurer-card tc-adventurer-metrics"><div><small>전투 인장</small><b>{data.associationSeal} / 30</b></div><div><small>수호 인장</small><b>{data.guardianSeal} / 30</b></div></section>
  <section className="tc-adventurer-card"><h3>컬렉션 달성</h3><b>{data.collectionCompleted} / {data.collectionTotal}</b></section>
 </>;
}
export function AdventurerDirectory({lease}:{lease:GameplayLease|null}){
 const [view,setView]=useState<{userId:string|null}|null>(null);
 const [profile,setProfile]=useState<AdventurerProfile|null>(null),[ranking,setRanking]=useState<AdventurerRanking|null>(null);
 const [draft,setDraft]=useState(''),[query,setQuery]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null);
 useEffect(()=>{const handler=(e:Event)=>{if(!lease)return;previous.current=document.activeElement as HTMLElement;setDraft('');setQuery('');setView({userId:(e as CustomEvent<{userId:string|null}>).detail.userId});};window.addEventListener('tower-adventurer-directory',handler);return()=>window.removeEventListener('tower-adventurer-directory',handler);},[lease?.leaseId,lease?.generation]);
 useEffect(()=>{if(!lease)setView(null);},[lease?.leaseId,lease?.generation]);
 const shown=!!view;
 useEffect(()=>{const el=dialog.current;if(shown&&el&&!el.open)el.showModal();return()=>{if(el?.open)el.close();if(shown&&previous.current?.isConnected)previous.current.focus({preventScroll:true});};},[shown]);
 useEffect(()=>{if(!view||!lease)return;let active=true;setLoading(true);setError('');setProfile(null);setRanking(null);
 const request=view.userId?getAdventurerProfile(lease,view.userId).then(x=>{if(active)setProfile(x);}):getAdventurerRanking(lease,query).then(x=>{if(active)setRanking(x);});
 void request.catch(()=>{if(active)setError('캐릭터 정보를 불러오지 못했습니다. 다시 시도해 주세요.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[view,query,retry,lease?.leaseId,lease?.generation]);
 if(!view)return null;
 return <dialog ref={dialog} className="tc-adventurer-dialog" aria-labelledby="tc-adventurer-title" onCancel={e=>{e.preventDefault();setView(null);}} onClick={e=>{if(e.target===e.currentTarget)setView(null);}}>
  <header><h2 id="tc-adventurer-title">{view.userId?'캐릭터 정보':'개인 전투력 랭킹'}</h2><button type="button" onClick={()=>setView(null)} aria-label="캐릭터 정보 닫기">×</button></header>
  <div className="tc-adventurer-body">
   {view.userId?<button type="button" className="tc-adventurer-back" onClick={()=>{setView({userId:null});}}>‹ 모험가 랭킹 · 검색</button>:<form onSubmit={e=>{e.preventDefault();setQuery(draft.trim());setRetry(n=>n+1);}}><input aria-label="닉네임 검색" placeholder="닉네임 검색 (정확한 이름)" maxLength={12} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit">검색</button><button type="button" onClick={()=>{setDraft('');setQuery('');setRetry(n=>n+1);}}>전체</button></form>}
   {loading?<p role="status">정보를 불러오는 중…</p>:error?<div role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>:view.userId?(profile?<Profile data={profile}/>:<p>조회할 수 없는 캐릭터입니다.</p>):ranking?<><p className="tc-adventurer-rank-note">내 순위 {ranking.myRank??'—'}위 · 전체 {ranking.total}명 {query?'· 검색 결과':'· 상위 100명'}</p>{ranking.entries.length?ranking.entries.map(entry=><button key={entry.userId} type="button" className="tc-adventurer-rank-row" onClick={()=>setView({userId:entry.userId})}><b>{entry.rank}위</b><span><strong>{entry.nickname}</strong><small>Lv. {entry.level} · {className(entry.classId)}{entry.guildName?' · '+entry.guildName:''}</small></span><span>전투력 <b>{number(entry.combatPower)}</b></span></button>):<p>검색 결과가 없습니다.</p>}</>:null}
  </div>
 </dialog>;
}
