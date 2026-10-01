import React from 'react';

export interface AssociationProgressionData {
  level:number;
  exp:number;
  nextExp:number;
  contributionPoint:number;
  totalSilverDonation:number;
  totalGoldDonation:number;
}

interface Props {
 data:AssociationProgressionData;
 onSilverDonate:()=>void;
 onGoldDonate:()=>void;
 busy?:boolean;
}

export function AssociationProgressionPanel({data,onSilverDonate,onGoldDonate,busy=false}:Props){
 const progress=data.nextExp>0?Math.min(100,Math.floor(data.exp/data.nextExp*100)):100;
 return <section className="tc-panel tc-association-progression">
  <header className="tc-panel-title">
   <div><b>원정단 성장</b><small>EXPEDITION PROGRESS</small></div>
   <strong>Lv.{data.level}</strong>
  </header>
  <div className="tc-exp-bar">
   <div style={{width:`${progress}%`}} />
  </div>
  <small>{data.exp.toLocaleString()} / {data.nextExp.toLocaleString()} EXP</small>

  <div className="tc-association-contribution">
   <span><small>내 공헌도</small><b>{data.contributionPoint.toLocaleString()}</b></span>
   <span><small>누적 실버 기부</small><b>{data.totalSilverDonation.toLocaleString()} S</b></span>
   <span><small>누적 골드 기부</small><b>{data.totalGoldDonation.toLocaleString()} G</b></span>
  </div>

  <div className="tc-association-donation-actions">
   <button disabled={busy} onClick={onSilverDonate}>실버 기부</button>
   <button disabled={busy} onClick={onGoldDonate}>골드 기부</button>
  </div>
 </section>;
}
