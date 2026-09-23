import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import {SKILLS,WEAPONS} from '../../game/data/config';
import {weaponOf} from '../../game/engine/state';
import {configureSkillSlot} from '../../game/equipmentView';
import {jobById,JOB_CATALOG,JOB_RARITIES,type JobRarity} from '../../game/jobs/catalog';
import {setCurrentJob,resolvePlayerCombatKit} from '../../game/jobs/service';
import {InventoryIcon} from '../inventory/InventoryDetailSheet';

export function CharacterSkills({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [rarity,setRarity]=useState<JobRarity>('C'),job=jobById(game.currentJobId),kit=resolvePlayerCombatKit(game),weapon=weaponOf(game,game.expedition?.equipment);
 return <div className="character-skills">
  <section className="journal-panel job-summary"><span className="journal-eyebrow">현재 직업</span><h2>{job?.displayName??'자유 탐사자'}</h2><p>{job?(job.combatKit?'직업의 고정 전투 스킬을 사용합니다.':'이 직업의 전용 전투 스킬은 준비 중입니다. 현재는 기본 스킬 구성을 사용합니다.'):'선택한 직업이 없습니다. 보유한 기본 스킬로 원정을 준비하세요.'}</p>{job&&<button disabled={!!game.expedition} onClick={()=>setGame(s=>setCurrentJob(s,null))}>직업 선택 해제</button>}</section>
  <div className="journal-section-title"><h2>전투 스킬</h2><small>직접 사용하는 행동 3칸</small></div><p className="journal-description">전투 중 원하는 스킬을 직접 누릅니다. 대기 시간은 내 턴을 기준으로 감소합니다.</p>
  <div className="character-skill-slots">{kit.activeSkillIds.map((id,index)=>{const skill=SKILLS.find(candidate=>candidate.id===id);return <section className="character-skill-slot" key={index}><div className="skill-slot-heading"><span>{String(index+1).padStart(2,'0')}</span><InventoryIcon id={id==='guard'?'armor':id==='quick'?'boots':id==='execute'?'dagger':'sword'}/>{job?.combatKit?<strong>{skill?.name??'준비 중'}</strong>:<select aria-label={(index+1)+'번 전투 스킬'} value={game.skills[index]??''} disabled={!!game.expedition} onChange={event=>setGame(s=>configureSkillSlot(s,index,event.target.value||null))}><option value="">비워두기</option>{SKILLS.filter(candidate=>game.learned.includes(candidate.id)).map(candidate=><option key={candidate.id} value={candidate.id} disabled={game.skills.some((other,i)=>i!==index&&other===candidate.id)}>{candidate.name}</option>)}</select>}</div><p>{skill?(skill.effect==='guard'?'4턴 동안 받는 피해 40% 감소':skill.description):'사용할 스킬을 선택하세요.'}</p>{skill&&<div className="skill-slot-meta"><span>대기 {skill.cooldown}턴</span><span>{skill.weapons.includes(weapon)||job?.combatKit?'사용 가능한 무기':'현재 무기로 사용 불가'}</span></div>}</section>;})}</div>
  <details className="journal-panel job-catalog"><summary>직업 도감 <span>{game.ownedJobIds.length} / {JOB_CATALOG.length} 보유</span></summary><div className="job-rarity-filter" aria-label="직업 등급">{JOB_RARITIES.map(value=><button key={value} aria-pressed={rarity===value} onClick={()=>setRarity(value)}>{value}</button>)}</div>{JOB_CATALOG.filter(candidate=>candidate.rarity===rarity).map(candidate=>{const owned=game.ownedJobIds.includes(candidate.id),selected=candidate.id===game.currentJobId;return <div className="job-catalog-row" key={candidate.id}><div><strong>{candidate.displayName}</strong><small>{candidate.combatKit?'전투 스킬 사용 가능':'전용 전투 스킬 준비 중'}</small></div><button disabled={!!game.expedition||!owned||selected} onClick={()=>setGame(s=>setCurrentJob(s,candidate.id))}>{selected?'선택 중':owned?'선택':'미보유'}</button></div>;})}</details>
 </div>;
}
