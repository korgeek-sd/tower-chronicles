import {SkillBooksPage} from './components/skills/SkillBooksPage';
import {SKILL_TREE_CATALOG} from './game/skills/catalog';
import {StatAllocationPage} from './components/stats/StatAllocationPage';
import './components/world/world-map.css';
import {WorldPage} from './components/world/WorldPage';
import {isHuntingLeaseCurrent} from './online/huntingLease';
import {HuntingPage} from './components/hunting/HuntingPage';
import {MailDialog} from './components/MailDialog';
import {loadGameMail} from './online/mail';
import {SaveManagement} from './components/SaveManagement';
import React,{useEffect,useRef,useState} from 'react';
import {WorldChat} from './components/WorldChat';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import type {GameState,Tower} from './game/types';
import {TOWERS} from './game/data/config';
import {initialState} from './game/engine/state';

import {enter,requestReturn,abandonStrongholdAndReturn} from './game/engine/expedition';
import {basicAttack,useBattleSkill,useBattlePotion,flee,resolveMonsterTurn,resolveRevivalDecision} from './game/engine/combat';
import {APP_VERSION,createRepository,SAVE_KEY} from './storage/repository';
import {combatFixture,type CombatFixtureName} from './game/qa/combatFixtures';
import {playerRecoveryDelay} from './components/battle/battleVfxTimeline';
import {NicknameGate} from './components/NicknameGate';
import {loadPlayerProfile,registerPlayerNickname,type PlayerProfile} from './online/playerProfiles';
import {loadPrefs} from './components/battle/prefs';
import {registerGameTools} from './webmcp';
import {consumeOAuthRedirect,getStoredSession,signOutOnline,type OnlineSession} from './online/auth';
import {onlineConfigured} from './online/config';
import {reconcileCloudState,type CloudSyncStatus} from './online/cloudSync';
import {stableStringify,loadCloudSave,rememberCloudRecord,CloudSessionLostError} from './online/cloudSave';
import {acquireGameSession,forceTakeoverGameSession,heartbeatGameSession,inspectGameSession,releaseGameSession,requestGameSessionTakeover,subscribeGameSessionSignals,GAME_SESSION_HEARTBEAT_MS,GAME_SESSION_TAKEOVER_GRACE_MS,type GameplayLease,type GameSessionPhase,type GameSessionResult,type GameSessionSignal,GameSessionLostError} from './online/gameSession';
import {applyOnlineBasicAttack,applyOnlineSkill,applyOnlineJobSkill,applyOnlinePotion,applyOnlineFlee,resolveOnlineRevival,beginOnlineCombatState,reconcileOnlineCombatState,startOnlineExpedition,settleOnlineExpedition,restoreOnlineExpedition,reconcileOnlineExpeditionState,advanceOnlineExploration,resolveOnlineExplorationEvent,settleOnlineResourceStronghold,abandonOnlineResourceStronghold,selectOnlineJob,type OnlineCombatState} from './online/economy';
import {getResourceStrongholdState,advanceResourceStrongholdState,requestResourceStronghold,respondResourceStrongholdContest,applyResourceStrongholdContestAction,abandonResourceStronghold,subscribeResourceStrongholdRealtime,type ResourceStrongholdServerState} from './online/resourceStronghold';

import {EventScreen} from './components/events/EventScreen';
import {ResourceStrongholdPanel} from './components/events/ResourceStrongholdPanel';
import {resolveEvent,continueEvent,configureEventMode,expireTimedEventChoice} from './game/events/service';
import {settleStronghold} from './game/events/resourceStronghold';
import {InventoryScreen} from './components/inventory/InventoryScreen';
import {BattleScreen} from './components/battle/BattleScreen';
import {MarketScreen} from './components/market/MarketScreen';
import type {MarketIntent} from './components/market/marketNavigation';
import {GoldExchangeScreen} from './components/market/GoldExchangeScreen';
import {SealScreen} from './components/seal/SealScreen';
import {AssociationScreen} from './components/association/AssociationScreen';
import {OccupationScreen} from './components/occupation/OccupationScreen';
import {JobsScreen,type JobTab} from './components/JobsScreen';
import {SettingsDialog} from './components/SettingsDialog';
import {applySettings} from './settings/preferences';
applySettings();
import {GameSessionGate} from './components/GameSessionGate';
import {BestiaryScreen} from './components/bestiary/BestiaryScreen';

import {
  HomeScreen,TowersScreen,FloorScreen,SkillsScreen,
  CosmeticsScreen,ShopScreen,type AppPage
} from './components/mobile/CoreScreens';
import {Glyph} from './ui/mobile';
import './mobile-game.css';
import './gameFeel/game-feel.css';
import {GameFeelProvider} from './gameFeel/react/GameFeelProvider';

configureEventMode(new URLSearchParams(location.search).get('events')==='test'?'test':'production');

const fixtureParam=import.meta.env.DEV?new URLSearchParams(location.search).get('combatFixture'):null;
const combatFixtureName=(['reactive','stack','status-ai','shield','shield-expiry'].includes(fixtureParam??'')?fixtureParam:null) as CombatFixtureName|null;
const fixtureNamespace=combatFixtureName?'tower-record-qa-'+combatFixtureName+'-'+(new URLSearchParams(location.search).get('qa')||'default')+':':'';
const gameStorage=combatFixtureName?{getItem:(key:string)=>localStorage.getItem(fixtureNamespace+key),setItem:(key:string,value:string)=>localStorage.setItem(fixtureNamespace+key,value)}:localStorage;

const nav:[AppPage,string,string][]=[
 ['home','home','거점'],['hunt','sword','전투'],['inventory','inventory','가방'],['market','market','거래소'],
 ['association','association','원정단']
];

