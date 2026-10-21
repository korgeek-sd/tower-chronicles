import React,{useEffect,useState} from 'react';
import './start-screen.css';
import './entry-connection.css';
export type EntryStage='account'|'session'|'record';
const stages:[EntryStage,string][]=[['account','계정 확인'],['session','접속 권한 확인'],['record','기록 불러오기']];
export function connectionErrorMessage(error:unknown){
 const text=error instanceof Error?error.message:String(error??'');
 if(/로그인|AUTH_|session.*expired/i.test(text))return '로그인 상태를 확인하지 못했습니다. 다시 시도하거나 로그아웃 후 로그인해 주세요.';
 if(/timeout|timed out|시간.*초과/i.test(text))return '서버 응답이 늦어 연결을 마치지 못했습니다. 잠시 후 다시 시도해 주세요.';
 return '서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
}
export function EntryConnectionScreen({stage,error='',onRetry,onLogout}:{stage:EntryStage;error?:string;onRetry:()=>void;onLogout:()=>void}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{setSlow(false);if(error)return;const timer=window.setTimeout(()=>setSlow(true),15000);return()=>window.clearTimeout(timer);},[stage,error]);
 const index=stages.findIndex(([key])=>key===stage);
 const title=error?'접속을 완료하지 못했습니다':stage==='account'?'계정 확인 중':stage==='session'?'접속 권한 확인 중':'기록을 불러오는 중';
 const base=(import.meta as ImportMeta&{env?:{BASE_URL?:string}}).env?.BASE_URL??'./';
 return <main className="tc-start-screen tc-entry-connection" aria-label="게임 접속 상태">
  <img className="tc-start-screen__art" src={base+'assets/intro/start-background-pixel.webp'} alt="" aria-hidden="true"/>
  <div className="tc-start-screen__shade" aria-hidden="true"/>
  <h1 className="tc-start-screen__logo"><img src={base+'assets/intro/title-logo.webp'} alt="탑의 기록"/></h1>
  <section className="tc-entry-connection__panel" aria-labelledby="entry-connection-title" aria-busy={!error}>
   <h2 id="entry-connection-title">{title}</h2>
   <ol aria-label="접속 단계">{stages.map(([key,label],i)=><li key={key} aria-current={key===stage?'step':undefined} data-state={i<index?'done':i===index?'current':'pending'}><span aria-hidden="true">{i<index?'✓':i+1}</span>{label}</li>)}</ol>
   {error?<p role="alert">{error}</p>:<p role="status">{slow?'응답이 지연되고 있습니다. 연결 상태를 확인하고 잠시 기다려 주세요.':'저장된 기록을 안전하게 확인하고 있습니다.'}</p>}
   {error&&<button className="tc-entry-connection__retry" type="button" onClick={onRetry}>다시 시도</button>}
   <button className="tc-entry-connection__logout" type="button" onClick={onLogout}>로그아웃</button>
  </section>
 </main>;
}
