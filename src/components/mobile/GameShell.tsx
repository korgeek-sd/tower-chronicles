import React from 'react';
import type {GameState} from '../../game/types';
import {BottomNav} from './BottomNav';
import {GlobalHud} from './GlobalHud';
import type {AppPage,BottomNavPage} from './navigation';
import './mobile-shell.css';

export type GameShellMode='standard'|'battle'|'event';

export function GameShell({mode,game,currentPage,onNavigate,children}:{
  mode:GameShellMode;
  game:GameState;
  currentPage:AppPage;
  onNavigate:(page:AppPage)=>void;
  children:React.ReactNode;
}){
  if(mode!=='standard'){
    return <div className={'game-shell immersive '+mode}>{children}</div>;
  }
  const navigateBottom=(page:BottomNavPage)=>onNavigate(page);
  return <div className="game-shell standard">
    <GlobalHud game={game} onHome={()=>onNavigate('home')} onPremium={()=>onNavigate('premium')}/>
    <main className="game-shell-content">{children}</main>
    <BottomNav current={currentPage} onNavigate={navigateBottom}/>
  </div>;
}
