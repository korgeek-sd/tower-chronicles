import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{AssociationScreen}from'../components/association/AssociationScreen';
import{VillageWarBattleScreen}from'../components/occupation/VillageWarBattleScreen';
import{GameTopBar}from'../components/mobile/GameTopBar';
import{HubIcon}from'../components/mobile/HubIcon';
import{WorldChat}from'../components/WorldChat';
import{AdventurerDirectory}from'../components/growth/AdventurerDirectory';
import{openAdventurerRanking}from'../online/adventurerDirectory';
import type{GameState}from'../game/types';
import{gameSnapshot,installGuildLabMock,LAB_LEASE,LAB_USER,labRole,listenLabChanges,resetLab,setGameSnapshot,updateLabRole}from'./mockBackend';
import'../mobile-game.css';
import'../game-fonts.css';
import'../gameFeel/game-feel.css';
import'../components/mobile/moonlit-camp.css';
import'../components/mobile/game-topbar.css';
import'../components/mobile/novar-concept-one.css';
import'./realLab.css';

installGuildLabMock();
const initialView=new URLSearchParams(location.search).get('view');
type Page='association'|'occupation';
type Role='LEADER'|'MEMBER'|'NONE';
class Fallback extends React.Component<{children:React.ReactNode},{error:string}>{
 state={error:''};
 static getDerivedStateFromError(e:Error){return{error:e.message};}
 render(){return this.state.error?<div className="gl-crash" role="alert">원정단 실험실 화면 오류: {this.state.error}<button onClick={()=>location.reload()}>실험실 새로고침</button></div>:this.props.children;}
}
function RealGuildLab(){
 const[game,setGameInternal]=useState<GameState>(()=>gameSnapshot());
 const[role,setRole]=useState<Role>(()=>labRole());
 const[page,setPage]=useState<Page>('association');
 const[toast,setToast]=useState('');
 const[barVisible,setBarVisible]=useState(true);
 const[now,setNow]=useState(Date.now());
 useEffect(()=>{const un=listenLabChanges(()=>{setRole(labRole());});return un;},[]);
 useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(interval);},[]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(id);},[toast]);
 const setGame:React.Dispatch<React.SetStateAction<GameState>>=value=>setGameInternal(old=>{
  const next=typeof value==='function'?(value as (g:GameState)=>GameState)(old):value;
  setGameSnapshot(next);return next;
 });
 const changeRole=(next:Role)=>{
  updateLabRole(next);setPage('association');setGameInternal(gameSnapshot());
  setToast('실험 시점: '+(next==='LEADER'?'원정단장':next==='MEMBER'?'원정단원':'미가입')+' (서버 비연결)');
 };
 const onRecord=(record:{payload:GameState},message:string)=>{
  if(record?.payload)setGame(record.payload);
  setToast(message+' · 실험 결과');
 };
 const demoOnly=()=>setToast('실험실에서는 원정단 관련 메뉴만 실행합니다.');
 return <div className={'gl-real-shell '+(!barVisible?'is-tools-hidden':'')}>
  <div className="gl-real-controls" aria-label="원정단 실험 설정">
   {barVisible&&<><span className="gl-real-demo-label">UI 실험실</span>
    <div className="gl-real-role-buttons" role="group" aria-label="역할 선택">
     <button className={role==='LEADER'?'active':''} onClick={()=>changeRole('LEADER')}>단장</button>
     <button className={role==='MEMBER'?'active':''} onClick={()=>changeRole('MEMBER')}>단원</button>
     <button className={role==='NONE'?'active':''} onClick={()=>changeRole('NONE')}>미가입</button>
    </div>
    <button type="button" onClick={openAdventurerRanking}>모험가 랭킹</button>
    <button className="gl-real-reset" onClick={()=>{resetLab();setGameInternal(gameSnapshot());setPage('association');setToast('모의 데이터를 초기화했습니다.');}}>초기화</button></>}
   <button className="gl-real-toggle" aria-label={barVisible?'실험 도구 숨기기':'실험 도구 열기'} onClick={()=>setBarVisible(b=>!b)}>{barVisible?'▴':'실험 ▾'}</button>
  </div>
  <div className="tc-app gl-real-game">
   <GameTopBar game={game} nickname="기크" userId={LAB_USER} lease={LAB_LEASE}
    now={now} currentPage={page} unreadMail={0} unreadNotifications={0}
    onProfile={demoOnly} onShop={demoOnly} onPremium={demoOnly} onMail={demoOnly} onNotifications={demoOnly} onMenu={demoOnly}/>
   <div className="tc-statusbar"><span><i/>노바르 거점</span><span>원정단 UI 실험실 · 서버 비연결</span></div>
   <main className="tc-main">
    <Fallback key={page+':'+role}>
     {page==='association'?<AssociationScreen key={role} initialRankings={initialView==='rankings'} game={game} setGame={setGame} onlineLease={LAB_LEASE}
      onOccupation={()=>setPage('occupation')} onServerRecord={onRecord}/>:
      <VillageWarBattleScreen userId={LAB_USER} game={game} nickname="기크" lease={LAB_LEASE} onLegacy={()=>setPage('association')}/>}
    </Fallback>
   </main>
   <nav className="tc-nav" aria-label="주요 메뉴">{([['home','거점'],['shop','상점'],['inventory','가방'],['market','거래소'],['association','원정단']] as const).map(([id,label])=>
    <button type="button" key={id} aria-current={id==='association'} onClick={()=>{if(id==='association')setPage('association');else demoOnly();}}>
     <HubIcon name={id}/>{label}
    </button>
   )}</nav>
   <WorldChat userId={LAB_USER} nickname="기크" enabled={true} inlineAtHome={false}/>
   <AdventurerDirectory lease={LAB_LEASE} initiallyOpen={initialView==='adventurers'}/>
  </div>
  {page==='occupation'&&<button className="gl-real-back" onClick={()=>setPage('association')}>‹ 원정단 본부</button>}
  {toast&&<div className="gl-real-toast" role="status">{toast}</div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<RealGuildLab/>);
