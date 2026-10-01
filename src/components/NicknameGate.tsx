import React,{useRef,useState} from 'react';
import {validateNickname,type PlayerProfile} from '../online/playerProfiles';
type Props={status:'loading'|'missing'|'error';error:string;onRegister:(nickname:string)=>Promise<PlayerProfile>;onReady:(profile:PlayerProfile)=>void;onRetry:()=>void;onLogout:()=>void};
export function NicknameGate({status,error,onRegister,onReady,onRetry,onLogout}:Props){
 const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),submitting=useRef(false);
 const validation=validateNickname(value);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(submitting.current||validation.error)return;
  submitting.current=true;setBusy(true);setSaveError('');
  try{onReady(await onRegister(validation.nickname));}catch(e){setSaveError(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');}finally{submitting.current=false;setBusy(false);}
 }
 return <main className="tc-nickname-gate"><section aria-labelledby="nickname-title">
  <small>TOWER CHRONICLES · 모험가 등록</small><h1 id="nickname-title">당신의 이름을 남겨주세요</h1>
  {status==='loading'?<p role="status">계정 정보를 확인하고 있습니다.</p>:status==='error'?<><p role="alert">{error}</p><button onClick={onRetry}>다시 확인</button></>:<form onSubmit={submit}>
   <p>다른 모험가에게 보여질 닉네임을 정해주세요.</p>
   <label htmlFor="player-nickname">닉네임</label>
   <input id="player-nickname" value={value} onChange={e=>{setValue(e.target.value);setSaveError('');}} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={24} disabled={busy} aria-describedby="nickname-rule nickname-error"/>
   <small id="nickname-rule">한글·영문·숫자 2~12자 · 중복 불가<br/>영문 대소문자는 구분하지 않으며, 등록 후에는 변경할 수 없습니다.</small>
   <p id="nickname-error" role="status">{saveError||(value?validation.error:'')||'\u00a0'}</p>
   <button type="submit" disabled={busy||!!validation.error}>{busy?'등록 중…':'닉네임 등록하고 시작'}</button>
  </form>}
  <button className="tc-nickname-logout" onClick={onLogout} disabled={busy}>로그아웃</button>
 </section></main>;
}
