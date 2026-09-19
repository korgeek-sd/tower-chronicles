import React from 'react';
import {BOTTOM_NAV_ITEMS,bottomNavDestination,type AppPage,type BottomNavPage} from './navigation';

export function BottomNav({current,onNavigate}:{
  current:AppPage;
  onNavigate:(page:BottomNavPage)=>void;
}){
  const active=bottomNavDestination(current);
  return <nav className="bottom-nav" aria-label="주요 메뉴">
    {BOTTOM_NAV_ITEMS.map(item=><button
      key={item.page}
      type="button"
      className={active===item.page?'active':''}
      aria-current={active===item.page?'page':undefined}
      onClick={()=>onNavigate(item.page)}
    >
      <span className="bottom-nav-icon" aria-hidden="true"><img src={item.asset} alt=""/></span>
      <span className="bottom-nav-label">{item.label}</span>
    </button>)}
  </nav>;
}
