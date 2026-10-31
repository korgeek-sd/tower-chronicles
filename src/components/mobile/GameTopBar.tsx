import React from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {assetUrl} from '../../game/data/graphics';
import {PremiumStatus} from '../PremiumStatus';
import {Glyph} from '../../ui/mobile';

type Props={
 nickname?:string;game:GameState;userId:string|null;lease:GameplayLease|null;
 now:number;currentPage:string;unreadMail:number;
 onProfile:()=>void;onShop:()=>void;onPremium:()=>void;onMail:()=>void;onMenu:()=>void;
};

/** Premium-integrated status bar. No profile, level, or network growth polling. */
export function GameTopBar({game,userId,now,unreadMail,onShop,onPremium,onMail,onMenu}:Props){
 const silver=game.silver.toLocaleString('ko-KR');
 const gold=game.market.gold.toLocaleString('ko-KR');
 const unread=unreadMail>0?' · 읽지 않은 우편 '+unreadMail+'개':'';
 const spriteStyle={'--tc-tapestry-sprite':'url("'+assetUrl('assets/ui/topbar/tower-topbar-art.webp')+'")'} as React.CSSProperties;
 return <header className="tc-topbar tc-topbar-tapestry" style={spriteStyle} aria-label="탑의 기록 상단 상태바">
  <div className="tc-tapestry-brand" aria-label="탑의 기록">
   <span className="tc-tapestry-banner" aria-hidden="true"/>
   <span className="tc-tapestry-brand-text"><strong>탑의 기록</strong><small>THE ARCHIVE OF THE TOWER</small></span>
  </div>
  <div className="tc-tapestry-wallet" aria-label="보유 재화">
   <div className="tc-tapestry-balance">
    <i className="tc-tapestry-coin silver" aria-hidden="true"/>
    <span className="tc-tapestry-amount" title={silver+' 실버'}>{silver}</span><small>S</small>
    <button type="button" aria-label="상점 열기 · 실버" onClick={onShop}>+</button>
   </div>
   <div className="tc-tapestry-balance">
    <i className="tc-tapestry-coin gold" aria-hidden="true"/>
    <span className="tc-tapestry-amount" title={gold+' 골드'}>{gold}</span><small>G</small>
    <button type="button" aria-label="상점 열기 · 골드" onClick={onShop}>+</button>
   </div>
  </div>
  <div className="tc-tapestry-premium">
   <PremiumStatus key={userId??'guest'} userId={userId} guestExpiresAt={game.goldenRecorder?.expiresAt} now={now} onOpen={onPremium}/>
  </div>
  <div className="tc-tapestry-tools">
   <button type="button" aria-label={'우편함 열기'+unread} onClick={onMail}>
    <Glyph name="mail"/>{unreadMail>0&&<span className="tc-tapestry-unread" aria-hidden="true">{unreadMail>9?'9+':unreadMail}</span>}
   </button>
   <button type="button" aria-label="설정 메뉴 열기" onClick={onMenu}><span className="tc-tapestry-menu-icon" aria-hidden="true"><i/><i/><i/></span></button>
  </div>
 </header>;
}
