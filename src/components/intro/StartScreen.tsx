import React,{useRef,useState} from 'react';
import {signInWithGoogle,signOutOnline,getFreshSession,getStoredSession,type OnlineSession} from '../../online/auth';
import {GAME_SERVERS,loadPreferredServer,resolveServer,savePreferredServer} from './serverSelection';
import {onlineConfigured} from '../../online/config';
import {APP_VERSION} from '../../storage/repository';
import './start-screen.css';
import {connectionErrorMessage} from './EntryConnectionScreen';
import {StartNotices} from './StartNotices';
import {StartAtmosphere} from './StartAtmosphere';

export function StartScreen({initialError='',session,onEnter}:{initialError?:string;session:OnlineSession|null;onEnter:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(initialError);
 const pending=useRef(false);
 const [noticesOpen,setNoticesOpen]=useState(false);
 const [checking,setChecking]=useState(false),[entryFailed,setEntryFailed]=useState(false);
 async function enter(){
  if(pending.current)return;pending.current=true;setBusy(true);setChecking(true);setEntryFailed(false);setError('');
  try{
   const fresh=await getFreshSession();
   if(!fresh){if(!getStoredSession())window.dispatchEvent(new Event('tower:session-changed'));throw Error('로그인 상태를 확인하지 못했습니다. 다시 시도하거나 Google로 로그인해 주세요.');}
   if(fresh.userId!==session?.userId){window.dispatchEvent(new Event('tower:session-changed'));throw Error('계정이 변경됐습니다. 선택된 계정으로 다시 입장해 주세요.');}
   savePreferredServer(server.id,localStorage);onEnter();
  }catch(e){setEntryFailed(true);setError(e instanceof Error&&/^[가-힣]/.test(e.message)?e.message:connectionErrorMessage(e));}
  finally{pending.current=false;setBusy(false);setChecking(false);}
 }
 const [server,setServer]=useState(()=>loadPreferredServer(localStorage));
 function selectServer(id:string){const selected=resolveServer(id);setServer(selected);savePreferredServer(selected.id,localStorage);}
 async function logout(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{await signOutOnline();}
  catch{setError('연결 상태를 확인한 뒤 다시 로그인해 주세요.');}
  finally{pending.current=false;setBusy(false);window.dispatchEvent(new Event('tower:session-changed'));}
 }
 async function login(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{await signInWithGoogle();}
  catch{pending.current=false;setBusy(false);setError('Google 로그인을 시작하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');}
 }
 return <main className="tc-start-screen" aria-label="탑의 기록 시작화면">
  <img className="tc-start-screen__art" src={import.meta.env.BASE_URL+'assets/intro/start-background-pixel.webp'} alt="" aria-hidden="true" fetchPriority="high"/>
  <div className="tc-start-screen__shade" aria-hidden="true"/>
  <StartAtmosphere paused={noticesOpen||busy}/>
  <h1 className="tc-start-screen__logo"><img src={import.meta.env.BASE_URL+'assets/intro/title-logo.webp'} alt="탑의 기록 · TOWER CHRONICLES" fetchPriority="high"/></h1>
  <section className="tc-start-screen__actions" aria-label="계정 로그인">
   <label className="tc-start-screen__server"><span>서버 선택</span><select value={server.id} disabled={busy} onChange={event=>selectServer(event.target.value)}>{GAME_SERVERS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   {session?<>
    <button type="button" className="tc-start-screen__enter" disabled={busy||!onlineConfigured} aria-busy={checking} onClick={()=>void enter()}>{checking?'계정 확인 중…':entryFailed?'다시 시도':'탑에 들어가기'}</button>
    <div className="tc-start-screen__account"><span>{session.email??'Google 계정 연결됨'}</span><button type="button" disabled={busy} onClick={()=>void logout()}>로그아웃</button></div>
   </>:<><button type="button" className="tc-start-screen__google" disabled={busy||!onlineConfigured} aria-busy={busy} onClick={()=>void login()}>
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.89 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
    <span>{busy?'Google 계정으로 연결 중…':'Google로 로그인'}</span>
   </button>
   <p className="tc-start-screen__caption">Google 계정으로 기록을 이어갑니다.</p></>}
   <div className="tc-start-screen__error" role="alert">{error||(!onlineConfigured?'로그인 연결을 준비하고 있습니다. 잠시 후 다시 접속해 주세요.':'')}</div>
  </section>
  <footer className="tc-start-screen__footer"><span>v{APP_VERSION}</span><button type="button" className="tc-start-screen__notices" disabled={busy} aria-haspopup="dialog" onClick={()=>setNoticesOpen(true)}>공지사항</button><span>STUDIO 0322</span></footer>
  <StartNotices open={noticesOpen} onClose={()=>setNoticesOpen(false)}/>
 </main>;
}
