import React,{useRef,useState} from 'react';
import {signInWithGoogle} from '../../online/auth';
import {onlineConfigured} from '../../online/config';
import {APP_VERSION} from '../../storage/repository';
import './start-screen.css';

export function StartScreen({initialError=''}:{initialError?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(initialError);
 const pending=useRef(false);
 async function login(){
  if(pending.current)return;
  pending.current=true;setBusy(true);setError('');
  try{await signInWithGoogle();}
  catch{pending.current=false;setBusy(false);setError('Google 로그인을 시작하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');}
 }
 return <main className="tc-start-screen" aria-label="탑의 기록 시작화면">
  <div className="tc-start-screen__art" style={{'--tc-start-background':`url("${import.meta.env.BASE_URL}assets/intro/start-background.webp")`} as React.CSSProperties} aria-hidden="true"/>
  <div className="tc-start-screen__shade" aria-hidden="true"/>
  <h1 className="tc-start-screen__logo"><img src={import.meta.env.BASE_URL+'assets/intro/title-logo.webp'} alt="탑의 기록 · TOWER CHRONICLES" fetchPriority="high"/></h1>
  <section className="tc-start-screen__actions" aria-label="계정 로그인">
   <button type="button" className="tc-start-screen__google" disabled={busy||!onlineConfigured} aria-busy={busy} onClick={()=>void login()}>
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.89 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
    <span>{busy?'Google 계정으로 연결 중…':'Google로 로그인'}</span>
   </button>
   <p className="tc-start-screen__caption">Google 계정으로 기록을 이어갑니다.</p>
   <div className="tc-start-screen__error" role="alert">{error||(!onlineConfigured?'로그인 연결을 준비하고 있습니다. 잠시 후 다시 접속해 주세요.':'')}</div>
  </section>
  <footer className="tc-start-screen__footer"><span>v{APP_VERSION}</span><span>STUDIO 0322</span></footer>
 </main>;
}
