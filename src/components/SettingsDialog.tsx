import React,{useEffect,useRef,useState} from 'react';
import{createPortal}from'react-dom';
import{APP_VERSION}from'../storage/repository';
import{DEFAULT_SETTINGS,loadSettings,saveSettings,type GameSettings}from'../settings/preferences';
import{signInWithGoogle,type OnlineSession}from'../online/auth';
import{onlineConfigured}from'../online/config';
import type{CloudSyncStatus}from'../online/cloudSync';
import './settings-dialog.css';
import {CouponPanel} from './CouponPanel';
import {FriendInvitePanel} from './FriendInvitePanel';
const options:[keyof GameSettings,string,string][]=[['shake','화면 흔들림','전투 피격과 SSR 등장 시 흔들림'],['particles','파티클 효과','전투와 등장 연출의 작은 입자 효과'],['ssrReveal','SSR 등장 연출','특별 연출 뒤 획득 결과 공개'],['reducedMotion','간소화 모드','흔들림과 입자를 끄고 SSR 결과 즉시 표시']];
export function SettingsDialog({onClose,session,nickname,syncStatus,syncMessage,onLogout,details,onRewardMail=()=>{}}:{onRewardMail?:()=>void;details?:React.ReactNode;onClose:()=>void;session:OnlineSession|null;nickname?:string;syncStatus:CloudSyncStatus;syncMessage:string;onLogout:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[tab,setTab]=useState<'effects'|'account'|'details'|'coupon'|'invite'>('effects'),[settings,setSettings]=useState(loadSettings),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 function update(next:GameSettings){setSettings(next);setStatus(saveSettings(next)?'설정을 저장했습니다.':'현재 접속에는 적용됐지만 기기에 저장하지 못했습니다.');}
 async function logout(){setBusy(true);try{await onLogout();setStatus('로그아웃했습니다.');}catch{setStatus('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 return createPortal(<dialog className="tc-settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <header><div><small>EXPLORER OPTIONS</small><h2 id="settings-title">설정</h2></div><button aria-label="설정 닫기" disabled={busy} onClick={onClose}>×</button></header>
 <nav aria-label="설정 메뉴" inert={busy}><button aria-pressed={tab==='effects'} onClick={()=>setTab('effects')}>연출</button><button aria-pressed={tab==='account'} onClick={()=>setTab('account')}>계정·정보</button>{details&&<button aria-pressed={tab==='details'} onClick={()=>setTab('details')}>저장·상태</button>}<button aria-pressed={tab==='coupon'} onClick={()=>setTab('coupon')}>쿠폰</button><button aria-pressed={tab==='invite'} onClick={()=>setTab('invite')}>친구 초대</button></nav>
 <section className="tc-settings-body">{tab==='invite'?<FriendInvitePanel key={session?.userId??'guest'} userId={session?.userId??null} onBusy={setBusy} onRewardMail={onRewardMail}/>:tab==='coupon'?<CouponPanel key={session?.userId??'guest'} userId={session?.userId??null} onBusy={setBusy} onRewardMail={onRewardMail}/>:tab==='details'?details:tab==='effects'?<>{options.map(([key,title,description])=><label className="tc-settings-option" key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={settings[key]} disabled={settings.reducedMotion&&(key==='shake'||key==='particles')} onChange={e=>update({...settings,[key]:e.target.checked})}/></label>)}<p>연출 설정은 이 기기에 저장되며 즉시 적용됩니다.</p></>:<><dl><dt>닉네임</dt><dd>{nickname??'게스트'}</dd><dt>계정</dt><dd>{session?.email??(session?'Google 로그인 사용자':'로그인하지 않음')}</dd><dt>저장 상태</dt><dd role="status">{syncStatus==='synced'?'자동 저장 정상':syncStatus==='syncing'?'자동 저장 중':syncStatus==='error'?'저장 확인 필요':'게스트 저장'}<small>{syncMessage}</small></dd><dt>게임 버전</dt><dd>v{APP_VERSION}</dd></dl><p>{session?'게임 진행은 계정에 자동 저장됩니다.':'게스트 진행은 이 기기에 저장됩니다.'}</p>{session?<button className="tc-action" disabled={busy} onClick={()=>void logout()}>{busy?'처리 중…':'로그아웃'}</button>:<button className="tc-action" disabled={!onlineConfigured||busy} onClick={()=>signInWithGoogle()}>Google로 계속하기</button>}</>}</section>
 <div className="tc-settings-status" role="status">{status||'원하는 환경으로 조정하세요.'}</div><footer><button disabled={busy} onClick={()=>update({...DEFAULT_SETTINGS})}>연출 기본값 복원</button><button disabled={busy} onClick={onClose}>닫기</button></footer>
 </dialog>,document.body);
}

