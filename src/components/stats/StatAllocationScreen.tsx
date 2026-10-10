import React from 'react';
import type {GameState} from '../../game/types';
import {stats} from '../../game/engine/state';
import {Glyph} from '../../ui/mobile';
export function StatAllocationScreen({game,level,onHome,error}:{game:GameState;level:number|null;onHome:()=>void;error?:string}){
 const current=stats(game);
 const rows=[{id:'attack',name:'공격력',icon:'sword',value:Math.round(current.attack).toLocaleString()},{id:'defense',name:'방어력',icon:'armor',value:Math.round(current.defense).toLocaleString()},{id:'hp',name:'최대 HP',icon:'potion',value:Math.round(current.hp).toLocaleString()},{id:'crit',name:'치명타 확률',icon:'skill',value:((current.critChance??.05)*100).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%'}];
 return <section className="tc-stat-screen" aria-label="스탯 분배">
  <header><button onClick={onHome}>‹ 거점으로</button><h1>스탯 분배</h1><span>{level===null?'Lv. —':`Lv. ${level}`}</span></header>
  <div className="tc-stat-points"><div><small>남은 포인트</small><strong>—</strong></div><span>포인트 지급 규칙 설정 전</span></div>
  {error&&<p role="alert" className="tc-stat-notice">{error}</p>}
  <div className="tc-stat-rows">{rows.map(row=><article className="tc-stat-row" key={row.id}><Glyph name={row.icon}/><div><h2>{row.name}</h2><p>현재 <b>{row.value}</b></p><small>포인트당 증가량 미정</small></div><div className="tc-stat-controls"><button disabled aria-label={row.name+' 배분 줄이기'}>−</button><output aria-label={row.name+' 배분 포인트'}>0</output><button disabled aria-label={row.name+' 배분 늘리기'}>+</button></div></article>)}</div>
  <section className="tc-stat-preview" aria-label="예상 최종 능력치"><h2>예상 최종 능력치</h2><div>{rows.map(row=><p key={row.id}><span>{row.name}</span><b>{row.value} <i>→</i> {row.value}</b></p>)}</div></section>
  <p className="tc-stat-notice">포인트 지급 규칙과 서버 저장 연결 후 배분할 수 있습니다.</p>
  <footer><button disabled>초기화</button><button disabled className="tc-stat-confirm">배분 확정</button></footer>
 </section>;
}
