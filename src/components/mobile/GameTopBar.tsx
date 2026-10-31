import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {getCharacterGrowth,type CharacterGrowthSnapshot} from '../../online/characterGrowth';
import {playerGraphicForJob,assetUrl} from '../../game/data/graphics';
import {huntingProgress} from '../../game/hunting/model';
import {PremiumStatus} from '../PremiumStatus';
import {Glyph} from '../../ui/mobile';

type Props={
 nickname?:string;game:GameState;userId:string|null;lease:GameplayLease|null;
 now:number;currentPage:string;unreadMail:number;
 onProfile:()=>void;onShop:()=>void;onPremium:()=>void;onMail:()=>void;onMenu:()=>void;
};

/** The header never invents character levels: online experience comes from the server. */
export function GameTopBar({nickname,game,userId,lease,now,currentPage,unreadMail,onProfile,onShop,onPremium,onMail,onMenu}:Props){
 const identity=userId&&lease?[userId,lease.leaseId,lease.generation,lease.clientInstanceId].join(':'):'';
 const [growth,setGrowth]=useState<{identity:string;data:CharacterGrowthSnapshot}|null>(null);
 const fetched=useRef<{identity:string;at:number}>({identity:'',at:0});
 useEffect(()=>{
  if(!identity||!lease)return;
  let mounted=true;
  const refresh=()=>{
   if(document.visibilityState==='hidden')return;
   const time=Date.now();
   if(fetched.current.identity===identity&&time-fetched.current.at<25000)return;
   fetched.current={identity,at:time};
   void getCharacterGrowth(lease).then(data=>{if(mounted)setGrowth({identity,data});}).catch(()=>{});
  };
  refresh();
  const visible=()=>{if(document.visibilityState==='visible')refresh();};
  const timer=window.setInterval(refresh,90000);
  document.addEventListener('visibilitychange',visible);
  return()=>{mounted=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[identity,lease?.leaseId,lease?.generation,lease?.clientInstanceId,currentPage]);
 const data=growth?.identity===identity?growth.data:null;
 const progress=data?huntingProgress(data.experience):null;
 const xp=progress?(progress.nextExp===0?100:Math.max(0,Math.min(100,Math.floor(progress.exp/progress.nextExp*100)))):0;
 const name=nickname?.trim()||'기록자';
 const art=playerGraphicForJob(data?.currentJobId??game.currentJobId,data?.selectedAppearanceId??game.cosmetics.selectedAppearanceId).image.idle;
 const silver=game.silver.toLocaleString('ko-KR'),gold=game.market.gold.toLocaleString('ko-KR');
 const unread=unreadMail>0?' · 읽지 않은 우편 '+unreadMail+'개':'';
 const experienceText=progress?(progress.nextExp===0?'최고 레벨':progress.exp+' / '+progress.nextExp):'정보 확인 중';
 return <header className="tc-topbar tc-topbar-profile-v2" aria-label="캐릭터 및 재화 상태">
  <button className="tc-v2-profile" type="button" onClick={onProfile} aria-label={'성장 현황 열기 · '+name+(progress?' 레벨 '+progress.level:'')}>
   <span className="tc-v2-portrait">{art?<img src={assetUrl(art)} alt=""/>:<Glyph name="cosmetics"/>}</span>
   <span className="tc-v2-identity"><strong className="tc-v2-nickname">{name}</strong><small>{progress?'Lv.'+progress.level:'성장 현황'}</small>
    <span className="tc-v2-xp" role="progressbar" aria-label="캐릭터 경험치" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?xp:undefined} aria-valuetext={experienceText}><i style={{width:xp+'%'}}/></span>
   </span>
  </button>
  <div className="tc-v2-wallet" aria-label="보유 재화">
   <div className="tc-v2-balance"><i className="silver" aria-hidden="true"/><span title={silver+' 실버'}>{silver}</span><small>S</small></div>
   <div className="tc-v2-balance"><i className="gold" aria-hidden="true"/><span title={gold+' 골드'}>{gold}</span><small>G</small>
    <button type="button" className="tc-v2-gold-add" aria-label="골드 상점 열기" onClick={onShop}>+</button>
   </div>
  </div>
  <div className="tc-v2-premium"><PremiumStatus key={userId??'guest'} userId={userId} guestExpiresAt={game.goldenRecorder?.expiresAt} now={now} onOpen={onPremium}/></div>
  <div className="tc-v2-tools">
   <button type="button" aria-label={'우편함 열기'+unread} onClick={onMail}><Glyph name="mail"/>{unreadMail>0&&<span className="tc-v2-unread" aria-hidden="true">{unreadMail>9?'9+':unreadMail}</span>}</button>
   <button type="button" aria-label="설정 메뉴 열기" onClick={onMenu}><Glyph name="settings"/></button>
  </div>
 </header>;
}
