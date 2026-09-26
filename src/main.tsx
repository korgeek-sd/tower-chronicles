import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {GameState,Tower} from './game/types';
import {TOWERS} from './game/data/config';
import {initialState} from './game/engine/state';
import {enter,requestReturn,abandonStrongholdAndReturn} from './game/engine/expedition';
import {basicAttack,useBattleSkill,useBattlePotion,flee,resolveMonsterTurn,resolveRevivalDecision} from './game/engine/combat';
import {settleCrafting} from './game/engine/crafting';
import {APP_VERSION,createRepository,SAVE_KEY} from './storage/repository';
import {combatFixture,type CombatFixtureName} from './game/qa/combatFixtures';
import {loadPrefs} from './components/battle/prefs';
import {registerGameTools} from './webmcp';
import {consumeOAuthRedirect,getStoredSession,signOutOnline,type OnlineSession} from './online/auth';
import {onlineConfigured} from './online/config';
import {reconcileCloudState,type CloudSyncStatus} from './online/cloudSync';
import {stableStringify,loadCloudSave,CloudSessionLostError} from './online/cloudSave';
import {acquireGameSession,forceTakeoverGameSession,heartbeatGameSession,inspectGameSession,releaseGameSession,requestGameSessionTakeover,subscribeGameSessionSignals,GAME_SESSION_HEARTBEAT_MS,GAME_SESSION_TAKEOVER_GRACE_MS,type GameplayLease,type GameSessionPhase,type GameSessionResult,type GameSessionSignal,GameSessionLostError} from './online/gameSession';
import {startOnlineExpedition,settleOnlineExpedition} from './online/economy';

