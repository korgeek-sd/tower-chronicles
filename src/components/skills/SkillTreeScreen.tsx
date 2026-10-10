import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import {GRADES,SKILL_TREE_CATALOG,type TreeWeapon,type TreeType,type TreeSkill} from './catalog';
import {enhancementCost,enhancedSkill,skillEnhancementLevel} from '../../game/skills/enhancement';
import './skillTree.css';
const weapons:[TreeWeapon,string][]=[['sword','검'],['bow','활'],['staff','스태프'],['any','공통']];
const statusNames={learned:'습득 완료',available:'습득 가능',locked:'미습득'};
export const nextSkillSelection=(current:string|null,clicked:string):string|null=>current===clicked?null:clicked;
type Props={game:GameState;onHome:()=>void;initialWeapon?:TreeWeapon;initialType?:TreeType;initialSkillId?:string;onLearn?:(id:string)=>void;onEnhance?:(id:string,expectedLevel:number)=>void;onMarket?:(id:string)=>void;busy?:boolean;error?:string;loginRequired?:boolean;onRefresh?:()=>void};
export function SkillTreeScreen({game,onHome,initialWeapon='sword',initialType='active',initialSkillId,onLearn,onEnhance,onMarket,busy=false,error='',loginRequired=false,onRefresh}:Props){
 const [weapon,setWeapon]=useState<TreeWeapon>(initialWeapon),[type,setType]=useState<TreeType>(initialType),[selection,setSelection]=useState<string|null>(initialSkillId??null),[family,setFamily]=useState<string|null>(SKILL_TREE_CATALOG.find(s=>s.id===initialSkillId)?.family??null),[grade,setGrade]=useState<string>('all');
 const shown=SKILL_TREE_CATALOG.filter(s=>s.weapon===weapon&&s.type===type),families=[...new Set(shown.map(s=>s.family))];
 const activeFamily=family&&families.includes(family)?family:weapon==='any'&&type==='passive'?'all':families[0];
 const visible=shown.filter(s=>(activeFamily==='all'||s.family===activeFamily)&&(grade==='all'||s.grade===grade));
 const skill=visible.find(s=>s.id===selection)??null;
 const learned=(s:TreeSkill)=>game.learned.includes(s.id);
 const books=(s:TreeSkill)=>Math.max(0,Math.floor(game.skillBooks[s.id]??0));
 const status=(s:TreeSkill)=>learned(s)?'learned':books(s)>=1?'available':'locked';
 const level=(s:TreeSkill)=>learned(s)?skillEnhancementLevel(game.skillEnhancements?.[s.id]):0;
 const current=skill?enhancedSkill(skill,level(skill)):null;
 const cost=skill&&learned(skill)?enhancementCost(skill.grade,level(skill)):null;
 const next=skill&&cost?enhancedSkill(skill,cost.level):null;
 const owned=SKILL_TREE_CATALOG.filter(learned).length;
 const reset=()=>{setSelection(null);setFamily(null);setGrade('all');};
 return <section className="tc-skill-tree" aria-label="스킬트리">
  <header className="tc-skill-tree-head"><h1>스킬트리</h1><span>습득 <b>{owned}</b> / 80</span><button onClick={onHome}>거점</button></header>
  <div role="group" className="tc-skill-tree-tabs" aria-label="무기 분류">{weapons.map(([id,name])=><button key={id} aria-pressed={weapon===id} onClick={()=>{setWeapon(id);reset();}}>{name}</button>)}</div>
  <div role="group" className="tc-skill-tree-types" aria-label="스킬 종류">{(['active','passive'] as const).map(id=><button key={id} aria-pressed={type===id} onClick={()=>{setType(id);reset();}}>{id==='active'?'액티브':'패시브'}</button>)}</div>
  <div role="group" className="tc-skill-tree-families" aria-label="스킬 계열">{(weapon==='any'&&type==='passive'?['all',...families]:families).map(id=><button key={id} aria-pressed={activeFamily===id} onClick={()=>{setFamily(id);setSelection(null);}}>{id==='all'?'전체':shown.find(s=>s.family===id)!.familyName}</button>)}<select className="tc-skill-grade-select" aria-label="등급 필터" value={grade} onChange={e=>{setGrade(e.target.value);setSelection(null);}}>{['all',...GRADES].map(id=><option key={id} value={id}>{id==='all'?'전체 등급':id}</option>)}</select></div>
  <div role="group" className="tc-skill-tree-grades" aria-label="등급 필터">{['all',...GRADES].map(id=><button key={id} aria-pressed={grade===id} onClick={()=>{setGrade(id);setSelection(null);}}>{id==='all'?'전체':id}</button>)}</div>
  <div className="tc-skill-codex-grid" aria-label="스킬 도감">{visible.map(s=><button key={s.id} className="tc-skill-codex-card" data-status={status(s)} aria-pressed={skill?.id===s.id} aria-expanded={skill?.id===s.id} aria-label={`${s.name} · ${s.grade} · ${statusNames[status(s)]} · 스킬북 ${books(s)}권`} onClick={()=>setSelection(current=>nextSkillSelection(current,s.id))}>
   <span className="tc-skill-codex-title"><b className="tc-skill-grade" data-grade={s.grade}>{s.grade}</b><strong>{s.name}{learned(s)&&<span className="tc-skill-plus"> +{level(s)}</span>}</strong></span>
   <span className="tc-skill-codex-effect">{enhancedSkill(s,level(s)).effect}</span>
   <span className="tc-skill-codex-meta"><span>{s.type==='active'?`MP ${s.mp}`:'상시 적용'}</span><em>{learned(s)?'습득 · ':''}스킬북 {books(s)}권{game.skills.includes(s.id)?' · 장착':''}</em></span>
  </button>)}{!visible.length&&<p className="tc-skill-codex-empty">이 등급의 스킬이 없습니다.</p>}</div>
  {error&&<div className="tc-skill-learn-message" role="alert">{error}{onRefresh&&<button disabled={busy} onClick={onRefresh}>현황 다시 확인</button>}</div>}
  {skill&&<section className="tc-skill-tree-detail" aria-label="선택한 스킬 상세" aria-live="polite">
   <header><b className="tc-skill-grade" data-grade={skill.grade}>{skill.grade}</b><h2>{skill.name}{learned(skill)&&<span className="tc-skill-plus"> +{level(skill)}</span>}</h2><small>{statusNames[status(skill)]}</small></header>
   <p>{current?.effect}</p>
   <dl><div><dt>{skill.type==='passive'?'효과':'위력'}</dt><dd>{current?.power}</dd></div><div><dt>소모 MP</dt><dd>{skill.mp}</dd></div><div><dt>{skill.type==='passive'?'적용':'발동확률'}</dt><dd>{skill.type==='passive'?'상시':`${skill.chance}%`}</dd></div><div><dt>스킬북</dt><dd>{books(skill)}권</dd></div></dl>
   {learned(skill)&&cost&&next&&<div className="tc-skill-upgrade" aria-label="강화 효과 미리보기"><p>강화 +{cost.level} · 기본 대비 효과 +{cost.bonus}%</p><p>{skill.type==='passive'?'효과':'위력'} {current?.power} → {next.power}</p>{current?.effect!==next.effect&&<p>{next.effect}</p>}</div>}
  </section>}
  {skill&&<footer className="tc-skill-actions" aria-label="스킬 습득 및 강화">
   {learned(skill)?cost?<div className="tc-skill-action-cost"><span>필요: 스킬북 {cost.books}권 · {cost.gold.toLocaleString('ko-KR')} 골드</span><small>보유: {books(skill)}권 · {game.market.gold.toLocaleString('ko-KR')} 골드</small></div>:<p>최대 강화 +3 · 기본 대비 효과 +15%</p>:null}
   <div className="tc-skill-action-buttons">
    {learned(skill)?<button className="tc-skill-enhance" disabled={busy||!onEnhance||!cost||books(skill)<(cost?.books??0)||game.market.gold<(cost?.gold??0)||!!game.expedition} onClick={()=>onEnhance?.(skill.id,level(skill))}>{busy?'처리 중…':!cost?'최대 강화 +3':loginRequired?'로그인 후 강화':game.expedition?'귀환 후 강화 가능':`강화 +${cost.level}`}</button>:<button className="tc-skill-learn" disabled={busy||!onLearn||books(skill)<1||!!game.expedition} onClick={()=>onLearn?.(skill.id)}>{busy?'처리 중…':loginRequired?'로그인 후 습득':game.expedition?'귀환 후 습득 가능':'습득 · 스킬북 1권'}</button>}
    <button className="tc-skill-market" disabled={busy||!onMarket||!!game.expedition} onClick={()=>onMarket?.(skill.id)} aria-label={`${skill.name} 스킬북 거래소`}>거래소</button>
   </div>
  </footer>}
 </section>;
}
