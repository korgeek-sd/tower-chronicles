import React,{useEffect,useRef,useState} from 'react';
import{createPortal}from'react-dom';
import{APP_VERSION}from'../storage/repository';
import{DEFAULT_SETTINGS,loadSettings,saveSettings,type GameSettings}from'../settings/preferences';
import{signInWithGoogle,type OnlineSession}from'../online/auth';
import{onlineConfigured}from'../online/config';
import type{CloudSyncStatus}from'../online/cloudSync';
import './settings-dialog.css';
import {CouponPanel} from './CouponPanel';
import {readMusicPreferences,saveMusicPreferences,type MusicPreferences} from '../audio/backgroundMusic';
import {readEffectSoundSettings,saveEffectSoundSettings,playGameEffect,type GameEffectSettings} from '../audio/gameEffects';
import {readSummonSoundPreferences,saveSummonSoundPreferences,unlockSsrSound,playSummonRarityReveal,type SummonSoundPreferences} from './appearance/ssrSound';
import {FriendInvitePanel} from './FriendInvitePanel';
const options:[keyof GameSettings,string,string][]=[['shake','화면 흔들림','전투 피격과 SSR 등장 시 흔들림'],['particles','파티클 효과','전투와 등장 연출의 작은 입자 효과'],['ssrReveal','SSR 등장 연출','특별 연출 뒤 획득 결과 공개'],['reducedMotion','간소화 모드','흔들림과 입자를 끄고 SSR 결과 즉시 표시']];
export function SettingsDialog({onClose,session,nickname,syncStatus,syncMessage,onLogout,details,onRewardMail=()=>{}}:{onRewardMail?:()=>void;details?:React.ReactNode;onClose:()=>void;session:OnlineSession|null;nickname?:string;syncStatus:CloudSyncStatus;syncMessage:string;onLogout:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[tab,setTab]=useState<'effects'|'account'|'details'|'coupon'|'invite'>('effects'),[settings,setSettings]=useState(loadSettings),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[music,setMusic]=useState(readMusicPreferences),[summonSound,setSummonSound]=useState(readSummonSoundPreferences),[gameEffects,setGameEffects]=useState(readEffectSoundSettings),[isFullscreen,setIsFullscreen]=useState(()=>typeof document!=='undefined'&&Boolean(document.fullscreenElement));
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();if(previous?.isConnected)previous.focus();};},[]);
 function update(next:GameSettings){setSettings(next);setStatus(saveSettings(next)?'설정을 저장했습니다.':'현재 접속에는 적용됐지만 기기에 저장하지 못했습니다.');}
 function updateMusic(next:MusicPreferences){setMusic(next);setStatus(saveMusicPreferences(next)?'배경음악 설정을 저장했습니다.':'배경음악은 적용됐지만 기기에 저장하지 못했습니다.');}
 function updateSummonSound(next:SummonSoundPreferences){setSummonSound(next);setStatus(saveSummonSoundPreferences(next)?'소환 효과음 설정을 저장했습니다.':'소환 효과음은 적용됐지만 기기에 저장하지 못했습니다.');}
 function updateGameEffects(next:GameEffectSettings){setGameEffects(next);setStatus(saveEffectSoundSettings(next)?'게임 효과음 설정을 저장했습니다.':'게임 효과음은 적용됐지만 저장하지 못했습니다.');}
 async function login(){if(busy)return;setBusy(true);try{await signInWithGoogle();}catch{setStatus('로그인을 시작하지 못했습니다. 브라우저 저장소 설정을 확인한 뒤 다시 시도해 주세요.');setBusy(false);}}
 async function logout(){setBusy(true);try{await onLogout();setStatus('로그아웃했습니다.');}catch{setStatus('로그아웃하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function toggleFullscreen(){
  try{
   if(!document.fullscreenElement){
    if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    setIsFullscreen(true);
    setStatus('전체화면으로 전환했습니다. (상단바 숨김)');
   }else{
    if(document.exitFullscreen)await document.exitFullscreen();
    setIsFullscreen(false);
    setStatus('전체화면을 종료했습니다.');
   }
  }catch{
   setStatus('현재 브라우저에서는 홈 화면 추가(PWA)로 주소창을 제거할 수 있습니다.');
  }
 }
 return createPortal(<dialog className="tc-settings-dialog" ref={dialog} aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
 <header><div><small>EXPLORER OPTIONS</small><h2 id="settings-title">설정</h2></div><button aria-label="설정 닫기" disabled={busy} onClick={onClose}>×</button></header>
 <nav aria-label="설정 메뉴" inert={busy}><button aria-pressed={tab==='effects'} onClick={()=>setTab('effects')}>연출·화면</button><button aria-pressed={tab==='account'} onClick={()=>setTab('account')}>계정·정보</button>{details&&<button aria-pressed={tab==='details'} onClick={()=>setTab('details')}>저장·상태</button>}<button aria-pressed={tab==='coupon'} onClick={()=>setTab('coupon')}>쿠폰</button><button aria-pressed={tab==='invite'} onClick={()=>setTab('invite')}>친구 초대</button></nav>
 <section className="tc-settings-body">{tab==='invite'?<FriendInvitePanel key={session?.userId??'guest'} userId={session?.userId??null} onBusy={setBusy} onRewardMail={onRewardMail}/>:tab==='coupon'?<CouponPanel key={session?.userId??'guest'} userId={session?.userId??null} onBusy={setBusy} onRewardMail={onRewardMail}/>:tab==='details'?details:tab==='effects'?<><div style={{margin:'4px 0 12px 0',display:'grid',gap:'6px'}}><button type="button" style={{minHeight:'44px',background:isFullscreen?'#3a3324':'#25271f',color:'#f1dab0',border:'1px solid #c7a464',fontWeight:600}} onClick={()=>void toggleFullscreen()}>{isFullscreen?'⛶ 전체화면 모드 종료':'⛶ 전체화면 전환 (주소창 숨기기)'}</button><p style={{margin:0,fontSize:'10px',color:'#aba797'}}>* 브라우저 메뉴의 '홈 화면에 추가'를 하면 상단 URL 없이 단독 앱으로 실행됩니다.</p></div>{options.map(([key,title,description])=><label className="tc-settings-option" key={key}><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={settings[key]} disabled={settings.reducedMotion&&(key==='shake'||key==='particles')} onChange={e=>update({...settings,[key]:e.target.checked})}/></label>)}<label className="tc-settings-option"><span><b>배경음악</b><small>잊혀진 기록 · 40초 반복 테마 · 첫 화면 터치 후 재생</small></span><input type="checkbox" checked={music.enabled} onChange={event=>updateMusic({...music,enabled:event.target.checked})}/></label><label className="tc-settings-option"><span><b>배경음악 음량</b><small>{Math.round(music.volume*100)}% · 효과음과 별개</small></span><input type="range" aria-label="배경음악 음량" min="0" max="100" step="5" value={Math.round(music.volume*100)} disabled={!music.enabled} onChange={event=>updateMusic({...music,volume:Number(event.target.value)/100})}/></label><label className="tc-settings-option"><span><b>게임 효과음</b><small>버튼 · 사냥 · 승리 · 장비 획득 · 레벨업</small></span><input type="checkbox" checked={gameEffects.enabled} onChange={event=>updateGameEffects({...gameEffects,enabled:event.target.checked})}/></label><label className="tc-settings-option"><span><b>게임 효과음 음량</b><small>{Math.round(gameEffects.volume*100)}% · 배경음악과 별개</small></span><input type="range" aria-label="게임 효과음 음량" style={{width:'100%',maxWidth:124}} min="0" max="100" step="5" value={Math.round(gameEffects.volume*100)} disabled={!gameEffects.enabled} onChange={event=>updateGameEffects({...gameEffects,volume:Number(event.target.value)/100})}/></label><button type="button" disabled={!gameEffects.enabled||gameEffects.volume===0} style={{minHeight:40}} onClick={()=>playGameEffect('player.level-up')}>레벨업 효과음 미리 듣기</button><button type="button" className="tc-seal-audio-preview" disabled={!gameEffects.enabled||gameEffects.volume===0} style={{minHeight:40}} onClick={()=>playGameEffect('seal.step-3')}>협회 인장 +3 효과음 미리 듣기</button><label className="tc-settings-option"><span><b>소환 효과음</b><small>소환석 균열 · SR/SSR 등급별 봉인 해제음</small></span><input type="checkbox" checked={summonSound.enabled} onChange={event=>updateSummonSound({...summonSound,enabled:event.target.checked})}/></label><label className="tc-settings-option"><span><b>소환 효과음 음량</b><small>{Math.round(summonSound.volume*100)}% · 배경음악과 별개</small></span><input type="range" aria-label="소환 효과음 음량" style={{width:'100%',maxWidth:124}} min="0" max="100" step="5" value={Math.round(summonSound.volume*100)} disabled={!summonSound.enabled} onChange={event=>updateSummonSound({...summonSound,volume:Number(event.target.value)/100})}/></label><button type="button" style={{minHeight:40}} disabled={!summonSound.enabled||summonSound.volume===0} onClick={()=>{unlockSsrSound();playSummonRarityReveal('SSR');}}>SSR 효과음 미리 듣기</button><p>배경음악과 소환 효과음은 각각 켜고 끌 수 있으며, 이 기기에 저장됩니다.</p></>:<><dl><dt>닉네임</dt><dd>{nickname??'게스트'}</dd><dt>계정</dt><dd>{session?.email??(session?'Google 로그인 사용자':'로그인하지 않음')}</dd><dt>저장 상태</dt><dd role="status">{syncStatus==='synced'?'자동 저장 정상':syncStatus==='syncing'?'자동 저장 중':syncStatus==='error'?'저장 확인 필요':'게스트 저장'}<small>{syncMessage}</small></dd><dt>세계관</dt><dd><button type="button" onClick={()=>{onClose();window.dispatchEvent(new Event('tower:replay-world-intro'));}}>세계관 다시 보기</button></dd><dt>게임 버전</dt><dd>v{APP_VERSION}</dd></dl><p>{session?'게임 진행은 계정에 자동 저장됩니다.':'게스트 진행은 이 기기에 저장됩니다.'}</p>{session?<button className="tc-action" disabled={busy} onClick={()=>void logout()}>{busy?'처리 중…':'로그아웃'}</button>:<button className="tc-action" disabled={!onlineConfigured||busy} onClick={()=>void login()}>Google로 계속하기</button>}</>}</section>
 <div className="tc-settings-status" role="status">{status||'원하는 환경으로 조정하세요.'}</div><footer><button disabled={busy} onClick={()=>update({...DEFAULT_SETTINGS})}>연출 기본값 복원</button><button disabled={busy} onClick={onClose}>닫기</button></footer>
 </dialog>,document.body);
}