import {EventScreen} from './components/events/EventScreen';
import {resolveEvent,continueEvent,configureEventMode,expireTimedEventChoice} from './game/events/service';
import {settleStronghold} from './game/events/resourceStronghold';
import {InventoryScreen} from './components/inventory/InventoryScreen';
import {BattleScreen} from './components/battle/BattleScreen';
import {MarketScreen} from './components/market/MarketScreen';
import {AssociationScreen} from './components/association/AssociationScreen';
import {JobsScreen} from './components/JobsScreen';
import {SaveManagement} from './components/SaveManagement';
import {GameSessionGate} from './components/GameSessionGate';
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
 const [onlineSession,setOnlineSession]=useState<OnlineSession|null>(()=>getStoredSession());
 const [cloudSyncStatus,setCloudSyncStatus]=useState<CloudSyncStatus>(onlineSession?'syncing':'local');
 const [cloudRevision,setCloudRevision]=useState<number|null>(null);
 const [cloudSyncMessage,setCloudSyncMessage]=useState(onlineSession?'클라우드 상태 확인 중':'게스트 저장');
 const cloudTimer=useRef<number|null>(null),cloudBusy=useRef(false),cloudQueued=useRef(false),lastPersistedGame=useRef('');
 const serverEconomyBusy=useRef(false),settledReceiptKey=useRef('');
 const initialGate:GameSessionPhase=onlineSession?'acquiring':'guest';
 const [gameSessionPhase,setGameSessionPhase]=useState<GameSessionPhase>(initialGate);
 const [gameplayLease,setGameplayLease]=useState<GameplayLease|null>(null);
 const [gameSessionPlatform,setGameSessionPlatform]=useState<string|null>(null);
 const [gameSessionHeartbeat,setGameSessionHeartbeat]=useState<string|null>(null);
 const [gameSessionMessage,setGameSessionMessage]=useState(onlineSession?'계정의 플레이 권한을 확인하고 있습니다.':'');
 const gameplayLeaseRef=useRef<GameplayLease|null>(null),gameSessionPhaseRef=useRef<GameSessionPhase>(initialGate),handoffBusy=useRef(false),takeoverTimer=useRef<number|null>(null);
 gameplayLeaseRef.current=gameplayLease;gameSessionPhaseRef.current=gameSessionPhase;
 const gameplayWritable=!onlineSession||gameSessionPhase==='active';
 useEffect(()=>{const before=getStoredSession();const session=consumeOAuthRedirect();setOnlineSession(session);if(session&&!before)setGame(s=>({...s,notice:'Google 로그인 완료 · 진행 상황이 자동으로 동기화됩니다.'}));},[]);

 useEffect(()=>{if(game.expedition?.pendingRevival&&page!=='battle')setPage('battle');},[page,game.expedition?.pendingRevival]);
 useEffect(()=>{if(wasExpedition.current&&!game.expedition&&game.lastExpedition)setPage('battle');wasExpedition.current=!!game.expedition;},[game.expedition,game.lastExpedition]);
 useEffect(()=>{
  const lease=gameplayLeaseRef.current,receipt=game.lastExpedition;
  if(!onlineSession||gameSessionPhase!=='active'||!lease||game.expedition||!receipt)return;
  const key=[receipt.outcome,receipt.tower,receipt.floor,receipt.time,receipt.kills,receipt.loot.silver].join(':');
  if(settledReceiptKey.current===key)return;
  settledReceiptKey.current=key;
  serverEconomyBusy.current=true;
  if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}
  void (async()=>{
   try{
    const record=await settleOnlineExpedition(lease,stateRef.current);
    createRepository(gameStorage).save(record.payload);
    stateRef.current=record.payload;
    flushSync(()=>setGame(record.payload));
    setCloudRevision(record.revision);setSaved('서버 정산');setCloudSyncStatus('synced');setCloudSyncMessage('원정 보상을 서버에서 정산했습니다.');
   }catch(error){
    settledReceiptKey.current='';
    setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'원정 서버 정산에 실패했습니다.');
    await applyLatestCloud();
   }finally{serverEconomyBusy.current=false;}
  })();
 },[game.expedition,game.lastExpedition,onlineSession?.userId,gameSessionPhase,gameplayLease?.generation]);
 useEffect(()=>registerGameTools(
  ()=>({silver:stateRef.current.silver,materials:stateRef.current.materials,expedition:stateRef.current.expedition?{tower:stateRef.current.expedition.tower,floor:stateRef.current.expedition.floor,kills:stateRef.current.expedition.kills,loot:stateRef.current.expedition.loot}:null}),
  async()=>{if(getStoredSession()&&gameSessionPhaseRef.current!=='active')throw Error('다른 기기에서 플레이 중입니다.');if(!stateRef.current.expedition)throw Error('진행 중인 원정이 없습니다.');const next=requestReturn(stateRef.current);flushSync(()=>{setGame(next);setPage('battle');});return {status:next.expedition?'return_requested':'returned',silver:next.silver};}
 ),[]);
 useEffect(()=>{
  if(blocked.current){setStorageError('저장 데이터를 읽지 못해 자동 저장을 중단했습니다.');return;}
  const snapshot=stableStringify(game);
  if(lastPersistedGame.current===snapshot)return;
  lastPersistedGame.current=snapshot;
  try{createRepository(gameStorage).save(game);setSaved(combatFixtureName?'QA':onlineSession?'동기화 대기':'저장');}catch{setStorageError('저장 공간을 사용할 수 없습니다.');return;}
  if(!combatFixtureName&&onlineConfigured&&onlineSession&&gameSessionPhase==='active'&&gameplayLease&&!serverEconomyBusy.current){
   if(cloudTimer.current!==null)window.clearTimeout(cloudTimer.current);
   cloudTimer.current=window.setTimeout(()=>{cloudTimer.current=null;void runCloudSync();},750);
  }
  return()=>{if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}};
 },[game,onlineSession?.userId,gameSessionPhase,gameplayLease?.generation]);
 useEffect(()=>{
  if(!onlineSession){gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('guest');setGameSessionPlatform(null);setGameSessionHeartbeat(null);return;}
  let cancelled=false;
  void (async()=>{setGameSessionPhase('acquiring');setGameSessionMessage('계정의 플레이 권한을 확인하고 있습니다.');try{const result=await acquireGameSession();if(!cancelled)applyGameSessionResult(result);}catch(error){if(!cancelled){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'플레이 세션을 확인하지 못했습니다.');}}})();
  return()=>{cancelled=true;};
 },[onlineSession?.userId]);

 useEffect(()=>{
  if(!onlineSession)return;
  const unsubscribe=subscribeGameSessionSignals(signal=>void handleGameSessionSignal(signal));
  return unsubscribe;
 },[onlineSession?.userId]);

 useEffect(()=>{
  if(gameSessionPhase!=='active'||!gameplayLease)return;
  let disposed=false;
  const beat=async()=>{try{const status=await heartbeatGameSession(gameplayLease);if(disposed)return;setGameplayLease(current=>current?{...current,expiresAt:status.expiresAt}:current);if(status.takeoverRequestedAt)void gracefulHandoff();}catch(error){if(!disposed&&(error instanceof GameSessionLostError||error instanceof Error))void loseGameplaySession(error instanceof Error?error.message:'플레이 권한을 잃었습니다.');}};
  const id=window.setInterval(()=>void beat(),GAME_SESSION_HEARTBEAT_MS);
  const resume=()=>{if(!document.hidden)void beat();};
  const online=()=>void beat();
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',online);
  return()=>{disposed=true;window.clearInterval(id);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',online);};
 },[gameSessionPhase,gameplayLease?.leaseId,gameplayLease?.generation]);

 useEffect(()=>{
  if(combatFixtureName||!onlineConfigured||!onlineSession||gameSessionPhase!=='active'||!gameplayLease){if(!onlineSession){setCloudSyncStatus('local');setCloudRevision(null);setCloudSyncMessage('게스트 저장');}return;}
  void runCloudSync();
  const resume=()=>{if(!document.hidden)void runCloudSync();};
  const online=()=>void runCloudSync();
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('online',online);
  return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',online);};
 },[onlineSession?.userId,gameSessionPhase,gameplayLease?.generation]);
 useEffect(()=>{const settle=()=>{if(document.hidden)return;const tick=Date.now();setNow(tick);if(!gameplayWritable)return;setGame(state=>{const activeCraft=state.crafting.jobs.find(job=>job.status==='CRAFTING'),queuedCraft=state.crafting.jobs.some(job=>job.status==='QUEUED'),craftDue=(!activeCraft&&queuedCraft)||(activeCraft?.completesAt!==null&&activeCraft?.completesAt!==undefined&&tick>=activeCraft.completesAt);const crafted=craftDue?settleCrafting(state,tick):state;return expireTimedEventChoice(settleStronghold(crafted,tick),tick);});};const id=setInterval(settle,1000);document.addEventListener('visibilitychange',settle);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',settle);};},[]);
 useEffect(()=>{if(!gameplayWritable||game.expedition?.phase!=='MONSTER_TURN'||game.expedition.pendingRevival)return;const id=window.setTimeout(()=>setGame(resolveMonsterTurn),Math.round(1000/Math.max(.5,loadPrefs().speed)));return()=>window.clearTimeout(id);},[gameplayWritable,game.expedition?.phase,game.expedition?.pendingRevival]);

 const exp=game.expedition,eventOpen=!!exp?.events.pendingEvent,goldenActive=isGoldenRecorderActive(game,now),immersive=page==='battle'&&!!exp,visibleNotice=game.notice.startsWith('안전 귀환 ·')?'':game.notice;
 function move(p:AppPage){if(exp?.pendingRevival)return;setPage(p==='towers'&&exp?'battle':p);}
 function acceptImportedSave(next:GameState){if(onlineSession&&gameSessionPhaseRef.current!=='active')return;blocked.current=false;setStorageError('');stateRef.current=next;flushSync(()=>setGame(next));setSaved('복구');setPage(next.expedition||next.lastExpedition?'battle':'home');}
 function commitEvent(action:(state:GameState)=>GameState){if(blocked.current)throw Error('저장 차단');if(getStoredSession()&&gameSessionPhaseRef.current!=='active')throw Error('다른 기기에서 플레이 중입니다.');const current=stateRef.current,next=action(current);if(next===current)return;createRepository(gameStorage).save(next);stateRef.current=next;flushSync(()=>setGame(next));}
 function activateGameplay(result:GameSessionResult){if(result.status!=='ACTIVE'||!result.lease)return;gameplayLeaseRef.current=result.lease;setGameplayLease(result.lease);setGameSessionPlatform(result.activePlatform);setGameSessionHeartbeat(result.heartbeatAt);setGameSessionPhase('active');setGameSessionMessage('이 기기에서 플레이 중입니다.');}
 function applyGameSessionResult(result:GameSessionResult){setGameSessionPlatform(result.activePlatform);setGameSessionHeartbeat(result.heartbeatAt);if(result.status==='ACTIVE'){activateGameplay(result);return;}gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase(result.status==='PENDING'?'taking-over':'locked');setGameSessionMessage(result.status==='PENDING'?'기존 기기에 마지막 저장을 요청했습니다.':'같은 Google 계정이 다른 기기에서 플레이 중입니다.');}
 async function retryGameSession(){setGameSessionPhase('acquiring');setGameSessionMessage('계정의 플레이 권한을 다시 확인하고 있습니다.');try{applyGameSessionResult(await acquireGameSession());}catch(error){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'플레이 세션을 확인하지 못했습니다.');}}
 async function applyLatestCloud(){try{const remote=await loadCloudSave();if(remote){createRepository(gameStorage).save(remote.payload);stateRef.current=remote.payload;flushSync(()=>setGame(remote.payload));setCloudRevision(remote.revision);setSaved('클라우드');}}catch{}}
 async function loseGameplaySession(message:string){if(gameSessionPhaseRef.current==='locked'&&!gameplayLeaseRef.current)return;if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('locked');setGameSessionMessage(message);setCloudSyncStatus('synced');setCloudSyncMessage('다른 기기의 플레이 세션이 활성화되었습니다.');await applyLatestCloud();}
 async function gracefulHandoff(){const lease=gameplayLeaseRef.current;if(!lease||handoffBusy.current)return;handoffBusy.current=true;setGameSessionPhase('handoff');setGameSessionMessage('현재 진행 상황을 저장한 뒤 다른 기기로 플레이를 넘기고 있습니다.');try{const result=await reconcileCloudState(stateRef.current,lease);if(result.action==='pulled'){createRepository(gameStorage).save(result.state);stateRef.current=result.state;flushSync(()=>setGame(result.state));}if(result.record)setCloudRevision(result.record.revision);await releaseGameSession(lease);}catch(error){if(!(error instanceof CloudSessionLostError)&&!(error instanceof GameSessionLostError))setCloudSyncMessage(error instanceof Error?error.message:'마지막 저장을 확인하지 못했습니다.');}finally{gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('locked');setGameSessionMessage('다른 기기에서 플레이가 시작되었습니다. 이 기기에서는 진행할 수 없습니다.');handoffBusy.current=false;}}
 async function handleGameSessionSignal(signal:GameSessionSignal){setGameSessionPlatform(signal.platform);setGameSessionHeartbeat(signal.heartbeatAt);const phase=gameSessionPhaseRef.current,lease=gameplayLeaseRef.current;if(phase==='active'&&lease){if(signal.generation!==lease.generation||(signal.expiresAt&&new Date(signal.expiresAt).getTime()<=Date.now())){await loseGameplaySession('다른 기기에서 플레이가 시작되었습니다.');return;}if(signal.takeoverRequestedAt){await gracefulHandoff();return;}}if(phase==='taking-over'&&signal.expiresAt&&new Date(signal.expiresAt).getTime()<=Date.now()){if(takeoverTimer.current!==null){window.clearTimeout(takeoverTimer.current);takeoverTimer.current=null;}await retryGameSession();}}
 async function takeOverHere(){if(takeoverTimer.current!==null)window.clearTimeout(takeoverTimer.current);setGameSessionPhase('taking-over');setGameSessionMessage('기존 기기에 마지막 저장을 요청하고 있습니다.');try{const result=await requestGameSessionTakeover();applyGameSessionResult(result);if(result.status==='ACTIVE')return;takeoverTimer.current=window.setTimeout(()=>{takeoverTimer.current=null;void (async()=>{try{activateGameplay(await forceTakeoverGameSession());}catch{await retryGameSession();}})();},GAME_SESSION_TAKEOVER_GRACE_MS+400);}catch(error){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'기기 전환을 시작하지 못했습니다.');}}
 async function runCloudSync(){
  const lease=gameplayLeaseRef.current;
  if(combatFixtureName||!onlineConfigured||!getStoredSession()||gameSessionPhaseRef.current!=='active'||!lease)return;
  if(cloudBusy.current){cloudQueued.current=true;return;}
  cloudBusy.current=true;setCloudSyncStatus('syncing');
  try{
   const result=await reconcileCloudState(stateRef.current,lease);
   if(result.action==='signed-out'){setOnlineSession(null);setCloudSyncStatus('local');setCloudRevision(null);setCloudSyncMessage('게스트 저장');return;}
   if(result.action==='pulled'){
    createRepository(gameStorage).save(result.state);
    stateRef.current=result.state;
    flushSync(()=>setGame(result.state));
    setSaved('클라우드');
   }else if(result.action==='pushed')setSaved('클라우드');
   if(result.record)setCloudRevision(result.record.revision);
   setCloudSyncStatus('synced');
   setCloudSyncMessage(result.action==='pulled'?'다른 기기의 최신 진행 상황을 적용했습니다.':result.action==='pushed'?'클라우드에 자동 저장했습니다.':'클라우드와 동기화됨');
  }catch(error){
   if(error instanceof CloudSessionLostError){await loseGameplaySession(error.message);return;}
   setCloudSyncStatus('error');
   setCloudSyncMessage(error instanceof Error?error.message:'클라우드 자동 동기화에 실패했습니다.');
  }finally{
   cloudBusy.current=false;
   if(cloudQueued.current&&gameSessionPhaseRef.current==='active'){cloudQueued.current=false;void runCloudSync();}else cloudQueued.current=false;
  }
 }
 async function logoutOnline(){if(takeoverTimer.current!==null){window.clearTimeout(takeoverTimer.current);takeoverTimer.current=null;}const lease=gameplayLeaseRef.current;if(lease)try{await releaseGameSession(lease);}catch{}gameplayLeaseRef.current=null;setGameplayLease(null);await signOutOnline();setOnlineSession(null);setGameSessionPhase('guest');setCloudSyncStatus('local');setCloudRevision(null);setCloudSyncMessage('게스트 저장');setSaved('저장');}
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
   {page==='floor'&&<FloorScreen game={game} setGame={setGame} tower={tower} floor={floor} setFloor={setFloor} now={now} onBack={()=>setPage('towers')} onEnter={()=>{void (async()=>{const current=stateRef.current,next=enter(current,tower,floor);if(!next.expedition){setGame(next);return;}const lease=gameplayLeaseRef.current;if(onlineSession&&gameSessionPhaseRef.current==='active'&&lease){try{const record=await startOnlineExpedition(lease,tower,floor,next);createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;setCloudRevision(record.revision);setCloudSyncStatus('synced');setCloudSyncMessage('입장권과 원정 시작을 서버에 기록했습니다.');setGame(record.payload);setPage('battle');}catch(error){setGame({...current,notice:error instanceof Error?error.message:'서버 원정을 시작하지 못했습니다.'});}}else{setGame(next);setPage('battle');}})();}}/>}
   {page==='battle'&&(exp?(eventOpen?<EventScreen key={exp.events.pendingEvent!.instanceId+exp.events.pendingEvent!.state} game={game} now={now} onHome={()=>setPage('home')} onChoice={(instance,choice)=>commitEvent(s=>resolveEvent(s,instance,choice))} onContinue={instance=>commitEvent(s=>continueEvent(s,instance))} onRevival={use=>setGame(s=>resolveRevivalDecision(s,use))}/>:<BattleScreen game={game} now={now} onHome={()=>setPage('home')} onBasicAttack={()=>setGame(basicAttack)} onSkill={id=>setGame(s=>useBattleSkill(s,id))} onPotion={p=>setGame(s=>useBattlePotion(s,p))} onFlee={()=>setGame(flee)} onRevival={use=>setGame(s=>resolveRevivalDecision(s,use))} onAbandonStronghold={()=>setGame(s=>abandonStrongholdAndReturn(s))}/>):<ExpeditionCompleteScreen game={game} onInventory={()=>setPage('inventory')} onTowers={()=>setPage('towers')}/>)}
   {page==='inventory'&&<InventoryScreen game={game} setGame={setGame}/>}
   {page==='equipment'&&<EquipmentScreen game={game} setGame={setGame} onSkills={()=>setPage('skills')}/>}
   {page==='skills'&&<SkillsScreen game={game} setGame={setGame}/>}
   {page==='craft'&&<WorkshopScreen game={game} setGame={setGame} now={now} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} onEnhancement={()=>setPage('enhancement')} onMastery={()=>setPage('mastery')}/>}
   {page==='enhancement'&&<EnhancementScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} onBack={()=>setPage('craft')}/>}
   {page==='mastery'&&<MasteryScreen game={game}/>}
   {page==='market'&&<MarketScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}/>}
   {page==='association'&&<AssociationScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}/>}
   {page==='jobs'&&<JobsScreen game={game} setGame={setGame}/>}
   {page==='bestiary'&&<BestiaryScreen game={game} onBack={()=>setPage('home')}/>}
   {page==='settings'&&<SaveManagement game={game} storage={gameStorage} onImported={acceptImportedSave} session={onlineSession} syncStatus={cloudSyncStatus} syncRevision={cloudRevision} syncMessage={cloudSyncMessage} onLogout={logoutOnline}/>} 
   {page==='cosmetics'&&<CosmeticsScreen game={game} setGame={setGame}/>}
   {page==='premium'&&<PremiumScreen game={game} setGame={setGame} now={now}/>}
   {!immersive&&page!=='battle'&&visibleNotice&&<div className="tc-notice-backdrop" role="presentation" onClick={()=>setGame(state=>({...state,notice:''}))}><section className="tc-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-notice-title" onClick={event=>event.stopPropagation()}><button className="tc-notice-close" aria-label="알림 닫기" onClick={()=>setGame(state=>({...state,notice:''}))}>×</button><small>NOTICE</small><h2 id="tc-notice-title">알림</h2><p>{visibleNotice}</p><button className="tc-notice-confirm" onClick={()=>setGame(state=>({...state,notice:''}))}>확인</button></section></div>}
  </main>
  {!immersive&&<nav className="tc-nav" aria-label="주요 메뉴">{nav.map(([p,g,label])=><button key={p} aria-current={page===p||(p==='craft'&&(page==='mastery'||page==='enhancement'))||(p==='equipment'&&page==='skills')||(p==='home'&&['settings','jobs','bestiary','cosmetics','premium'].includes(page))} onClick={()=>move(p)}><Glyph name={g}/>{label}{p==='market'&&(game.market.storage?.length??0)>0&&<b className="tc-nav-badge">{game.market.storage!.length}</b>}</button>)}</nav>}
  <GameSessionGate phase={gameSessionPhase} activePlatform={gameSessionPlatform} heartbeatAt={gameSessionHeartbeat} message={gameSessionMessage} onTakeover={()=>void takeOverHere()} onRetry={()=>void retryGameSession()} onLogout={()=>void logoutOnline()}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);