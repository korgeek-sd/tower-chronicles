import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getAdventurerProfile,getAdventurerRanking,type AdventurerEntry,type AdventurerProfile,type AdventurerRanking} from '../../online/adventurerDirectory';
import {getGuildRankings,type GuildRankingState,type GuildRankingEntry} from '../../online/guildRankings';
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
function RankMark({rank}:{rank:number}){
 return <span className="tc-adventurer-rank-mark" aria-label={rank+'위'}>{rank<=3&&<svg viewBox="0 0 24 12" width="21" height="11" aria-hidden="true"><path fill="currentColor" d="M1 2 6 6 12 0 18 6 23 2 21 10 3 10Z"/><path fill="currentColor" d="M3 11H21V12H3Z"/></svg>}<b>{rank}위</b></span>;
}
function PersonalRow({entry,onClick}:{entry:AdventurerEntry;onClick:()=>void}){
 return <button type="button" className="tc-adventurer-rank-row" data-rank={entry.rank} onClick={onClick}><RankMark rank={entry.rank}/><span className="tc-adventurer-rank-identity"><span className="tc-adventurer-rank-name">{entry.guildEmblem&&<GuildEmblem value={entry.guildEmblem} size={22} label={(entry.guildName??'원정단')+' 문장'}/>}<strong>{entry.nickname}</strong></span><small>Lv. {entry.level} · {className(entry.classId)}{entry.guildName?' · '+entry.guildName:''}</small></span><span className="tc-adventurer-rank-score">{number(entry.combatPower)}</span><span className="tc-adventurer-rank-arrow" aria-hidden="true">›</span></button>;
}
function GuildRow({entry,expanded,onClick}:{entry:GuildRankingEntry;expanded:boolean;onClick:()=>void}){
 return <div className="tc-adventurer-guild-entry"><button type="button" className="tc-adventurer-rank-row" data-rank={entry.rank} aria-expanded={expanded} onClick={onClick}><RankMark rank={entry.rank}/><span className="tc-adventurer-rank-identity"><span className="tc-adventurer-rank-name">{entry.emblem&&<GuildEmblem value={entry.emblem} size={24} label={entry.name+' 문장'}/>}<strong>{entry.name}</strong></span><small>Lv. {entry.level} · {entry.members}/{entry.memberLimit}명</small></span><span className="tc-adventurer-rank-score">{number(entry.combatPower)}</span><span className="tc-adventurer-rank-arrow" aria-hidden="true">{expanded?'⌄':'›'}</span></button>{expanded&&<div className="tc-adventurer-guild-details"><span>최고 단원 전투력 <b>{number(entry.topPower)}</b></span><span>점령 영지 <b>{entry.territories}곳</b></span><span>공성전 승리 <b>{entry.victories}회</b></span></div>}</div>;
}
export function AdventurerDirectory({lease}:{lease:GameplayLease|null}){
 const [view,setView]=useState<{userId:string|null}|null>(null);
 const [mode,setMode]=useState<'personal'|'guild'>('personal');
 const [profile,setProfile]=useState<AdventurerProfile|null>(null),[ranking,setRanking]=useState<AdventurerRanking|null>(null),[guildRanking,setGuildRanking]=useState<GuildRankingState|null>(null);
 const [draft,setDraft]=useState(''),[query,setQuery]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null),list=useRef<HTMLDivElement>(null);
 useEffect(()=>{const handler=(e:Event)=>{if(!lease)return;previous.current=document.activeElement as HTMLElement;setMode('personal');setDraft('');setQuery('');setExpanded(null);setView({userId:(e as CustomEvent<{userId:string|null}>).detail.userId});};window.addEventListener('tower-adventurer-directory',handler);return()=>window.removeEventListener('tower-adventurer-directory',handler);},[lease?.leaseId,lease?.generation]);
 useEffect(()=>{if(!lease)setView(null);},[lease?.leaseId,lease?.generation]);
 const shown=!!view;
 useEffect(()=>{const el=dialog.current;if(shown&&el&&!el.open)el.showModal();return()=>{if(el?.open)el.close();if(shown&&previous.current?.isConnected)previous.current.focus({preventScroll:true});};},[shown]);
 useEffect(()=>{if(!view||!lease)return;let active=true;setLoading(true);setError('');setProfile(null);setRanking(null);setGuildRanking(null);
 const request=view.userId?getAdventurerProfile(lease,view.userId).then(x=>{if(active)setProfile(x);}):mode==='guild'?getGuildRankings(lease,'OVERALL').then(x=>{if(active)setGuildRanking(x);}):getAdventurerRanking(lease,query).then(x=>{if(active)setRanking(x);});
 void request.catch(()=>{if(active)setError('정보를 불러오지 못했습니다. 다시 시도해 주세요.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[view,query,retry,mode,lease?.leaseId,lease?.generation]);
 useEffect(()=>{if(list.current)list.current.scrollTop=0;},[mode,query,view]);
 if(!view)return null;
 const isRank=!view.userId;
 const changeMode=(next:'personal'|'guild')=>{if(mode!==next){setDraft('');setQuery('');setExpanded(null);setMode(next);}};
 const guildRows=(guildRanking?.entries??[]).filter(x=>x.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const myGuild=guildRanking?.entries.find(x=>x.mine);
 const own=(ranking?ranking.mine:null)??ranking?.entries.find(x=>x.rank===ranking?.myRank);
 const status=loading?<p role="status">정보를 불러오는 중…</p>:error?<div role="alert">{error}<button onClick={()=>setRetry(n=>n+1)}>다시 시도</button></div>:null;
 return <dialog ref={dialog} className={'tc-adventurer-dialog'+(isRank?' tc-adventurer-ranking-dialog':'')} aria-labelledby="tc-adventurer-title" onCancel={e=>{e.preventDefault();setView(null);}} onClick={e=>{if(e.target===e.currentTarget)setView(null);}}>
  <header><h2 id="tc-adventurer-title">{view.userId?'캐릭터 정보':'모험가 랭킹'}</h2><button type="button" onClick={()=>setView(null)} aria-label="캐릭터 정보 닫기">×</button></header>
  {view.userId?<div className="tc-adventurer-body"><button type="button" className="tc-adventurer-back" onClick={()=>setView({userId:null})}>‹ 모험가 랭킹 · 검색</button>{status??(profile?<Profile data={profile}/>:<p>조회할 수 없는 캐릭터입니다.</p>)}</div>:<div className="tc-adventurer-ranking-body">
   <nav className="tc-adventurer-rank-tabs" aria-label="랭킹 종류"><button type="button" aria-pressed={mode==='personal'} onClick={()=>changeMode('personal')}>개인 전투력</button><button type="button" aria-pressed={mode==='guild'} onClick={()=>changeMode('guild')}>원정단 전투력</button></nav>
   <form className="tc-adventurer-rank-search" onSubmit={e=>{e.preventDefault();setQuery(draft.trim());setRetry(n=>n+1);}}><input aria-label={mode==='personal'?'닉네임 검색':'원정단명 검색'} placeholder={mode==='personal'?'닉네임 검색':'원정단명 검색'} maxLength={mode==='personal'?12:40} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit">검색</button><button type="button" onClick={()=>{setDraft('');setQuery('');setRetry(n=>n+1);}}>전체</button></form>
   <div className="tc-adventurer-rank-heading"><span>순위</span><span>{mode==='personal'?'모험가':'원정단'}</span><span>전투력</span></div>
   <div className="tc-adventurer-rank-list" ref={list}>{status??(mode==='personal'?ranking?(ranking.entries.length?ranking.entries.map(entry=><PersonalRow key={entry.userId} entry={entry} onClick={()=>setView({userId:entry.userId})}/>):<p>검색 결과가 없습니다.</p>):null:guildRanking?(guildRows.length?guildRows.map(entry=><GuildRow key={entry.associationId} entry={entry} expanded={expanded===entry.associationId} onClick={()=>setExpanded(old=>old===entry.associationId?null:entry.associationId)}/>):<p>검색 결과가 없습니다.</p>):null)}</div>
   <footer className="tc-adventurer-own-rank">{mode==='personal'?<><small>내 순위 · 전체 {number(ranking?.total??0)}명</small>{own?<PersonalRow entry={own} onClick={()=>setView({userId:own.userId})}/>:<p>{ranking?.myRank?ranking.myRank+'위':'—'}</p>}</>:<><small>우리 원정단 순위 · 전체 {number(guildRanking?.totalGuilds??0)}개</small>{myGuild?<GuildRow entry={myGuild} expanded={expanded===myGuild.associationId} onClick={()=>setExpanded(old=>old===myGuild.associationId?null:myGuild.associationId)}/>:<p>{guildRanking?.myRank?guildRanking.myRank+'위':'소속 원정단 없음'}</p>}</>}</footer>
  </div>}
 </dialog>;
}
