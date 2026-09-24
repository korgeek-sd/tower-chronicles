import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {GameState,Tower} from './game/types';
import {TOWERS} from './game/data/config';
import {initialState} from './game/engine/state';
import {enter,requestReturn} from './game/engine/expedition';
import {basicAttack,useBattleSkill,useBattlePotion,flee,resolveMonsterTurn,resolveRevivalDecision} from './game/engine/combat';
import {settleCrafting} from './game/engine/crafting';
import {APP_VERSION,createRepository,SAVE_KEY} from './storage/repository';
import {combatFixture,type CombatFixtureName} from './game/qa/combatFixtures';
import {loadPrefs} from './components/battle/prefs';
import {registerGameTools} from './webmcp';

import {EventScreen} from './components/events/EventScreen';
import {resolveEvent,continueEvent,configureEventMode} from './game/events/service';
import {InventoryScreen} from './components/inventory/InventoryScreen';
import {BattleScreen} from './components/battle/BattleScreen';
import {MarketScreen} from './components/market/MarketScreen';
import {AssociationScreen} from './components/association/AssociationScreen';
import {JobsScreen} from './components/JobsScreen';
import {SaveManagement} from './components/SaveManagement';
import {BestiaryScreen} from './components/bestiary/BestiaryScreen';
import {EnhancementScreen} from './components/enhancement/EnhancementScreen';
import {WorkshopScreen} from './components/workshop/WorkshopScreen';
import {
  HomeScreen,TowersScreen,FloorScreen,EquipmentScreen,SkillsScreen,MasteryScreen,
  CosmeticsScreen,PremiumScreen,ExpeditionCompleteScreen,type AppPage
} from './components/mobile/CoreScreens';
import {Glyph} from './ui/mobile';
import {isGoldenRecorderActive,remainingGoldenTime} from './game/premium/goldenRecorder';
import './mobile-game.css';

configureEventMode(new URLSearchParams(location.search).get('events')==='test'?'test':'production');

const fixtureParam=import.meta.env.DEV?new URLSearchParams(location.search).get('combatFixture'):null;
const combatFixtureName=(['reactive','stack','status-ai','shield','shield-expiry'].includes(fixtureParam??'')?fixtureParam:null) as CombatFixtureName|null;
const fixtureNamespace=combatFixtureName?'tower-record-qa-'+combatFixtureName+'-'+(new URLSearchParams(location.search).get('qa')||'default')+':':'';
const gameStorage=combatFixtureName?{getItem:(key:string)=>localStorage.getItem(fixtureNamespace+key),setItem:(key:string,value:string)=>localStorage.setItem(fixtureNamespace+key,value)}:localStorage;

const nav:[AppPage,string,string][]=[
 ['home','home','거점'],['inventory','inventory','가방'],['market','market','거래소'],
 ['association','association','원정단'],['craft','craft','공방'],['equipment','equipment','장비']
];

