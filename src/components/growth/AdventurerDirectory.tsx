import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import {getAdventurerProfile,type AdventurerProfile,type AdventurerDirectoryRequest} from '../../online/adventurerDirectory';
import {GuildRankingPanel} from '../association/GuildRankingPanel';
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

function DirectoryDialog({label,ranking=false,onClose,children}:{
 label:string;ranking?:boolean;onClose:()=>void;children:React.ReactNode;
}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  const trigger=document.activeElement;
  dialog.showModal();
  return ()=>{
   dialog.close();
   if(trigger instanceof HTMLElement && trigger.isConnected)trigger.focus({preventScroll:true});
  };
 },[]);
 return <dialog ref={ref} aria-label={label} className={'tc-adventurer-dialog'+(ranking?' tc-adventurer-ranking-dialog':'')}
  onCancel={event=>{if(event.target===event.currentTarget){event.preventDefault();onClose();}}}
  onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  {children}
 </dialog>;
}

function CharacterDetails({lease,userId}:{lease:GameplayLease;userId:string}){
 const [data,setData]=useState<AdventurerProfile|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let current=true;
  setStatus('loading');
  void getAdventurerProfile(lease,userId).then(profile=>{
   if(current){setData(profile);setStatus('ready');}
  }).catch(()=>{if(current)setStatus('error');});
  return ()=>{current=false;};
 },[lease.leaseId,lease.generation,userId,attempt]);
 if(status==='loading')return <p role="status">정보를 불러오는 중…</p>;
 if(status==='error')return <div role="alert">정보를 불러오지 못했습니다. <button type="button" onClick={()=>setAttempt(n=>n+1)}>다시 시도</button></div>;
 return data?<Profile data={data}/>:<p>조회할 수 없는 캐릭터입니다.</p>;
}

export function AdventurerDirectory({lease,initiallyOpen=false}:{lease:GameplayLease|null;initiallyOpen?:boolean}){
 const [rankingOpen,setRankingOpen]=useState(()=>initiallyOpen && !!lease);
 const [profile,setProfile]=useState<{userId:string;fromRanking:boolean}|null>(null);
 useEffect(()=>{
  if(!lease){setProfile(null);setRankingOpen(false);return;}
  const open=(event:Event)=>{
   const {userId,fromRanking=false}=(event as CustomEvent<AdventurerDirectoryRequest>).detail;
   if(userId){setProfile({userId,fromRanking});return;}
   setProfile(null);
   setRankingOpen(true);
  };
  window.addEventListener('tower-adventurer-directory',open);
  return ()=>window.removeEventListener('tower-adventurer-directory',open);
 },[lease?.leaseId,lease?.generation]);
 if(!lease)return null;
 const closeProfile=()=>setProfile(null);
 const backToRanking=()=>{
  if(!profile?.fromRanking)setRankingOpen(true);
  closeProfile();
 };
 return <>
  {rankingOpen && <DirectoryDialog label="전투력 랭킹" ranking onClose={()=>setRankingOpen(false)}>
   <GuildRankingPanel lease={lease} initialTab="personal" onClose={()=>setRankingOpen(false)}/>
  </DirectoryDialog>}
  {profile && <DirectoryDialog label="캐릭터 정보" onClose={closeProfile}>
   <header><h2>캐릭터 정보</h2><button type="button" onClick={closeProfile} aria-label="캐릭터 정보 닫기">×</button></header>
   <div className="tc-adventurer-body">
    <button type="button" className="tc-adventurer-back" onClick={backToRanking}>‹ {profile.fromRanking?'랭킹으로':'모험가 랭킹'}</button>
    <CharacterDetails key={profile.userId} lease={lease} userId={profile.userId}/>
   </div>
  </DirectoryDialog>}
 </>;
}
