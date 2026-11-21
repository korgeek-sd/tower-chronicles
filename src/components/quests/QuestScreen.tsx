import React,{useState} from 'react';
import {Glyph,Screen,Segments} from '../../ui/mobile';
import type {AppPage} from '../mobile/CoreScreens';
import type {QuestBoard,QuestEntry,QuestPeriod} from '../../online/quests';
import {questRewardSummary} from '../../online/quests';
import './quests.css';
import {assetUrl} from '../../game/data/graphics';

export const DAILY_QUESTS=[['사냥 승리 30회',30,'hunt','sword'],['제작 10회',10,'craft','craft'],['채집 30회',30,'world','materials'],['거래소 구입 3회',3,'market','market'],['원정단 기부 3회',3,'association','association']] as const;
export const WEEKLY_QUESTS=[['사냥 승리 300회',300,'hunt','sword'],['제작 50회',50,'craft','craft'],['채집 150회',150,'world','materials'],['일일 의뢰 완료 10개',10,'quests','bestiary'],['주간 의뢰 4개 모두 완료',4,'quests','bestiary']] as const;
const ids={daily:['hunt','craft','gather','market','donate'],weekly:['hunt','craft','gather','daily','all']} as const;
const descriptions:Record<QuestPeriod,Record<string,string>>={
 daily:{
  hunt:'몬스터를 처치하고 전투에서 승리하세요.',
  craft:'아이템을 제작하세요.',
  gather:'자원을 채집하세요.',
  market:'거래소에서 아이템을 구입하세요.',
  donate:'원정단에 자원을 기부하세요.'
 },
 weekly:{
  hunt:'한 주 동안 사냥에서 승리하세요.',
  craft:'한 주 동안 아이템을 제작하세요.',
  gather:'한 주 동안 자원을 채집하세요.',
  daily:'일일 의뢰를 완료하세요.',
  all:'다른 주간 의뢰 4개를 완료하세요.'
 }
};
const iconSlot:Record<string,number>={hunt:0,craft:1,gather:2,market:3,donate:4,daily:5,all:6};
const questEmblemsUrl=assetUrl('assets/ui/quests/quest_emblems_hd.webp');
function QuestEmblemIcon({id,glyph}:{id:string;glyph:string}){
 const [broken,setBroken]=useState(false);
 const slot=iconSlot[id]??0;
 return <span className="tc-quest-icon-art" aria-hidden="true">
  <span className="tc-quest-icon-fallback"><Glyph name={glyph}/></span>
  {!broken&&<img src={questEmblemsUrl} alt="" decoding="async" loading="eager" style={{left:'-'+slot*100+'%'}} onError={()=>setBroken(true)}/>}
 </span>;
}
const asPercent=(progress:number,target:number)=>target>0?Math.max(0,Math.min(100,Math.round(progress/target*100))):0;

export function QuestScreen({onMove,board=null,onClaim,busy=false,message='',error='',onRetry,initialTab='daily'}:{onMove:(page:AppPage)=>void;board?:QuestBoard|null;onClaim?:(period:QuestPeriod,q:QuestEntry)=>void;busy?:boolean;message?:string;error?:string;onRetry?:()=>void;initialTab?:QuestPeriod}){
 const [tab,setTab]=useState<QuestPeriod>(initialTab);
 const quests=board?.[tab]??[];
 const finished=quests.filter(q=>q.completed||q.claimed).length;
 const ready=quests.filter(q=>q.completed&&!q.claimed).length;
 return <Screen eyebrow="NOVAR · QUEST BOARD" title="의뢰 게시판" className="tc-quest-screen tc-quest-screen-v3">
  <div className="tc-quest-board">
   <div className="tc-quest-scene" aria-hidden="true">
    <i className="tc-quest-lantern left"/><i className="tc-quest-lantern right"/>
    <div className="tc-quest-scene-crest"><Glyph name="jobs"/><span>모험가의 의뢰</span></div>
    <p>모험가에게 주어진 의뢰를 수행하고 보상을 획득하세요.</p>
   </div>
   <div className="tc-quest-toolbar">
    <Segments items={[['daily','일일'],['weekly','주간']] as const} value={tab} onChange={setTab} label="의뢰 기간"/>
   </div>
   <div className="tc-quest-overview">
    <span className="tc-quest-completion"><Glyph name="jobs"/> 완료 현황 <b>{board?finished+' / '+quests.length:'— / —'}</b></span>
    <span className="tc-quest-reset"><Glyph name="revival"/> {tab==='daily'?'매일':'월요일'} 00시 초기화</span>
   </div>
   {(error||message||!board)&&<div className={'tc-quest-status'+(error?' is-error':'')} role={error?'alert':'status'}>
    <span>{error||message||'의뢰 불러오는 중'}</span>
    {error&&onRetry&&<button type="button" disabled={busy} onClick={onRetry}>다시 확인</button>}
   </div>}
   <div className={'tc-quest-wall '+(tab==='weekly'?'is-weekly':'is-daily')} aria-label={tab==='daily'?'일일 의뢰 목록':'주간 의뢰 목록'}>
    {quests.map(q=>{
     const index=(ids[tab] as readonly string[]).indexOf(q.id);
     const definition=(tab==='daily'?DAILY_QUESTS:WEEKLY_QUESTS)[index];
     if(!definition)return null;
     const [name,,page,glyph]=definition;
     const action=q.claimed?'수령 완료':q.completed?'보상받기':'바로가기';
     const status=q.claimed?'수령 완료':q.completed?'완료':'진행 중';
     const percent=asPercent(q.progress,q.target);
     const description=descriptions[tab][q.id]??name;
     const reward=q.claimed&&q.reward?questRewardSummary(q.reward):q.claimed?'수령 완료':'랜덤 보상';
     function activate(){
      if(q.claimed||busy)return;
      if(q.completed)onClaim?.(tab,q);
      else if(page==='quests')setTab(q.id==='daily'?'daily':'weekly');
      else onMove(page);
     }
     return <article key={q.id} className={'tc-quest-paper '+(q.claimed?'is-claimed':q.completed?'is-ready':'is-progress')}>
      <span className="tc-quest-emblem"><QuestEmblemIcon id={q.id} glyph={glyph}/></span>
      <div className="tc-quest-info">
       <div className="tc-quest-name-row"><strong>{name}</strong><span className="tc-quest-state">{status}</span></div>
       <p className="tc-quest-description">{description}</p>
       <div className="tc-quest-progress"><span>{q.progress} / {q.target}</span>
        <div className="tc-quest-track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={Math.min(q.target,Math.max(0,q.progress))}><i style={{width:percent+'%'}}/></div>
        <em>{percent}%</em>
       </div>
      </div>
      <div className="tc-quest-foot">
       <small title={reward}>{reward}</small>
       <button type="button" className="tc-quest-seal" aria-label={name+' '+action} disabled={q.claimed||busy||(q.completed&&!onClaim)} onClick={activate}><span>{action}</span></button>
      </div>
     </article>;
    })}
   </div>
   <div className="tc-quest-rewards">
    <span className="tc-quest-reward-emblem"><QuestEmblemIcon id="all" glyph="inventory"/></span>
    <div><strong>의뢰 보상</strong><small>의뢰 완료 시 랜덤 보상을 획득할 수 있습니다.</small></div>
    <b>수령 가능 {ready}건</b>
   </div>
  </div>
 </Screen>;
}
