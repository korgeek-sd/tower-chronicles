import React from 'react';
import type {GameState} from '../../game/types';
import {WEAPONS} from '../../game/data/config';
import {appearanceById,titleById} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {stats,weaponOf} from '../../game/engine/state';
import {jobById} from '../../game/jobs/catalog';
import {ScreenHeader} from '../mobile/ScreenHeader';
import type {AppPage} from '../mobile/navigation';
import './home.css';

const QUICK_ACTIONS:{page:AppPage;label:string;icon:string;meta:string}[]=[
  {page:'jobs',label:'직업',icon:'♜',meta:'직업 카탈로그'},
  {page:'cosmetics',label:'외형',icon:'♙',meta:'외형 · 칭호'},
  {page:'settings',label:'저장',icon:'▣',meta:'백업 관리'},
  {page:'mastery',label:'숙련',icon:'⚒',meta:'제작 성장'},
];

export function HomeScreen({game,onNavigate}:{
  game:GameState;
  onNavigate:(page:AppPage)=>void;
}){
  const currentStats=stats(game);
  const weapon=WEAPONS[weaponOf(game)];
  const appearance=appearanceById(game.cosmetics.selectedAppearanceId);
  const title=game.cosmetics.selectedTitleId?titleById(game.cosmetics.selectedTitleId):null;
  const job=jobById(game.currentJobId);
  const inExpedition=!!game.expedition;

  return <section className="home-screen" aria-label="거점">
    <ScreenHeader title="거점" meta={inExpedition?'진행 중인 원정이 있습니다':'다음 원정을 준비하세요'}/>

    <section className="home-character-card" aria-label="현재 모험가">
      <div className="home-character-art">
        {appearance?<img src={assetUrl(appearance.imagePath)} alt={appearance.name}/>:<span aria-hidden="true">♙</span>}
      </div>
      <div className="home-character-info">
        <span className="home-character-kicker">{title?'「'+title.name+'」':'NOVAR EXPLORER'}</span>
        <strong>{job?.displayName??'무소속 모험가'}</strong>
        <span className="home-weapon"><b>{weapon.name}</b> · {weapon.description}</span>
        <div className="home-combat-stats">
          <span><small>HP</small><b>{Math.round(currentStats.hp)}</b></span>
          <span><small>공격</small><b>{Math.round(currentStats.attack)}</b></span>
          <span><small>방어</small><b>{Math.round(currentStats.defense)}</b></span>
        </div>
      </div>
    </section>

    <button
      type="button"
      className="home-expedition-cta game-button primary"
      onClick={()=>onNavigate(inExpedition?'battle':'towers')}
    >
      <span aria-hidden="true">{inExpedition?'↶':'▲'}</span>
      <span><strong>{inExpedition?'원정으로 돌아가기':'탑으로 떠나기'}</strong><small>{inExpedition?'전투 기록으로 복귀':'탑을 선택하고 원정을 준비'}</small></span>
      <b aria-hidden="true">→</b>
    </button>

    <div className="home-quick-actions" aria-label="빠른 메뉴">
      {QUICK_ACTIONS.map(action=><button
        key={action.page}
        type="button"
        onClick={()=>onNavigate(action.page)}
      >
        <span className="home-quick-icon" aria-hidden="true">{action.icon}</span>
        <strong>{action.label}</strong>
        <small>{action.meta}</small>
      </button>)}
    </div>

    <div className="home-status-strip" role="status">
      <span>Silver <b>{game.silver.toLocaleString()}</b></span>
      <span>철맥 입장권 <b>{game.tickets.ore[0]}장</b></span>
    </div>
  </section>;
}
