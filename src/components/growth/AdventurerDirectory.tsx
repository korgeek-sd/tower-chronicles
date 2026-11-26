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
const rewardTiers = [
 { lastRank: 1, label: '1위', amount: 100 },
 { lastRank: 2, label: '2위', amount: 80 },
 { lastRank: 3, label: '3위', amount: 60 },
 { lastRank: 10, label: '4~10위', amount: 40 },
 { lastRank: 20, label: '11~20위', amount: 25 },
 { lastRank: 30, label: '21~30위', amount: 10 },
];
function tierForRank(rank: number | null) {
 return rank && rank > 0 ? rewardTiers.find(tier => rank <= tier.lastRank) : undefined;
}
const rewardImages = {
 ticket: ['appearance_summon_ticket_pixel.webp','외형 소환권'],
 box: ['adventurer_equipment_box.png','모험가 장비 상자'],
 selector: ['ssr_shard_selector.webp','SSR 외형 조각 선택권'],
};
function RewardIcon({kind}:{kind:keyof typeof rewardImages}) {
 const [file,label] = rewardImages[kind];
 return <img className="tc-rank-item" alt={label} src={assetUrl('assets/ui/shop/'+file)}/>;
}
function RankPortrait({entry}:{entry:AdventurerEntry}) {
 const id=entry.classId;
 if(id!=='warrior' && id!=='mage' && id!=='archer') return <span className="tc-rank-portrait" aria-hidden="true"/>;
 return <img className="tc-rank-portrait" loading="lazy" alt={className(id)} src={assetUrl('assets/characters/classes/'+id+'-portrait-v2.svg')}/>;
}
function MonthlyPanel({own,ownRank,rewards}:{own:AdventurerEntry|null|undefined;ownRank:number|null;rewards:boolean}) {
 const tier=tierForRank(ownRank);
 const month=Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'Asia/Seoul'}).format(new Date()));
 return <>
  <div className="tc-month-summary">
   {own && <RankPortrait entry={own}/>}
   <div><strong>{own?.nickname ?? '내 순위'}</strong><span>{ownRank ? ownRank+'위' : '순위 없음'}{own && ' · 전투력 '+number(own.combatPower)}</span></div>
   <div className="tc-rank-forecast"><small>{rewards ? '다음 정산일' : month+'월 예상 보상'}</small>
    {rewards ? <b>{month%12+1}월 1일</b> : tier ? <span><RewardIcon kind="ticket"/>×{tier.amount} <RewardIcon kind="box"/>×{tier.amount}{ownRank===1 && <><RewardIcon kind="selector"/>×1</>}</span> : <span>보상 구간 밖</span>}
   </div>
  </div>
  {rewards && <section className="tc-month-table-wrap" aria-label="월간 보상표">
   <table className="tc-month-table"><thead><tr><th>순위</th><th>외형 소환권</th><th>장비 상자</th></tr></thead><tbody>
   {rewardTiers.map(row=><tr key={row.lastRank} data-mine={tier===row}><th scope="row">{row.label}{tier===row && <small>내 구간</small>}</th><td><RewardIcon kind="ticket"/>{row.amount}장</td><td><RewardIcon kind="box"/>{row.amount}개</td></tr>)}
   </tbody></table>
   <div className="tc-month-bonus"><RewardIcon kind="selector"/><div><small>1위 추가 보상</small><strong>SSR 외형 조각 선택권 1장</strong></div></div>
  </section>}
 </>;
}
function PersonalRow({entry,onClick}:{entry:AdventurerEntry;onClick:()=>void}){
 return <button type="button" className="tc-adventurer-rank-row tc-personal-row" data-rank={entry.rank} onClick={onClick}><RankMark rank={entry.rank}/><RankPortrait entry={entry}/><span className="tc-adventurer-rank-identity"><span className="tc-adventurer-rank-name">{entry.guildEmblem&&<GuildEmblem value={entry.guildEmblem} size={22} label={(entry.guildName??'원정단')+' 문장'}/>}<strong>{entry.nickname}</strong></span><small>Lv. {entry.level} · {className(entry.classId)}{entry.guildName?' · '+entry.guildName:''}</small></span><span className="tc-adventurer-rank-score">{number(entry.combatPower)}</span><span className="tc-adventurer-rank-arrow" aria-hidden="true">›</span></button>;
}
function GuildRow({entry,expanded,onClick}:{entry:GuildRankingEntry;expanded:boolean;onClick:()=>void}){
 return <div className="tc-adventurer-guild-entry"><button type="button" className="tc-adventurer-rank-row" data-rank={entry.rank} aria-expanded={expanded} onClick={onClick}><RankMark rank={entry.rank}/><span className="tc-adventurer-rank-identity"><span className="tc-adventurer-rank-name">{entry.emblem&&<GuildEmblem value={entry.emblem} size={24} label={entry.name+' 문장'}/>}<strong>{entry.name}</strong></span><small>Lv. {entry.level} · {entry.members}/{entry.memberLimit}명</small></span><span className="tc-adventurer-rank-score">{number(entry.combatPower)}</span><span className="tc-adventurer-rank-arrow" aria-hidden="true">{expanded?'⌄':'›'}</span></button>{expanded&&<div className="tc-adventurer-guild-details"><span>최고 단원 전투력 <b>{number(entry.topPower)}</b></span><span>점령 영지 <b>{entry.territories}곳</b></span><span>공성전 승리 <b>{entry.victories}회</b></span></div>}</div>;
}
export function AdventurerDirectory({lease,initiallyOpen=false}:{lease:GameplayLease|null;initiallyOpen?:boolean}){
 const [view,setView]=useState<{userId:string|null}|null>(()=>initiallyOpen&&lease?{userId:null}:null);
 const [rewards,setRewards]=useState(false);
 const [mode,setMode]=useState<'personal'|'guild'>('personal');
 const [profile,setProfile]=useState<AdventurerProfile|null>(null),[ranking,setRanking]=useState<AdventurerRanking|null>(null),[guildRanking,setGuildRanking]=useState<GuildRankingState|null>(null);
 const [draft,setDraft]=useState(''),[query,setQuery]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),previous=useRef<HTMLElement|null>(null),list=useRef<HTMLDivElement>(null);
 useEffect(()=>{const handler=(e:Event)=>{if(!lease)return;previous.current=document.activeElement as HTMLElement;setMode('personal');setRewards(false);setDraft('');setQuery('');setExpanded(null);setView({userId:(e as CustomEvent<{userId:string|null}>).detail.userId});};window.addEventListener('tower-adventurer-directory',handler);return()=>window.removeEventListener('tower-adventurer-directory',handler);},[lease?.leaseId,lease?.generation]);
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
  <header style={isRank && mode==='personal' ? {backgroundImage:"linear-gradient(90deg,#101014c9,#11101788),url("+assetUrl("assets/ui/guild/concept2-castle.webp")+")",backgroundSize:"cover",backgroundPosition:"center"}:undefined}><h2 id="tc-adventurer-title">{view.userId?'캐릭터 정보':mode==='personal'?'개인 전투력 랭킹':'원정단 전투력 랭킹'}</h2><button type="button" onClick={()=>setView(null)} aria-label="캐릭터 정보 닫기">×</button></header>
  {view.userId?<div className="tc-adventurer-body"><button type="button" className="tc-adventurer-back" onClick={()=>setView({userId:null})}>‹ 모험가 랭킹</button>{status??(profile?<Profile data={profile}/>:<p>조회할 수 없는 캐릭터입니다.</p>)}</div>:<div className="tc-adventurer-ranking-body">
   <nav className="tc-adventurer-rank-tabs" aria-label="랭킹 종류"><button type="button" aria-pressed={mode==='personal'} onClick={()=>changeMode('personal')}>개인 전투력</button><button type="button" aria-pressed={mode==='guild'} onClick={()=>changeMode('guild')}>원정단 전투력</button></nav>
   {mode==='personal' && <nav className="tc-adventurer-rank-tabs" aria-label="개인 랭킹 보기"><button aria-pressed={!rewards} onClick={()=>setRewards(false)}>{new Intl.DateTimeFormat('ko-KR',{month:'long',timeZone:'Asia/Seoul'}).format(new Date())} 랭킹</button><button aria-pressed={rewards} onClick={()=>setRewards(true)}>월간 보상</button></nav>}
   {mode==='personal' && (status ?? <MonthlyPanel own={own} ownRank={own?.rank??ranking?.myRank??null} rewards={rewards}/>)}
   {mode==='guild' && <form className="tc-adventurer-rank-search" onSubmit={e=>{e.preventDefault();setQuery(draft.trim());setRetry(n=>n+1);}}><input aria-label={'원정단명 검색'} placeholder={'원정단명 검색'} maxLength={40} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit">검색</button><button type="button" onClick={()=>{setDraft('');setQuery('');setRetry(n=>n+1);}}>전체</button></form>}
   {(mode==='guild' || !rewards) && <><div className="tc-adventurer-rank-heading"><span>순위</span><span>{mode==='personal'?'모험가':'원정단'}</span><span>전투력</span></div>
   <div className="tc-adventurer-rank-list" ref={list}>{(mode==='personal' && status)?null:status??(mode==='personal'?ranking?(ranking.entries.length?ranking.entries.map(entry=><PersonalRow key={entry.userId} entry={entry} onClick={()=>setView({userId:entry.userId})}/>):<p>검색 결과가 없습니다.</p>):null:guildRanking?(guildRows.length?guildRows.map(entry=><GuildRow key={entry.associationId} entry={entry} expanded={expanded===entry.associationId} onClick={()=>setExpanded(old=>old===entry.associationId?null:entry.associationId)}/>):<p>검색 결과가 없습니다.</p>):null)}</div></>}
   {mode==='guild' && <footer className="tc-adventurer-own-rank"><small>우리 원정단 순위 · 전체 {number(guildRanking?.totalGuilds??0)}개</small>{myGuild?<GuildRow entry={myGuild} expanded={expanded===myGuild.associationId} onClick={()=>setExpanded(old=>old===myGuild.associationId?null:myGuild.associationId)}/>:<p>{guildRanking?.myRank?guildRanking.myRank+'위':'소속 원정단 없음'}</p>}</footer>}
  </div>}
 </dialog>;
}