function App(){
 const [storageError,setStorageError]=useState('');
 const [now,setNow]=useState(()=>Date.now());
 const [strongholdPvp,setStrongholdPvp]=useState<ResourceStrongholdServerState|null>(null);
 const [strongholdPvpBusy,setStrongholdPvpBusy]=useState(false);
 const [strongholdPvpError,setStrongholdPvpError]=useState('');
 const [strongholdPanelOpen,setStrongholdPanelOpen]=useState(false);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 const blocked=useRef(false);
 const [game,setGame]=useState<GameState>(()=>{try{return combatFixtureName&&gameStorage.getItem(SAVE_KEY)===null?combatFixture(combatFixtureName)!:createRepository(gameStorage).load();}catch{blocked.current=true;return initialState();}});
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [mailOpen,setMailOpen]=useState(false),[mailUnread,setMailUnread]=useState(0);
 const [page,setPage]=useState<AppPage>(game.expedition?'battle':'home');
 useEffect(()=>{if(page==='battle'&&!game.expedition)setPage('towers');},[page,game.expedition]);
 const [jobsEntryTab,setJobsEntryTab]=useState<JobTab>('register');
 const [marketIntent,setMarketIntent]=useState<MarketIntent|null>(null);
 const [inventoryReturnKey,setInventoryReturnKey]=useState<string|null>(null);
 const [enhancementInitialId,setEnhancementInitialId]=useState<string|null>(null);
 const [enhancementReturnKey,setEnhancementReturnKey]=useState<string|null>(null);
 const [tower,setTower]=useState<Tower>('ore');
 const [floor,setFloor]=useState(1);
 const stateRef=useRef(game);stateRef.current=game;
 const wasExpedition=useRef(!!game.expedition);
 const [saved,setSaved]=useState('');
 const [onlineSession,setOnlineSession]=useState<OnlineSession|null>(()=>getStoredSession());
 const [profileState,setProfileState]=useState<{userId:string;status:'loading'|'missing'|'ready'|'error';profile:PlayerProfile|null;error:string}>({userId:'',status:'loading',profile:null,error:''});
 const [profileRetry,setProfileRetry]=useState(0);
 const profileReady=!onlineSession||(profileState.userId===onlineSession.userId&&profileState.status==='ready');
 const playerNickname=profileState.userId===onlineSession?.userId?profileState.profile?.nickname:undefined;
 const [cloudSyncStatus,setCloudSyncStatus]=useState<CloudSyncStatus>(onlineSession?'syncing':'local');
 const [cloudRevision,setCloudRevision]=useState<number|null>(null);
 const [cloudSyncMessage,setCloudSyncMessage]=useState(onlineSession?'클라우드 상태 확인 중':'게스트 저장');
 const cloudTimer=useRef<number|null>(null),cloudBusy=useRef(false),cloudQueued=useRef(false),lastPersistedGame=useRef('');
 const huntingBusyOwner=useRef<string|null>(null);
 const serverEconomyBusy=useRef(false),settledReceiptKey=useRef(''),confirmedKillCount=useRef(0),onlineRunVersion=useRef(0),recordingAction=useRef(false),onlineCombatNonce=useRef(0),eventTimeoutHandled=useRef(''),saveRecoveryBusy=useRef(false);
 const initialGate:GameSessionPhase=onlineSession?'acquiring':'guest';
 const [gameSessionPhase,setGameSessionPhase]=useState<GameSessionPhase>(initialGate);
 const [gameplayLease,setGameplayLease]=useState<GameplayLease|null>(null);
 const [gameSessionPlatform,setGameSessionPlatform]=useState<string|null>(null);
 const [gameSessionHeartbeat,setGameSessionHeartbeat]=useState<string|null>(null);
 const [gameSessionMessage,setGameSessionMessage]=useState(onlineSession?'계정의 플레이 권한을 확인하고 있습니다.':'');
 const gameplayLeaseRef=useRef<GameplayLease|null>(null),gameSessionPhaseRef=useRef<GameSessionPhase>(initialGate),handoffBusy=useRef(false),takeoverTimer=useRef<number|null>(null);
 gameplayLeaseRef.current=gameplayLease;gameSessionPhaseRef.current=gameSessionPhase;
 const gameplayWritable=profileReady&&(!onlineSession||gameSessionPhase==='active');
 useEffect(()=>{setMailOpen(false);setMailUnread(0);},[onlineSession?.userId]);
 useEffect(()=>{
  if(!onlineSession||gameSessionPhase!=='active')return;
  let active=true,busy=false;const userId=onlineSession.userId;
  const refresh=async()=>{if(busy||document.hidden)return;busy=true;try{const r=await loadGameMail(userId);if(active&&getStoredSession()?.userId===userId)setMailUnread(r.mails.filter(m=>!m.read||!!m.attachment&&!m.claimed).length);}catch{}finally{busy=false;}};
  void refresh();const id=setInterval(()=>void refresh(),60000);window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(id);window.removeEventListener('focus',refresh);};
 },[onlineSession?.userId,gameSessionPhase]);
 async function refreshStrongholdPvp(){
  const lease=gameplayLeaseRef.current,e=stateRef.current.expedition;
  if(!lease||gameSessionPhaseRef.current!=='active'||!e){setStrongholdPvp(null);return;}
  setStrongholdPvpBusy(true);
  try{setStrongholdPvp(await getResourceStrongholdState(lease,e.tower,e.floor));setStrongholdPvpError('');}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'자원거점 상태를 불러오지 못했습니다.');}
  finally{setStrongholdPvpBusy(false);}
 }
 async function advanceStrongholdPvp(){
  const lease=gameplayLeaseRef.current,e=stateRef.current.expedition;
  if(!lease||gameSessionPhaseRef.current!=='active'||!e)return;
  try{setStrongholdPvp(await advanceResourceStrongholdState(lease,e.tower,e.floor));setStrongholdPvpError('');}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'자원거점 자동 진행을 확인하지 못했습니다.');}
 }
 useEffect(()=>{
  if(!onlineSession||gameSessionPhase!=='active'||!gameplayLease||!game.expedition){setStrongholdPvp(null);return;}
  void refreshStrongholdPvp();
  const timer=window.setInterval(()=>void advanceStrongholdPvp(),5000);
  const unsubscribe=subscribeResourceStrongholdRealtime(()=>void refreshStrongholdPvp());
  return()=>{window.clearInterval(timer);unsubscribe();};
 },[onlineSession?.userId,gameSessionPhase,gameplayLease?.generation,game.expedition?.tower,game.expedition?.floor]);
 useEffect(()=>{setStrongholdPanelOpen(false);},[game.expedition?.tower,game.expedition?.floor]);
 useEffect(()=>{
  const contest=strongholdPvp?.contest;
  if(contest&&(strongholdPvp?.role==='OWNER'||strongholdPvp?.role==='CHALLENGER'))setStrongholdPanelOpen(true);
 },[strongholdPvp?.contest?.contest_id,strongholdPvp?.contest?.status,strongholdPvp?.role]);
 async function requestStrongholdPvpNow(){
  const lease=gameplayLeaseRef.current,e=stateRef.current.expedition;if(!lease||!e)return;
  setStrongholdPvpBusy(true);try{setStrongholdPvp(await requestResourceStronghold(lease,e.tower,e.floor));setStrongholdPvpError('');await restoreServerRun(lease);}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'자원거점 요청에 실패했습니다.');}finally{setStrongholdPvpBusy(false);}
 }
 async function respondStrongholdPvpNow(response:'DEFEND'|'ABANDON'){
  const lease=gameplayLeaseRef.current,id=strongholdPvp?.contest?.contest_id;if(!lease||!id)return;
  setStrongholdPvpBusy(true);try{await respondResourceStrongholdContest(lease,id,response);setStrongholdPvpError('');await refreshStrongholdPvp();await restoreServerRun(lease);}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'자원거점 선택을 처리하지 못했습니다.');}finally{setStrongholdPvpBusy(false);}
 }
 async function actStrongholdPvpNow(action:'BASIC'|'GUARD'){
  const lease=gameplayLeaseRef.current,c=strongholdPvp?.contest;if(!lease||!c)return;
  setStrongholdPvpBusy(true);try{await applyResourceStrongholdContestAction(lease,c.contest_id,c.action_nonce+1,action);setStrongholdPvpError('');await refreshStrongholdPvp();await restoreServerRun(lease);}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'개입전 행동을 처리하지 못했습니다.');void refreshStrongholdPvp();}finally{setStrongholdPvpBusy(false);}
 }
 async function abandonStrongholdPvpNow(){
  const lease=gameplayLeaseRef.current,id=strongholdPvp?.stronghold?.strongholdId;if(!lease||!id)return;
  setStrongholdPvpBusy(true);try{await abandonResourceStronghold(lease,id);setStrongholdPvp(null);await settleOnlineRun('returned');}
  catch(error){setStrongholdPvpError(error instanceof Error?error.message:'자원거점 포기에 실패했습니다.');}finally{setStrongholdPvpBusy(false);}
 }
 useEffect(()=>{const before=getStoredSession();const session=consumeOAuthRedirect();setOnlineSession(session);if(session&&!before)setGame(s=>({...s,notice:'Google 로그인 완료 · 진행 상황이 자동으로 동기화됩니다.'}));},[]);

 useEffect(()=>{if(game.expedition?.pendingRevival&&page!=='battle')setPage('battle');},[page,game.expedition?.pendingRevival]);
 useEffect(()=>{if(wasExpedition.current&&!game.expedition)setPage('home');wasExpedition.current=!!game.expedition;},[game.expedition,game.lastExpedition]);

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
    const record=await settleOnlineExpedition(lease,receipt.outcome);
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
  async()=>{if(getStoredSession()&&gameSessionPhaseRef.current!=='active')throw Error('다른 기기에서 플레이 중입니다.');if(!stateRef.current.expedition)throw Error('진행 중인 원정이 없습니다.');if(onlineSession&&gameSessionPhaseRef.current==='active'&&gameplayLeaseRef.current){commitOnlineCombatAction('FLEE',undefined,flee);return {status:'return_requested',silver:stateRef.current.silver};}const next=requestReturn(stateRef.current);flushSync(()=>{setGame(next);setPage('battle');});return {status:next.expedition?'return_requested':'returned',silver:next.silver};}
 ),[]);
 useEffect(()=>{
  if(blocked.current){setStorageError('저장 데이터를 읽지 못해 자동 저장을 중단했습니다.');return;}
  const snapshot=stableStringify(game);
  if(lastPersistedGame.current===snapshot)return;
  if(!combatFixtureName&&onlineSession&&gameSessionPhase==='active'&&gameplayLease&&game.expedition){
   lastPersistedGame.current=snapshot;
   setStorageError('');
   setSaved('서버 원정');
   return;
  }
  try{
   createRepository(gameStorage).save(game);
   lastPersistedGame.current=snapshot;
   setStorageError('');
   setSaved(combatFixtureName?'QA':onlineSession?'동기화 대기':'저장');
  }catch(error){
   const message=error instanceof Error?error.message:'';
   setStorageError(message.includes('유효하지 않은 게임 상태')?'저장 데이터 검증에 실패했습니다.':'저장 공간을 사용할 수 없습니다.');
   return;
  }
  if(!combatFixtureName&&onlineConfigured&&onlineSession&&gameSessionPhase==='active'&&gameplayLease&&!serverEconomyBusy.current&&!game.expedition){
   if(cloudTimer.current!==null)window.clearTimeout(cloudTimer.current);
   cloudTimer.current=window.setTimeout(()=>{cloudTimer.current=null;void runCloudSync();},750);
  }
  return()=>{if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}};
 },[game,onlineSession?.userId,gameSessionPhase,gameplayLease?.generation]);
 useEffect(()=>{
  if(!onlineSession){setProfileState({userId:'',status:'loading',profile:null,error:''});return;}
  let cancelled=false;const userId=onlineSession.userId;
  setProfileState({userId,status:'loading',profile:null,error:''});
  void loadPlayerProfile().then(profile=>{if(!cancelled)setProfileState({userId,status:profile?'ready':'missing',profile,error:''});}).catch(error=>{if(!cancelled)setProfileState({userId,status:'error',profile:null,error:error instanceof Error?error.message:'닉네임을 확인하지 못했습니다.'});});
  return()=>{cancelled=true;};
 },[onlineSession?.userId,profileRetry]);
 useEffect(()=>{
  if(!onlineSession){gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('guest');setGameSessionPlatform(null);setGameSessionHeartbeat(null);return;}
  if(!profileReady)return;
  let cancelled=false;
  void (async()=>{setGameSessionPhase('acquiring');setGameSessionMessage('계정의 플레이 권한을 확인하고 있습니다.');try{const result=await acquireGameSession();if(!cancelled)applyGameSessionResult(result);}catch(error){if(!cancelled){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'플레이 세션을 확인하지 못했습니다.');}}})();
  return()=>{cancelled=true;};
 },[onlineSession?.userId,profileReady]);

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
 useEffect(()=>{const settle=()=>{if(document.hidden)return;const tick=Date.now();setNow(tick);if(!gameplayWritable)return;const onlineAuthoritative=!!onlineSession&&gameSessionPhaseRef.current==='active'&&!!gameplayLeaseRef.current;if(onlineAuthoritative){const sh=stateRef.current.expedition?.events.stronghold;if(sh?.status==='ACTIVE'&&tick>=sh.captureEndsAt)void settleOnlineStrongholdNow();return;}setGame(state=>expireTimedEventChoice(settleStronghold(state,tick),tick));};const id=setInterval(settle,1000);document.addEventListener('visibilitychange',settle);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',settle);};},[]);
 useEffect(()=>{const p=game.expedition?.events.pendingEvent;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!p||p.state!=='CHOICE'||p.eventId!=='resource_stronghold'||typeof p.expiresAt!=='number'||now<p.expiresAt){if(!p||p.instanceId!==eventTimeoutHandled.current)eventTimeoutHandled.current='';return;}if(eventTimeoutHandled.current===p.instanceId)return;eventTimeoutHandled.current=p.instanceId;void commitOnlineEventChoice(p.instanceId,'skip');},[now,game.expedition?.events.pendingEvent?.instanceId,game.expedition?.events.pendingEvent?.state,onlineSession?.userId]);
 useEffect(()=>{if(!gameplayWritable||game.expedition?.phase!=='MONSTER_TURN'||game.expedition.pendingRevival)return;if(onlineSession&&gameSessionPhaseRef.current==='active')return;const id=window.setTimeout(()=>setGame(resolveMonsterTurn),Math.round(1000/Math.max(.5,loadPrefs().speed)));return()=>window.clearTimeout(id);},[gameplayWritable,game.expedition?.phase,game.expedition?.pendingRevival,onlineSession?.userId]);

 const exp=game.expedition,eventOpen=!!exp?.events.pendingEvent,immersive=page==='battle'&&!!exp,visibleNotice=game.notice.startsWith('안전 귀환 ·')?'':game.notice;
 function move(p:AppPage){if(exp?.pendingRevival)return;if(p==='jobs')setJobsEntryTab('register');setPage(p==='towers'&&exp?'battle':p);}
 function openMarketFromInventory(intent:MarketIntent){if(exp?.pendingRevival)return;setMarketIntent(intent);setInventoryReturnKey(null);setPage('market');}
 function returnToInventory(inventoryKey:string){setMarketIntent(null);setInventoryReturnKey(inventoryKey);setPage('inventory');}
 function openEnhancement(itemId?:string,inventoryKey?:string){if(exp?.pendingRevival)return;setEnhancementInitialId(itemId??null);setEnhancementReturnKey(inventoryKey??null);setPage('enhancement');}
 function backFromEnhancement(){setEnhancementInitialId(null);if(enhancementReturnKey)setInventoryReturnKey(enhancementReturnKey);setEnhancementReturnKey(null);setPage('inventory');}
 function openMarketFromEnhancement(intent:MarketIntent){if(exp?.pendingRevival)return;setMarketIntent(intent);setPage('market');}
 function returnToEnhancement(itemId:string){setMarketIntent(null);setEnhancementInitialId(itemId);setPage('enhancement');}
 function openJobs(tab:JobTab){if(exp?.pendingRevival)return;setJobsEntryTab(tab);setPage('jobs');}
 function acceptImportedSave(next:GameState){if(onlineSession&&gameSessionPhaseRef.current!=='active')return;blocked.current=false;setStorageError('');stateRef.current=next;flushSync(()=>setGame(next));setSaved('복구');setPage(next.expedition?'battle':'home');}
 function commitEvent(action:(state:GameState)=>GameState){if(blocked.current)throw Error('저장 차단');if(getStoredSession()&&gameSessionPhaseRef.current!=='active')throw Error('다른 기기에서 플레이 중입니다.');const current=stateRef.current,next=action(current);if(next===current)return;createRepository(gameStorage).save(next);stateRef.current=next;flushSync(()=>setGame(next));}
 async function commitOnlineEventChoice(instance:string,choice:string){const lease=gameplayLeaseRef.current,expedition=stateRef.current.expedition;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease||!expedition){commitEvent(s=>resolveEvent(s,instance,choice));return;}try{const eventId=expedition.events.pendingEvent?.eventId;if(eventId==='resource_stronghold'&&choice==='claim'){const pvp=await requestResourceStronghold(lease,expedition.tower,expedition.floor);setStrongholdPvp(pvp);setCloudSyncMessage(pvp.role==='OWNER'?'자원거점 점령을 서버에서 시작했습니다.':'자원거점 쟁탈 요청을 서버에 등록했습니다.');await restoreServerRun(lease);return;}const result=await resolveOnlineExplorationEvent(lease,onlineRunVersion.current,choice);onlineRunVersion.current=result.runVersion;if(result.playerHp===0&&!result.pendingRevival){await settleOnlineRun('dead');return;}await restoreServerRun(lease);}catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'서버 이벤트 처리에 실패했습니다.');}}
 async function settleOnlineStrongholdNow(){const lease=gameplayLeaseRef.current;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease)return;try{await settleOnlineResourceStronghold(lease,onlineRunVersion.current);await restoreServerRun(lease);}catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'자원거점 정산에 실패했습니다.');}}
 async function abandonOnlineStrongholdNow(){const lease=gameplayLeaseRef.current;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease){setGame(s=>abandonStrongholdAndReturn(s));return;}try{const sharedId=strongholdPvp?.stronghold?.strongholdId;if(sharedId)await abandonResourceStronghold(lease,sharedId);else {const result=await abandonOnlineResourceStronghold(lease,onlineRunVersion.current);onlineRunVersion.current=result.runVersion;}setStrongholdPvp(null);await settleOnlineRun('returned');}catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'자원거점 포기에 실패했습니다.');}}
 function activateGameplay(result:GameSessionResult){if(result.status!=='ACTIVE'||!result.lease)return;recordingAction.current=false;onlineCombatNonce.current=0;onlineRunVersion.current=0;confirmedKillCount.current=0;eventTimeoutHandled.current='';gameplayLeaseRef.current=result.lease;setGameplayLease(result.lease);setGameSessionPlatform(result.activePlatform);setGameSessionHeartbeat(result.heartbeatAt);setGameSessionPhase('active');setGameSessionMessage('이 기기에서 플레이 중입니다.');void restoreServerRun(result.lease);}
 function applyGameSessionResult(result:GameSessionResult){setGameSessionPlatform(result.activePlatform);setGameSessionHeartbeat(result.heartbeatAt);if(result.status==='ACTIVE'){activateGameplay(result);return;}gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase(result.status==='PENDING'?'taking-over':'locked');setGameSessionMessage(result.status==='PENDING'?'기존 기기에 마지막 저장을 요청했습니다.':'같은 Google 계정이 다른 기기에서 플레이 중입니다.');}
 async function retryGameSession(){setGameSessionPhase('acquiring');setGameSessionMessage('계정의 플레이 권한을 다시 확인하고 있습니다.');try{applyGameSessionResult(await acquireGameSession());}catch(error){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'플레이 세션을 확인하지 못했습니다.');}}
 async function applyLatestCloud(){try{const remote=await loadCloudSave();if(remote){createRepository(gameStorage).save(remote.payload);stateRef.current=remote.payload;flushSync(()=>setGame(remote.payload));setCloudRevision(remote.revision);setSaved('클라우드');return remote.payload;}}catch{}return null;}
 async function hydrateAccountWithoutServerRun(lease:GameplayLease){
  recordingAction.current=false;onlineCombatNonce.current=0;onlineRunVersion.current=0;confirmedKillCount.current=0;eventTimeoutHandled.current='';
  const session=getStoredSession();
  let remote=await loadCloudSave();
  let next:GameState;
  if(remote){
   if(session)rememberCloudRecord(remote,session.userId);
   next=remote.payload.expedition?{...remote.payload,expedition:null}:remote.payload;
   if(remote.payload.expedition){
    const synced=await reconcileCloudState(next,lease);
    next=synced.state;if(synced.record)setCloudRevision(synced.record.revision);
   }else setCloudRevision(remote.revision);
  }else{
   const synced=await reconcileCloudState(initialState(),lease);
   next=synced.state;if(synced.record)setCloudRevision(synced.record.revision);
  }
  createRepository(gameStorage).save(next);
  stateRef.current=next;flushSync(()=>setGame(next));
  lastPersistedGame.current=stableStringify(next);
  setSaved(remote?'클라우드':'새 계정');
  setStorageError('');setCloudSyncStatus('synced');setCloudSyncMessage(remote?'이 계정의 저장 상태를 불러왔습니다.':'새 계정 저장을 생성했습니다.');
  setPage(next.expedition?'battle':'home');
 }
 async function loseGameplaySession(message:string){if(gameSessionPhaseRef.current==='locked'&&!gameplayLeaseRef.current)return;if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('locked');setGameSessionMessage(message);setCloudSyncStatus('synced');setCloudSyncMessage('다른 기기의 플레이 세션이 활성화되었습니다.');await applyLatestCloud();}
 async function gracefulHandoff(){const lease=gameplayLeaseRef.current;if(!lease||handoffBusy.current)return;handoffBusy.current=true;setGameSessionPhase('handoff');setGameSessionMessage('현재 진행 상황을 저장한 뒤 다른 기기로 플레이를 넘기고 있습니다.');try{const result=await reconcileCloudState(stateRef.current,lease);if(result.action==='pulled'){createRepository(gameStorage).save(result.state);stateRef.current=result.state;flushSync(()=>setGame(result.state));}if(result.record)setCloudRevision(result.record.revision);await releaseGameSession(lease);}catch(error){if(!(error instanceof CloudSessionLostError)&&!(error instanceof GameSessionLostError))setCloudSyncMessage(error instanceof Error?error.message:'마지막 저장을 확인하지 못했습니다.');}finally{gameplayLeaseRef.current=null;setGameplayLease(null);setGameSessionPhase('locked');setGameSessionMessage('다른 기기에서 플레이가 시작되었습니다. 이 기기에서는 진행할 수 없습니다.');handoffBusy.current=false;}}
 async function handleGameSessionSignal(signal:GameSessionSignal){setGameSessionPlatform(signal.platform);setGameSessionHeartbeat(signal.heartbeatAt);const phase=gameSessionPhaseRef.current,lease=gameplayLeaseRef.current;if(phase==='active'&&lease){if(signal.generation!==lease.generation||(signal.expiresAt&&new Date(signal.expiresAt).getTime()<=Date.now())){await loseGameplaySession('다른 기기에서 플레이가 시작되었습니다.');return;}if(signal.takeoverRequestedAt){await gracefulHandoff();return;}}if(phase==='taking-over'&&signal.expiresAt&&new Date(signal.expiresAt).getTime()<=Date.now()){if(takeoverTimer.current!==null){window.clearTimeout(takeoverTimer.current);takeoverTimer.current=null;}await retryGameSession();}}
 async function takeOverHere(){if(takeoverTimer.current!==null)window.clearTimeout(takeoverTimer.current);setGameSessionPhase('taking-over');setGameSessionMessage('기존 기기에 마지막 저장을 요청하고 있습니다.');try{const result=await requestGameSessionTakeover();applyGameSessionResult(result);if(result.status==='ACTIVE')return;takeoverTimer.current=window.setTimeout(()=>{takeoverTimer.current=null;void (async()=>{try{activateGameplay(await forceTakeoverGameSession());}catch{await retryGameSession();}})();},GAME_SESSION_TAKEOVER_GRACE_MS+400);}catch(error){setGameSessionPhase('error');setGameSessionMessage(error instanceof Error?error.message:'기기 전환을 시작하지 못했습니다.');}}
 async function runCloudSync(){
  const lease=gameplayLeaseRef.current;
  if(combatFixtureName||!onlineConfigured||!getStoredSession()||gameSessionPhaseRef.current!=='active'||!lease)return;
  if(stateRef.current.expedition){await restoreServerRun(lease);return;}
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
 async function settleOnlineRun(outcome:'returned'|'dead'){
  const lease=gameplayLeaseRef.current;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease)return;
  serverEconomyBusy.current=true;
  try{
   const record=await settleOnlineExpedition(lease,outcome);
   createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));
   setCloudRevision(record.revision);setSaved('서버 정산');setCloudSyncStatus('synced');setCloudSyncMessage(outcome==='returned'?'안전 귀환을 서버에서 정산했습니다.':'원정 실패를 서버에서 정산했습니다.');setPage('home');
  }finally{serverEconomyBusy.current=false;}
 }
 async function selectOnlineJobNow(jobId:string){
  const lease=gameplayLeaseRef.current;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease)return;
  try{const record=await selectOnlineJob(lease,jobId);createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));setCloudRevision(record.revision);setCloudSyncStatus('synced');setCloudSyncMessage('직업 선택을 서버에 저장했습니다.');}
  catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'직업 선택을 서버에 저장하지 못했습니다.');}
 }
 function commitOnlineCombatAction(kind:'BASIC'|'SKILL'|'POTION'|'FLEE'|'REVIVAL',ref:string|undefined,apply:(state:GameState)=>GameState){
  const lease=gameplayLeaseRef.current;
  if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease){setGame(apply);return;}
  if(recordingAction.current)return;recordingAction.current=true;
  const nonce=onlineCombatNonce.current+1;
  void (async()=>{try{
   let result:OnlineCombatState;
   if(kind==='BASIC')result=await applyOnlineBasicAttack(lease,nonce);
   else if(kind==='POTION')result=await applyOnlinePotion(lease,nonce,ref!);
   else if(kind==='FLEE')result=await applyOnlineFlee(lease,nonce);
   else if(kind==='REVIVAL')result=await resolveOnlineRevival(lease,ref==='use');
   else {try{result=await applyOnlineJobSkill(lease,nonce,ref!);}catch(error){if(error instanceof Error&&!error.message.includes('COMBAT_SKILL_INVALID'))throw error;result=await applyOnlineSkill(lease,nonce,ref!);}}
   onlineCombatNonce.current=result.actionNonce??nonce;if(typeof result.confirmedKills==='number')confirmedKillCount.current=result.confirmedKills;if(typeof result.runVersion==='number')onlineRunVersion.current=result.runVersion;
   setCloudSyncStatus('synced');
   const candidate=reconcileOnlineCombatState(stateRef.current,result,{emitCombatEvents:true});
   const retaliationDelay=playerRecoveryDelay((candidate.combatEvents??[]).filter(event=>event.id>(stateRef.current.combatEvents?.at(-1)?.id??0)),loadPrefs().speed);
   stateRef.current=candidate;setStorageError('');flushSync(()=>setGame(candidate));
   if(retaliationDelay)await new Promise<void>(resolve=>window.setTimeout(resolve,retaliationDelay));
   const showImpact=()=>new Promise<void>(resolve=>window.setTimeout(resolve,500));
   if(result.returnAuthorized){await showImpact();await settleOnlineRun('returned');return;}
   if(result.phase==='PLAYER_DEAD'&&!result.pendingRevival){await showImpact();await settleOnlineRun('dead');return;}
   if(kind!=='FLEE'&&result.phase==='DEFEATED'){await showImpact();const advanced=await advanceOnlineExploration(lease,onlineRunVersion.current);onlineRunVersion.current=advanced.runVersion;await restoreServerRun(lease);return;}
  }catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'서버 전투 처리에 실패했습니다.');}finally{recordingAction.current=false;}})();
 }
 async function restoreServerRun(lease:GameplayLease){
  try{
   let restored=await restoreOnlineExpedition(lease);if(!restored.active||!restored.run){await hydrateAccountWithoutServerRun(lease);return;}
   let combat=restored.combat;
   if(combat?.phase==='DEFEATED'&&!restored.run.pendingEvent&&combat.returnAuthorized!==true){
    const advanced=await advanceOnlineExploration(lease,restored.run.runVersion);onlineRunVersion.current=advanced.runVersion;restored=await restoreOnlineExpedition(lease);if(!restored.active||!restored.run){await hydrateAccountWithoutServerRun(lease);return;}combat=restored.combat;
   }
   if(combat?.phase==='PLAYER_DEAD'&&!combat.pendingRevival){await settleOnlineRun('dead');return;}
   confirmedKillCount.current=restored.run.confirmedKills;onlineRunVersion.current=restored.run.runVersion;
   if(combat&&typeof combat.actionNonce==='number')onlineCombatNonce.current=combat.actionNonce;
   const candidate=reconcileOnlineExpeditionState(stateRef.current,restored);
   stateRef.current=candidate;setGame(candidate);setPage('battle');setStorageError('');
   setCloudSyncStatus('synced');setCloudSyncMessage('서버의 진행 중인 원정을 복원했습니다.');
  }catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'서버 원정 복원에 실패했습니다.');}
 }
 async function continueOnlineExplorationNow(){const lease=gameplayLeaseRef.current;if(!onlineSession||gameSessionPhaseRef.current!=='active'||!lease)return;try{const result=await advanceOnlineExploration(lease,onlineRunVersion.current);onlineRunVersion.current=result.runVersion;await restoreServerRun(lease);}catch(error){setCloudSyncStatus('error');setCloudSyncMessage(error instanceof Error?error.message:'다음 탐험을 서버에서 시작하지 못했습니다.');}}
 async function logoutOnline(){if(takeoverTimer.current!==null){window.clearTimeout(takeoverTimer.current);takeoverTimer.current=null;}const lease=gameplayLeaseRef.current;if(lease)try{await releaseGameSession(lease);}catch{}gameplayLeaseRef.current=null;setGameplayLease(null);await signOutOnline();setOnlineSession(null);setGameSessionPhase('guest');setCloudSyncStatus('local');setCloudRevision(null);setCloudSyncMessage('게스트 저장');setSaved('저장');}
 const shellClass=immersive?(eventOpen?'tc-app tc-event-mode':'tc-app tc-battle-mode'):'tc-app';

 if(onlineSession&&!profileReady)return <NicknameGate key={onlineSession.userId} status={profileState.userId===onlineSession.userId&&profileState.status!=='ready'?profileState.status:'loading'} error={profileState.error} onRegister={registerPlayerNickname} onReady={profile=>{if(profile.userId===getStoredSession()?.userId)setProfileState({userId:profile.userId,status:'ready',profile,error:''});}} onRetry={()=>setProfileRetry(n=>n+1)} onLogout={()=>void logoutOnline()}/>;
 return <div className={shellClass}>
  {!immersive&&<><header className="tc-topbar">
   <button className="tc-brand" onClick={()=>move('home')}><span className="tc-brand-mark"><i>T</i></span><span><b>탑의 기록</b><small>TOWER CHRONICLES</small></span></button>
   <div className="tc-wallet"><span className="tc-coin"><i/><b>{game.silver.toLocaleString()}</b><small>Silver</small></span><span className="tc-coin gold"><i/><b>{game.market.gold.toLocaleString()}</b><small>Gold</small></span></div>
   <div className="tc-header-actions"><button className="tc-mail-open" aria-label={mailUnread?'미확인 우편 있음 · 우편함 열기':'우편함 열기'} onClick={()=>setMailOpen(true)}>✉{mailUnread>0&&<i/>}</button><button className="tc-settings-open" aria-label="설정 열기" onClick={()=>setSettingsOpen(true)}>⚙</button></div>
  </header><div className="tc-statusbar"><span><i className={exp?'live':''}/>{exp?TOWERS[exp.tower].name+' '+exp.floor+'F 원정 중':'노바르 거점'}</span><span>v{APP_VERSION} · {saved}</span></div></>}
  {immersive&&<button className="tc-settings-open tc-settings-floating" aria-label="설정 열기" onClick={()=>setSettingsOpen(true)}>⚙</button>}
  {immersive&&<button className="tc-mail-open tc-mail-floating" aria-label="우편함 열기" onClick={()=>setMailOpen(true)}>✉{mailUnread>0&&<i/>}</button>}
  {mailOpen&&<MailDialog key={onlineSession?.userId??'guest'} userId={onlineSession?.userId??null} lease={gameSessionPhase==='active'?gameplayLease:null} game={game} setGame={setGame} onClose={()=>setMailOpen(false)} onUnread={setMailUnread}/>}
  <main className={page==='hunt'?'tc-main tc-hunt-main':page==='stats'?'tc-main tc-stat-main':page==='skills'?'tc-main tc-skill-tree-main':'tc-main'}>
   {storageError&&<div className="error" role="alert"><span>{storageError}</span>{onlineSession&&<span style={{display:'inline-flex',gap:'6px',marginLeft:'8px'}}><button onClick={()=>{const lease=gameplayLeaseRef.current;if(lease)void restoreServerRun(lease);}}>서버 상태 복구</button><button onClick={()=>setPage('home')}>거점 화면</button></span>}</div>}
   {immersive&&cloudSyncStatus==='error'&&<div className="error" role="alert">{cloudSyncMessage}</div>}
   {(page==='home'||page==='settings')&&<HomeScreen nickname={playerNickname} game={game} onMove={move} onOpenJobs={openJobs}/>}
   {(page==='world'||page==='craft')&&<WorldPage initialView={page==='craft'?'craft':'map'} onHome={()=>setPage('home')} onInventory={()=>setPage('inventory')} key={page+':'+(onlineSession?.userId??'guest')+':'+(gameplayLease?.leaseId??'')+':'+(gameplayLease?.generation??0)+':'+gameSessionPhase} userId={onlineSession?.userId??null} lease={gameSessionPhase==='active'?gameplayLease:null} now={now}/>}
   {page==='stats'&&<StatAllocationPage key={onlineSession?.userId??'guest'} game={game} userId={onlineSession?.userId??null} lease={gameSessionPhase==='active'?gameplayLease:null} onHome={()=>move('home')}/>}
   {page==='hunt'&&<HuntingPage key={(onlineSession?.userId??'guest')+':'+(gameplayLease?.leaseId??'')+':'+(gameplayLease?.generation??0)} game={game} setGame={setGame} now={now} userId={onlineSession?.userId??null} nickname={playerNickname} lease={gameSessionPhase==='active'?gameplayLease:null} onPrepare={async()=>{if(cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}if(cloudBusy.current||serverEconomyBusy.current)throw Error('저장 동기화 중입니다. 잠시 후 다시 사냥해 주세요.');await runCloudSync();if(gameSessionPhaseRef.current!=='active'||!isHuntingLeaseCurrent(gameplayLease,gameplayLeaseRef.current))throw Error('플레이 권한을 다시 확인해 주세요.');}} onPending={value=>{const owner=(onlineSession?.userId??'guest')+':'+(gameplayLease?.leaseId??'')+':'+(gameplayLease?.generation??0);if(value){if(onlineSession&&!isHuntingLeaseCurrent(gameplayLease,gameplayLeaseRef.current))return;huntingBusyOwner.current=owner;}else{if(huntingBusyOwner.current!==owner)return;huntingBusyOwner.current=null;}serverEconomyBusy.current=value;if(value&&cloudTimer.current!==null){window.clearTimeout(cloudTimer.current);cloudTimer.current=null;}}} onRecord={record=>{if(getStoredSession()?.userId!==onlineSession?.userId||gameSessionPhaseRef.current!=='active'||!isHuntingLeaseCurrent(gameplayLease,gameplayLeaseRef.current))return;if(onlineSession)rememberCloudRecord(record,onlineSession.userId);createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));setCloudRevision(record.revision);setSaved('사냥 결과');setCloudSyncStatus('synced');setCloudSyncMessage('사냥 보상을 서버에 저장했습니다.');}}/>}
   {page==='towers'&&<TowersScreen game={game} onSelect={t=>{setTower(t);setFloor(1);setPage('floor');}}/>}
   {page==='floor'&&<FloorScreen game={game} setGame={setGame} tower={tower} floor={floor} setFloor={setFloor} onBack={()=>setPage('towers')} onEnter={()=>{void (async()=>{const current=stateRef.current,next=enter(current,tower,floor);if(!next.expedition){setGame(next);return;}const lease=gameplayLeaseRef.current;if(onlineSession&&gameSessionPhaseRef.current==='active'&&lease){try{const record=await startOnlineExpedition(lease,tower,floor,next);confirmedKillCount.current=0;onlineRunVersion.current=0;onlineCombatNonce.current=0;createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;setCloudRevision(record.revision);setCloudSyncStatus('synced');setCloudSyncMessage('입장권과 원정 시작을 서버에 기록했습니다.');setGame(record.payload);const combat=await beginOnlineCombatState(lease);onlineCombatNonce.current=combat.actionNonce;if(typeof combat.runVersion==='number')onlineRunVersion.current=combat.runVersion;{const candidate=reconcileOnlineCombatState(stateRef.current,combat);stateRef.current=candidate;setGame(candidate);setStorageError('');setPage('battle');}}catch(error){setGame({...current,notice:error instanceof Error?error.message:'서버 원정을 시작하지 못했습니다.'});}}else{setGame(next);setPage('battle');}})();}}/>}
   {page==='battle'&&exp&&onlineSession&&gameSessionPhase==='active'&&gameplayLease&&!eventOpen&&strongholdPanelOpen&&<ResourceStrongholdPanel
    state={strongholdPvp} now={now} busy={strongholdPvpBusy} error={strongholdPvpError}
    onRefresh={()=>void refreshStrongholdPvp()} onRequest={()=>void requestStrongholdPvpNow()}
    onRespond={response=>void respondStrongholdPvpNow(response)} onAction={action=>void actStrongholdPvpNow(action)}
    onAbandon={()=>void abandonStrongholdPvpNow()} onClose={()=>setStrongholdPanelOpen(false)}
   />}
   {page==='battle'&&exp&&onlineSession&&gameSessionPhase==='active'&&gameplayLease&&!eventOpen&&!strongholdPanelOpen&&<button className="tc-stronghold-pvp-entry" onClick={()=>setStrongholdPanelOpen(true)}>자원거점</button>}
   {page==='battle'&&(exp?(eventOpen?<EventScreen key={exp.events.pendingEvent!.instanceId+exp.events.pendingEvent!.state} game={game} now={now} onHome={()=>setPage('home')} onChoice={(instance,choice)=>void commitOnlineEventChoice(instance,choice)} onContinue={instance=>{if(onlineSession&&gameSessionPhaseRef.current==='active'&&gameplayLeaseRef.current)void continueOnlineExplorationNow();else commitEvent(s=>continueEvent(s,instance));}} onRevival={use=>{if(onlineSession&&gameSessionPhaseRef.current==='active'&&gameplayLeaseRef.current)commitOnlineCombatAction('REVIVAL',use?'use':'decline',s=>resolveRevivalDecision(s,use));else setGame(s=>resolveRevivalDecision(s,use));}}/>:<BattleScreen game={game} now={now} onHome={()=>setPage('home')} onBasicAttack={()=>commitOnlineCombatAction('BASIC',undefined,basicAttack)} onSkill={id=>commitOnlineCombatAction('SKILL',id,s=>useBattleSkill(s,id))} onPotion={p=>commitOnlineCombatAction('POTION',p,s=>useBattlePotion(s,p))} onFlee={()=>commitOnlineCombatAction('FLEE',undefined,flee)} onRevival={use=>commitOnlineCombatAction('REVIVAL',use?'use':'decline',s=>resolveRevivalDecision(s,use))} onAbandonStronghold={()=>void abandonOnlineStrongholdNow()}/>):null)}
   {page==='inventory'&&<InventoryScreen key={(onlineSession?.userId??'guest')+':'+(gameplayLease?.leaseId??'')+':'+(gameplayLease?.generation??0)+':'+gameSessionPhase} userId={onlineSession?.userId??null} game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} onEnhancement={openEnhancement} onMarket={openMarketFromInventory} onSkills={()=>move('skills')} initialSelected={inventoryReturnKey} onInitialSelectedConsumed={()=>setInventoryReturnKey(null)}/>}
   {page==='skills'&&<SkillBooksPage key={(onlineSession?.userId??'guest')+':'+(gameplayLease?.generation??0)} game={game} onHome={()=>move('home')} lease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} onSnapshot={snapshot=>setGame(current=>({...current,skillEnhancements:snapshot.enhancements??{},market:{...current.market,gold:snapshot.gold??snapshot.record?.payload.market.gold??current.market.gold},skillBooks:{...(snapshot.record?.payload.skillBooks??current.skillBooks),...snapshot.books},learned:[...current.learned.filter(id=>!SKILL_TREE_CATALOG.some(s=>s.id===id)),...snapshot.learned]}))}/>}
   {page==='enhancement'&&<p>장비 강화는 종료되었습니다.</p>}
   {page==='market'&&<MarketScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} intent={marketIntent} onIntentConsumed={()=>setMarketIntent(null)} onReturnToInventory={returnToInventory} onReturnToEnhancement={returnToEnhancement}/>}
   {page==='gold-exchange'&&<GoldExchangeScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}/>}
   {page==='seal'&&<SealScreen game={game} setGame={setGame} onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null} onServerRecord={(record,message)=>{createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));setCloudRevision(record.revision);setSaved('협회 인장');setCloudSyncStatus('synced');setCloudSyncMessage(message);}}/>}
   {page==='association'&&<AssociationScreen
    onOccupation={()=>setPage('occupation')}
    game={game}
    setGame={setGame}
    onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}
    onServerRecord={(record,message)=>{createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));setCloudRevision(record.revision);setSaved('원정단');setCloudSyncStatus('synced');setCloudSyncMessage(message);}}
   />}
   {page==='occupation'&&<OccupationScreen onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}/>}
   {page==='jobs'&&<JobsScreen
    game={game}
    setGame={setGame}
    onSelectJob={onlineSession&&gameSessionPhase==='active'?jobId=>void selectOnlineJobNow(jobId):undefined}
    onlineLease={onlineSession&&gameSessionPhase==='active'?gameplayLease:null}
    initialTab={jobsEntryTab}
    onServerRecord={(record,message)=>{createRepository(gameStorage).save(record.payload);stateRef.current=record.payload;flushSync(()=>setGame(record.payload));setCloudRevision(record.revision);setSaved('직능등록');setCloudSyncStatus('synced');setCloudSyncMessage(message);}}
   />}
   {page==='bestiary'&&<BestiaryScreen game={game} onBack={()=>setPage('home')}/>}
   {(settingsOpen||page==='settings')&&<SettingsDialog key={onlineSession?.userId??'guest'} onRewardMail={()=>setMailUnread(n=>n+1)} session={onlineSession} nickname={playerNickname} details={<SaveManagement game={game} storage={gameStorage} onImported={acceptImportedSave} session={onlineSession} syncStatus={cloudSyncStatus} syncRevision={cloudRevision} syncMessage={cloudSyncMessage} onLogout={logoutOnline}/>} syncStatus={cloudSyncStatus} syncMessage={cloudSyncMessage} onLogout={logoutOnline} onClose={()=>{setSettingsOpen(false);if(page==='settings')move('home');}}/>}
   {page==='cosmetics'&&<CosmeticsScreen game={game} setGame={setGame}/>}
   {page==='shop'&&<ShopScreen game={game}/>}

   {!immersive&&page!=='battle'&&visibleNotice&&<div className="tc-notice-backdrop" role="presentation" onClick={()=>setGame(state=>({...state,notice:''}))}><section className="tc-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-notice-title" onClick={event=>event.stopPropagation()}><button className="tc-notice-close" aria-label="알림 닫기" onClick={()=>setGame(state=>({...state,notice:''}))}>×</button><small>NOTICE</small><h2 id="tc-notice-title">알림</h2><p>{visibleNotice}</p><button className="tc-notice-confirm" onClick={()=>setGame(state=>({...state,notice:''}))}>확인</button></section></div>}
  </main>
  {!immersive&&<nav className="tc-nav" aria-label="주요 메뉴">{nav.map(([p,g,label])=><button key={p} aria-current={page===p||(p==='market'&&page==='gold-exchange')||(p==='association'&&page==='occupation')||(p==='home'&&['settings','jobs','bestiary','cosmetics','seal','towers','floor','skills','enhancement','world'].includes(page))} onClick={()=>move(p)}><Glyph name={g}/>{label}{p==='market'&&(game.market.storage?.length??0)>0&&<b className="tc-nav-badge">{game.market.storage!.length}</b>}</button>)}</nav>}
  <WorldChat key={onlineSession?.userId??'guest'} userId={onlineSession?.userId??null} nickname={playerNickname} enabled={!!onlineSession&&profileReady&&gameSessionPhase==='active'}/>
  <GameSessionGate phase={gameSessionPhase} activePlatform={gameSessionPlatform} heartbeatAt={gameSessionHeartbeat} message={gameSessionMessage} onTakeover={()=>void takeOverHere()} onRetry={()=>void retryGameSession()} onLogout={()=>void logoutOnline()}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<GameFeelProvider><App/></GameFeelProvider>);

