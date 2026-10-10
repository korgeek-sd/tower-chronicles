import React from 'react';
import type {GameState} from '../../game/types';
import {stats} from '../../game/engine/state';
import {applyStatAllocation,normalizeStatAllocation,statPointsForLevel,statResetCost,usedStatPoints,type CombatStats,type StatAllocation} from '../../game/hunting/model';
import {Glyph} from '../../ui/mobile';

type Props={game:GameState;level:number|null;allocation?:StatAllocation;remaining?:number;resets?:number;combatStats?:CombatStats;busy?:boolean;onHome:()=>void;onConfirm?:(value:StatAllocation)=>void;onReset?:()=>void;error?:string};
const FIELDS=[
 {id:'hp' as const,name:'최대 HP',icon:'potion',gain:'+12'},
 {id:'attack' as const,name:'공격력',icon:'sword',gain:'+1'},
 {id:'defense' as const,name:'방어력',icon:'armor',gain:'+2'},
 {id:'crit' as const,name:'치명타 확률',icon:'skill',gain:'+2%p'},
];
export function StatAllocationScreen({game,level,allocation,remaining,resets=0,combatStats,busy=false,onHome,onConfirm,onReset,error}:Props){
 const saved=normalizeStatAllocation(allocation);
 const [draft,setDraft]=React.useState<StatAllocation>(saved);
 React.useEffect(()=>setDraft(saved),[saved.hp,saved.attack,saved.defense,saved.crit]);
 const base=combatStats??stats(game);
 const available=remaining??(level===null?0:Math.max(0,statPointsForLevel(level)-usedStatPoints(saved)));
 const drafted=usedStatPoints(draft)-usedStatPoints(saved);
 const canEdit=level!==null&&!busy;
 const cost=statResetCost(level??1,resets);
 const preview=applyStatAllocation({hp:base.hp,attack:base.attack,defense:base.defense,critChance:base.critChance}, {
  hp:draft.hp-saved.hp,attack:draft.attack-saved.attack,defense:draft.defense-saved.defense,crit:draft.crit-saved.crit
 });
 const display=(id:keyof StatAllocation,value:number)=>id==='crit'?((value??0)*100).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%':Math.round(value).toLocaleString('ko-KR');
 const valueOf=(id:keyof StatAllocation,p:typeof preview)=>id==='hp'?p.hp:id==='crit'?p.critChance??.05:p[id];
 const change=(id:keyof StatAllocation,delta:number)=>setDraft(prev=>({...prev,[id]:prev[id]+delta}));
 return <section className="tc-stat-screen" aria-label="스탯 분배">
  <header><button onClick={onHome}>‹ 거점으로</button><h1>스탯 분배</h1><span>{level===null?'Lv. —':`Lv. ${level}`}</span></header>
  <div className="tc-stat-points"><div><small>남은 스탯 포인트</small><strong>{Math.max(0,available-drafted)}</strong></div><span>레벨업마다 +1 PT</span></div>
  {error&&<p className="tc-stat-notice" role="alert">{error}</p>}
  <div className="tc-stat-rows">{FIELDS.map(field=><article className="tc-stat-row" key={field.id}>
   <Glyph name={field.icon}/><div><h2>{field.name}</h2><p>현재 <b>{display(field.id,valueOf(field.id,base))}</b></p><small>1 PT 당 {field.gain}{field.id==='crit'?' · 최대 10 PT':''}</small></div>
   <div className="tc-stat-controls"><button disabled={!canEdit||draft[field.id]<=saved[field.id]} aria-label={field.name+' 배분 줄이기'} onClick={()=>change(field.id,-1)}>−</button><output aria-label={field.name+' 배분 포인트'}>{draft[field.id]}</output><button disabled={!canEdit||drafted>=available||(field.id==='crit'&&draft.crit>=10)} aria-label={field.name+' 배분 늘리기'} onClick={()=>change(field.id,1)}>+</button></div>
  </article>)}</div>
  <section className="tc-stat-preview" aria-label="예상 최종 능력치"><h2>예상 최종 능력치</h2><div>{FIELDS.map(field=><p key={field.id}><span>{field.name}</span><b>{display(field.id,valueOf(field.id,base))} <i>→</i> {display(field.id,valueOf(field.id,preview))}</b></p>)}</div></section>
  <footer><button disabled={!canEdit||usedStatPoints(saved)===0} onClick={onReset}>{resets===0?'무료 초기화':`초기화 ${cost.toLocaleString()} 실버`}</button><button disabled={!canEdit||drafted===0} className="tc-stat-confirm" onClick={()=>onConfirm?.(draft)}>{busy?'저장 중…':'배분 확정'}</button></footer>
 </section>;
}