function App(){
 const [storageError,setStorageError]=useState('');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 const blocked=useRef(false);
 const [game,setGame]=useState<GameState>(()=>{try{return combatFixtureName&&gameStorage.getItem(SAVE_KEY)===null?combatFixture(combatFixtureName)!:createRepository(gameStorage).load();}catch{blocked.current=true;return initialState();}});
 const [page,setPage]=useState<AppPage>(game.expedition||game.lastExpedition?'battle':'home');
 const [tower,setTower]=useState<Tower>('ore');
 const [floor,setFloor]=useState(1);
 const stateRef=useRef(game);stateRef.current=game;
 const wasExpedition=useRef(!!game.expedition);
 const [saved,setSaved]=useState('');

 useEffect(()=>{if(game.expedition?.pendingRevival&&page!=='battle')setPage('battle');},[page,game.expedition?.pendingRevival]);
 useEffect(()=>{if(wasExpedition.current&&!game.expedition&&game.lastExpedition)setPage('battle');wasExpedition.current=!!game.expedition;},[game.expedition,game.lastExpedition]);
 useEffect(()=>registerGameTools(
  ()=>({silver:stateRef.current.silver,materials:stateRef.current.materials,expedition:stateRef.current.expedition?{tower:stateRef.current.expedition.tower,floor:stateRef.current.expedition.floor,kills:stateRef.current.expedition.kills,loot:stateRef.current.expedition.loot}:null}),
  async()=>{if(!stateRef.current.expedition)throw Error('진행 중인 원정이 없습니다.');const next=requestReturn(stateRef.current);flushSync(()=>{setGame(next);setPage('battle');});return {status:next.expedition?'return_requested':'returned',silver:next.silver};}
 ),[]);
 useEffect(()=>{if(blocked.current){setStorageError('저장 데이터를 읽지 못해 자동 저장을 중단했습니다.');return;}try{createRepository(gameStorage).save(game);setSaved(combatFixtureName?'QA':'저장');}catch{setStorageError('저장 공간을 사용할 수 없습니다.');}},[game]);
 useEffect(()=>{const id=setInterval(()=>{if(!document.hidden)setGame(settleCrafting);},1000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(game.expedition?.phase!=='MONSTER_TURN'||game.expedition.pendingRevival)return;const id=window.setTimeout(()=>setGame(resolveMonsterTurn),Math.round(1000/Math.max(.5,loadPrefs().speed)));return()=>window.clearTimeout(id);},[game.expedition?.phase,game.expedition?.pendingRevival]);

 const exp=game.expedition,eventOpen=!!exp?.events.pendingEvent,goldenActive=isGoldenRecorderActive(game,now),immersive=page==='battle'&&!!exp,visibleNotice=game.notice.startsWith('안전 귀환 ·')?'':game.notice;
 function move(p:AppPage){if(exp?.pendingRevival)return;setPage(p==='towers'&&exp?'battle':p);}
 function acceptImportedSave(next:GameState){blocked.current=false;setStorageError('');stateRef.current=next;flushSync(()=>setGame(next));setSaved('복구');setPage(next.expedition||next.lastExpedition?'battle':'home');}
 function commitEvent(action:(state:GameState)=>GameState){if(blocked.current)throw Error('저장 차단');const current=stateRef.current,next=action(current);if(next===current)return;createRepository(gameStorage).save(next);stateRef.current=next;flushSync(()=>setGame(next));}
 const shellClass=immersive?(eventOpen?'tc-app tc-event-mode':'tc-app tc-battle-mode'):'tc-app';

 return <div className={shellClass}>
  {!immersive&&<><header className="tc-topbar">
   <button className="tc-brand" onClick={()=>move('home')}><span className="tc-brand-mark"><i>T</i></span><span><b>탑의 기록</b><small>TOWER CHRONICLES</small></span></button>
   <div className="tc-wallet"><span className="tc-coin"><i/><b>{game.silver.toLocaleString()}</b><small>Silver</small></span><span className="tc-coin gold"><i/><b>{game.market.gold.toLocaleString()}</b><small>Gold</small></span></div>
   <button className="tc-premium" onClick={()=>move('premium')}><b>황금기록자</b><small>{goldenActive?remainingGoldenTime(game.goldenRecorder.expiresAt,now):'미등록'}</small></button>
  </header><div className="tc-statusbar"><span><i className={exp?'live':''}/>{exp?TOWERS[exp.tower].name+' '+exp.floor+'F 원정 중':'NOVAR 거점'}</span><span>v{APP_VERSION} · {saved}</span></div></>}
  <main className="tc-main">
   {storageError&&<div className="error" role="alert">{storageError}</div>}
   {page==='home'&&<HomeScreen game={game} onMove={move}/>}
   {page==='towers'&&<TowersScreen game={game} onSelect={t=>{setTower(t);setFloor(1);setPage('floor');}}/>}
   {page==='floor'&&<FloorScreen game={game} setGame={setGame} tower={tower} floor={floor} setFloor={setFloor} now={now} onBack={()=>setPage('towers')} onEnter={()=>{const next=enter(game,tower,floor);setGame(next);if(next.expedition)setPage('battle');}}/>}
   {page==='battle'&&(exp?(eventOpen?<EventScreen key={exp.events.pendingEvent!.instanceId+exp.events.pendingEvent!.state} game={game} onHome={()=>setPage('home')} onChoice={(instance,choice)=>commitEvent(s=>resolveEvent(s,instance,choice))} onContinue={instance=>commitEvent(s=>continueEvent(s,instance))} onRevival={use=>setGame(s=>resolveRevivalDecision(s,use))}/>:<BattleScreen game={game} onHome={()=>setPage('home')} onBasicAttack={()=>setGame(basicAttack)} onSkill={id=>setGame(s=>useBattleSkill(s,id))} onPotion={p=>setGame(s=>useBattlePotion(s,p))} onFlee={()=>setGame(flee)} onRevival={use=>setGame(s=>resolveRevivalDecision(s,use))}/>):<ExpeditionCompleteScreen game={game} onInventory={()=>setPage('inventory')} onTowers={()=>setPage('towers')}/>)}
   {page==='inventory'&&<InventoryScreen game={game} setGame={setGame}/>}
   {page==='equipment'&&<EquipmentScreen game={game} setGame={setGame} onSkills={()=>setPage('skills')}/>}
   {page==='skills'&&<SkillsScreen game={game} setGame={setGame}/>}
   {page==='craft'&&<WorkshopScreen game={game} setGame={setGame} now={now} onEnhancement={()=>setPage('enhancement')} onMastery={()=>setPage('mastery')}/>}
   {page==='enhancement'&&<EnhancementScreen game={game} setGame={setGame} onBack={()=>setPage('craft')}/>}
   {page==='mastery'&&<MasteryScreen game={game}/>}
   {page==='market'&&<MarketScreen game={game} setGame={setGame}/>}
   {page==='association'&&<AssociationScreen game={game} setGame={setGame}/>}
   {page==='jobs'&&<JobsScreen game={game} setGame={setGame}/>}
   {page==='bestiary'&&<BestiaryScreen game={game} onBack={()=>setPage('home')}/>}
   {page==='settings'&&<SaveManagement game={game} storage={gameStorage} onImported={acceptImportedSave}/>}
   {page==='cosmetics'&&<CosmeticsScreen game={game} setGame={setGame}/>}
   {page==='premium'&&<PremiumScreen game={game} setGame={setGame} now={now}/>}
   {!immersive&&page!=='battle'&&visibleNotice&&<div className="notice" role="status">{visibleNotice}</div>}
  </main>
  {!immersive&&<nav className="tc-nav" aria-label="주요 메뉴">{nav.map(([p,g,label])=><button key={p} aria-current={page===p||(p==='craft'&&(page==='mastery'||page==='enhancement'))||(p==='equipment'&&page==='skills')||(p==='home'&&['settings','jobs','bestiary','cosmetics','premium'].includes(page))} onClick={()=>move(p)}><Glyph name={g}/>{label}</button>)}</nav>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);