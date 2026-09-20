import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import type {AppPage} from '../mobile/navigation';
import {jobById} from '../../game/jobs/catalog';
import {titleById} from '../../game/data/cosmetics';
import {CampBagDialog} from '../camp-bag/CampBagDialog';
import {homeSummary} from './homePresentation';
import './home.css';
const actions:[AppPage,string][]=[['jobs','직업'],['cosmetics','외형 · 칭호'],['settings','저장 관리'],['mastery','제작 숙련'],['skills','기존 스킬 구성']];
export function HomeScreen({game,onNavigate}:{game:GameState;onNavigate:(page:AppPage)=>void}){
 const [menu,setMenu]=useState(false),summary=homeSummary(game);
 const title=game.cosmetics.selectedTitleId?titleById(game.cosmetics.selectedTitleId)?.name:null;
 return <section className="home-screen" aria-label="거점">
  <div className="camp-scene" role="img" aria-label="탑 아래에서 원정을 준비하는 탐험가">
   <div className="camp-moon"/><div className="camp-ridge"/><div className="camp-ridge camp-near"/>
   <div className="camp-spire"><div/><div/><div/><div/></div>
   <div className="camp-scene-title"><small>변경의 탐험가</small><h1>탑 아래에서</h1><p>다음 기록은, 아직 쓰이지 않았다.</p></div>
   <div className="camp-traveller" aria-hidden="true"><div/><div/><div/></div>
   <div className="camp-location"><small>IRON VEIN</small><span>철맥의 첨탑</span></div>
  </div>
  <div className="camp-home-summary"><div className="camp-identity"><div><small>{title||'탐험가'}</small><strong>{jobById(game.currentJobId)?.displayName??'무소속 모험가'}</strong></div><button onClick={()=>setMenu(true)} aria-label="거점 메뉴">메뉴 ☰</button></div>
   <div className="camp-home-stats"><span>{summary.currentHp===null?'최대 체력':'현재 체력'} <b>{summary.currentHp===null?summary.maxHp:summary.currentHp+' / '+summary.maxHp}</b></span><span>무기 <b>{summary.weaponName}</b></span></div>
   <div className="camp-home-record"><span>최고 귀환층</span><b>{summary.highestReturned?'철맥 · '+summary.highestReturned+'층':'첫 원정을 기다리는 중'}</b></div>
   <button className="camp-primary" onClick={()=>onNavigate(summary.primaryPage)}>{summary.primaryLabel}<span aria-hidden="true">↗</span></button>
  </div>
  {menu&&<CampBagDialog title="거점 메뉴" onClose={()=>setMenu(false)}><div className="camp-menu">{actions.map(([page,label])=><button key={page} onClick={()=>{setMenu(false);onNavigate(page);}}>{label}<span aria-hidden="true">›</span></button>)}</div></CampBagDialog>}
 </section>;
}
