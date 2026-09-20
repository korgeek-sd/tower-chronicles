import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import {BOTTOM_NAV_ITEMS,type AppPage} from '../mobile/navigation';
import {CampBagDialog} from './CampBagDialog';
import {descriptionPages} from '../inventory/inventoryPresentation';
import './camp-bag.css';
export function CampBagShell({game,currentPage,onNavigate,saved,storageError,children}:{game:GameState;currentPage:'home'|'inventory';onNavigate:(page:AppPage)=>void;saved:string;storageError:string;children:React.ReactNode}){
 const [detail,setDetail]=useState(false),[detailPage,setDetailPage]=useState(0),messages=descriptionPages(storageError||game.notice||saved,100),safe=Math.min(detailPage,messages.length-1);
 return <div className="app camp-bag-mode">
  <header className="camp-header"><button className="camp-brand" onClick={()=>onNavigate('home')}>탑의 기록<small>TOWER CHRONICLES</small></button><button className="camp-account" onClick={()=>onNavigate('premium')}>황금기록자 ›</button></header>
  <div className="camp-wallet"><span aria-label={`Silver ${game.silver.toLocaleString()}`}>◈ <b>{game.silver.toLocaleString()}</b> <small>Silver</small></span><span aria-label={`Gold ${game.market.gold.toLocaleString()}`}>◇ <b>{game.market.gold.toLocaleString()}</b> <small>Gold</small></span></div>
  <main>{children}</main>
  <div className="camp-footer"><button className={'camp-status '+(storageError?'camp-error':'')} onClick={()=>{setDetailPage(0);setDetail(true);}}><span role={storageError?'alert':'status'}>{storageError?'저장 오류 · 확인 필요':game.notice||saved}</span><span aria-hidden="true">›</span></button><nav className="camp-nav" aria-label="주 메뉴">{BOTTOM_NAV_ITEMS.map(n=><button key={n.page} aria-current={currentPage===n.page?'page':undefined} onClick={()=>onNavigate(n.page)}><img src={n.asset} alt=""/><span>{n.label}</span></button>)}</nav></div>
  {detail&&<CampBagDialog title={storageError?'저장 오류':'기록과 상태'} onClose={()=>setDetail(false)}><p>{messages[safe]}</p><p className="camp-muted">{saved}</p><div className="camp-facts"><span>Silver</span><b>{game.silver.toLocaleString()}</b><span>Gold</span><b>{game.market.gold.toLocaleString()}</b></div>{messages.length>1&&<div className="camp-pages"><button disabled={!safe} onClick={()=>setDetailPage(safe-1)}>이전</button><span>{safe+1} / {messages.length}</span><button disabled={safe===messages.length-1} onClick={()=>setDetailPage(safe+1)}>다음</button></div>}<button className="camp-primary" onClick={()=>{setDetail(false);onNavigate('settings');}}>저장 관리</button></CampBagDialog>}
 </div>;
}
