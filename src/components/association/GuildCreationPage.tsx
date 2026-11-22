import React from 'react';
import type {AssociationPolicy} from '../../game/types';
import {ASSOCIATION_CREATION_FEE_SILVER} from '../../game/association/service';
import {Screen} from '../../ui/mobile';
import {GuildEmblem,GuildEmblemEditor,type GuildEmblemData} from './GuildEmblem';
import './guildCreationPage.css';

type CharterPolicy=Extract<AssociationPolicy,'APPROVAL'|'OPEN'>;
type Props={
 name:string;setName:(name:string)=>void;
 description:string;setDescription:(description:string)=>void;
 policy:CharterPolicy;setPolicy:(policy:CharterPolicy)=>void;
 emblem:GuildEmblemData;setEmblem:(emblem:GuildEmblemData)=>void;
 silver:number;busy?:boolean;error?:string;blockedReason?:string;
 onBack:()=>void;onSubmit:()=>void;isLocal?:boolean;
};

export function GuildCreationPage({
 name,setName,description,setDescription,policy,setPolicy,emblem,setEmblem,
 silver,busy=false,error='',blockedReason='',onBack,onSubmit,isLocal=false
}:Props){
 const trimmed=name.trim();
 const canCreate=!busy&&!blockedReason&&trimmed.length>=2&&trimmed.length<=20&&silver>=ASSOCIATION_CREATION_FEE_SILVER;
 const missingSilver=silver<ASSOCIATION_CREATION_FEE_SILVER;
 return <Screen className="tc-guild-create-screen" hideHeader title="원정단 창설">
  <div className="tc-guild-create-layout">
   <div className="tc-guild-create-scroll">
    <header className="tc-guild-create-header">
     <button type="button" onClick={onBack} aria-label="원정단 목록으로 돌아가기">‹ <span>뒤로</span></button>
     <div><small>ASSOCIATION CHARTER</small><h1>원정단 창설</h1></div>
     <span className="tc-guild-create-wallet">Silver {silver.toLocaleString('ko-KR')}</span>
    </header>
    <section className="tc-guild-create-summary" aria-label="원정단 정보 미리보기">
     <div className="tc-guild-create-banner"><GuildEmblem value={emblem} size={100} label="원정단 문장"/><span>창설 문장</span></div>
     <div className="tc-guild-create-summary-detail">
      <strong>원정단 정보 <small>미리보기</small></strong>
      <dl><div><dt>원정단명</dt><dd>{trimmed||'아직 설정되지 않음'}</dd></div>
       <div><dt>소개</dt><dd>{description.trim()||'원정단 소개를 입력해 주세요.'}</dd></div>
       <div><dt>가입 방식</dt><dd>{policy==='OPEN'?'자유 가입':'승인 가입'}</dd></div></dl>
     </div>
    </section>
    <section className="tc-guild-create-form" aria-label="원정단 정보 입력">
     <h2>원정단 정보</h2>
     <label htmlFor="tc-charter-name"><span>원정단명 <em>필수</em></span><div className="tc-guild-create-input"><input id="tc-charter-name" value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="원정단 이름 (2~20자)" autoComplete="off"/><small>{name.length}/20</small></div></label>
     <label htmlFor="tc-charter-description"><span>소개</span><div className="tc-guild-create-input"><textarea id="tc-charter-description" value={description} maxLength={120} rows={3} onChange={e=>setDescription(e.target.value)} placeholder="원정단을 소개하는 문구를 입력해 주세요."/><small>{description.length}/120</small></div></label>
     <fieldset className="tc-guild-create-policy"><legend>가입 방식</legend><div>
      <button type="button" aria-pressed={policy==='OPEN'} className={policy==='OPEN'?'active':''} onClick={()=>setPolicy('OPEN')}><b>자유 가입</b><small>누구나 즉시 가입할 수 있습니다.</small></button>
      <button type="button" aria-pressed={policy==='APPROVAL'} className={policy==='APPROVAL'?'active':''} onClick={()=>setPolicy('APPROVAL')}><b>승인 가입</b><small>단장의 승인 후 가입합니다.</small></button>
     </div></fieldset>
    </section>
    <GuildEmblemEditor value={emblem} onChange={setEmblem} disabled={busy} layout="charter"/>
    <p className="tc-guild-create-note">원정단 이름과 문장을 확인한 뒤 창설해 주세요. {isLocal?'게스트 모드에서는 이 기기에만 저장됩니다.':'창설 후 문장은 서버에 저장됩니다.'}</p>
    {blockedReason&&<p className="tc-guild-create-blocked" role="status">{blockedReason}</p>}
    {missingSilver&&<p className="tc-guild-create-blocked" role="status">등록금이 부족합니다. 1,000 Silver가 필요합니다.</p>}
   </div>
   <footer className="tc-guild-create-footer">
    <div className="tc-guild-create-cost"><span>창설 비용</span><strong>{ASSOCIATION_CREATION_FEE_SILVER.toLocaleString('ko-KR')} Silver</strong></div>
    <button type="button" disabled={!canCreate} onClick={onSubmit}>{busy?'창설 처리 중…':'원정단 창설하기'}</button>
    {error&&<p role="alert">{error}</p>}
   </footer>
  </div>
 </Screen>;
}
