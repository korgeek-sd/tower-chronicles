import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import {Glyph} from '../../ui/mobile';
import {GRADES,SKILL_TREE_CATALOG,type TreeWeapon,type TreeType,type TreeSkill} from './catalog';
import './skillTree.css';
const weapons:[TreeWeapon,string,string][]=[['sword','검','sword'],['bow','활','bow'],['staff','스태프','staff'],['any','공통','skills']];
const statusNames={learned:'습득 완료',available:'습득 재료 보유',locked:'미습득'};
type Props={game:GameState;onHome:()=>void;initialWeapon?:TreeWeapon;initialType?:TreeType};
export function SkillTreeScreen({game,onHome,initialWeapon='sword',initialType='active'}:Props){
 const [weapon,setWeapon]=useState<TreeWeapon>(initialWeapon),[type,setType]=useState<TreeType>(initialType),[selection,setSelection]=useState<string|null>(null),[familyPage,setFamilyPage]=useState(0);
 const shown=SKILL_TREE_CATALOG.filter(s=>s.weapon===weapon&&s.type===type),families=[...new Set(shown.map(s=>s.family))];
 const visibleFamilies=families.slice(familyPage*2,familyPage*2+2);
 const skill=shown.find(s=>s.id===selection&&visibleFamilies.includes(s.family))??shown.find(s=>visibleFamilies.includes(s.family));
 const learned=(s:TreeSkill)=>game.learned.includes(s.id);
 const books=(s:TreeSkill)=>Math.max(0,Math.floor(game.skillBooks[s.id]??0));
 const status=(s:TreeSkill)=>learned(s)?'learned':books(s)>=1?'available':'locked';
 const owned=SKILL_TREE_CATALOG.filter(learned).length;
 const slot=(s:TreeSkill)=>game.skills.indexOf(s.id);
 return <section className="tc-skill-tree" aria-label="스킬트리">
  <header className="tc-skill-tree-head"><div><small>탑의 기록</small><h1>스킬트리</h1></div><span>습득 {owned} <small>/ 80</small></span></header>
  <div className="tc-skill-tree-tabs" aria-label="무기 분류">{weapons.map(([id,name,icon])=><button key={id} aria-pressed={weapon===id} onClick={()=>{setWeapon(id);setSelection(null);setFamilyPage(0);}}><Glyph name={icon}/>{name}</button>)}</div>
  <div className="tc-skill-tree-types" aria-label="스킬 종류">{(['active','passive'] as const).map(id=><button key={id} aria-pressed={type===id} onClick={()=>{setType(id);setSelection(null);setFamilyPage(0);}}>{id==='active'?'액티브':'패시브'}</button>)}<span>{families.length>2?<><button aria-label="이전 스킬 계열" disabled={familyPage===0} onClick={()=>setFamilyPage(p=>p-1)}>‹</button><small>{familyPage+1} / {Math.ceil(families.length/2)}</small><button aria-label="다음 스킬 계열" disabled={familyPage>=Math.ceil(families.length/2)-1} onClick={()=>setFamilyPage(p=>p+1)}>›</button></>:<>{shown.filter(learned).length} / {shown.length}</>}</span></div>
  <div className="tc-skill-tree-collection">
   <div className="tc-skill-tree-grades" aria-hidden="true">{GRADES.map(grade=><span key={grade} data-grade={grade}>{grade}</span>)}</div>
   {visibleFamilies.map(family=><section className="tc-skill-tree-family" key={family} aria-label={shown.find(s=>s.family===family)!.familyName}>
    <h2>{shown.find(s=>s.family===family)!.familyName}</h2>
    <div className="tc-skill-tree-grid">{GRADES.map(grade=>{const s=shown.find(s=>s.family===family&&s.grade===grade);return s?<button key={grade} className="tc-skill-tree-node" data-status={status(s)} data-grade={grade} aria-pressed={skill?.id===s.id} aria-label={`${s.name} · ${grade} · ${statusNames[status(s)]}${slot(s)>=0?' · 장착 중':''}`} onClick={()=>setSelection(s.id)}><span className="tc-skill-tree-placeholder"><Glyph name={s.icon}/><i aria-hidden="true">{learned(s)?'✓':books(s)>=1?'▤':<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"><path d="M4 7V5a4 4 0 0 1 8 0v2M3 7h10v8H3z"/></svg>}</i></span><span className="tc-skill-tree-name">{s.name}</span>{slot(s)>=0&&<b className="tc-skill-tree-equipped">장착</b>}</button>:<div className="tc-skill-tree-empty" key={grade} aria-label={`${grade} 스킬 없음`}>—</div>;})}</div>
   </section>)}
  </div>
  <div className="tc-skill-tree-legend"><span>✓ 습득 완료</span><span>▤ 재료 보유</span><span>잠금 미습득</span></div>
  {skill&&<section className="tc-skill-tree-detail" aria-label="선택한 스킬 상세" aria-live="polite">
   <div className="tc-skill-tree-detail-title"><div className="tc-skill-tree-detail-icon"><Glyph name={skill.icon}/></div><div><small data-grade={skill.grade}>{skill.grade} · {statusNames[status(skill)]}</small><h2>{skill.name}</h2></div></div>
   <dl><div><dt>{skill.type==='passive'?'효과':'위력'}</dt><dd>{skill.power}</dd></div><div><dt>소모 MP</dt><dd>{skill.mp}</dd></div><div><dt>{skill.type==='passive'?'적용':'발동확률'}</dt><dd>{skill.type==='passive'?'상시':`${skill.chance}%`}</dd></div></dl>
   <p>{skill.effect}</p><div className="tc-skill-tree-books"><Glyph name="skillbooks"/><span>스킬북</span><b>{books(skill)} <small>/ {learned(skill)?'보유':'1권 필요'}</small></b></div>
  </section>}
  <footer><button onClick={onHome}><Glyph name="home"/>거점으로</button><span>스킬을 선택해 상세 정보를 확인하세요.</span></footer>
 </section>;
}
