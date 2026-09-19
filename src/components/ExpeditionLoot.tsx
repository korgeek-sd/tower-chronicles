import type {Expedition,ExpeditionLoot,ExpeditionResult} from '../game/types';
import {POTIONS,potionIds,generalPotionIds} from '../game/data/config';
import {lootLines,lootTotals} from '../game/engine/loot';
import {summarizeEvents,analyzeDeath} from './battle/report';
import type {DeathSnapshot} from './battle/report';
import {SKILLS} from '../game/data/config';
import type {GameState} from '../game/types';
export interface BattleTally{skills:Record<string,number>;potions:Record<string,number>;playerTurns:number;monsterTurns:number}
export const emptyTally=():BattleTally=>({skills:{},potions:{},playerTurns:0,monsterTurns:0});
export const duration=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
function LootDetails({loot}:{loot:ExpeditionLoot}){
  const lines=lootLines(loot);
  return <ul className="loot-lines">{lines.length?lines.map(line=><li key={line}>{line}</li>):<li className="muted">획득한 전리품 없음</li>}</ul>;
}
export function ExpeditionLootPanel({expedition:e}:{expedition:Expedition}){
  const totals=lootTotals(e.loot);
  return <section className="panel expedition-loot" aria-label="이번 원정 획득물">
    <div className="section-heading"><h2>이번 원정 획득물</h2><span className="badge">임시 보관</span></div>
    <div className="mini-stats"><span>사냥 시간 <b>{duration(e.time)}</b></span><span>처치 <b>{e.kills}</b>마리</span></div>
    <div className="loot-grid">
      <div><small>Silver</small><b>+{e.loot.silver.toLocaleString()}</b></div>
      <div><small>재료</small><b>{totals.materials}개</b></div>
      <div><small>입장권</small><b>{totals.tickets}장</b></div>
    </div>
    <details><summary>전리품 상세 보기</summary><LootDetails loot={e.loot}/></details>
    <div className="healing-stock">남은 회복 포션 <span>{generalPotionIds.map(p=>POTIONS[p].name+' '+e.bag[p]).join(' · ')} · 회생 {e.bag.revival}</span></div>
    <p className="risk-note"><strong>아직 확보되지 않은 전리품입니다.</strong> 안전 귀환 시 보관함에 저장되며 사망하면 모두 잃습니다.</p>
  </section>;
}
export function ExpeditionResultPanel({result:r,game,tally,deathSnap}:{result:ExpeditionResult;game?:GameState;tally?:BattleTally;deathSnap?:DeathSnapshot|null}){
    const dead=r.outcome==='dead';
  const summary=game?summarizeEvents(game.combatEvents??[]):null;
  const potionsUsed=game?potionIds.map(p=>({p,used:Math.max(0,(game.loadout[p]??0)-(r.remainingPotions[p]??0))})).filter(x=>x.used>0):[];
  const skillEntries=Object.entries(tally?.skills??{});
  const skillName=(id:string)=>SKILLS.find(s=>s.id===id)?.name??id;
  const lastPlayerEvent=game?[...(game.combatEvents??[])].reverse().find(e=>e.target==='player'):undefined;
  const deathHints=dead&&deathSnap?analyzeDeath({lastEvent:lastPlayerEvent,snap:deathSnap}):[];
  return <section className={'panel settlement '+(dead?'failed':'')} aria-label={dead?'원정 실패 결과':'안전 귀환 결과'}>
    <div className="section-heading"><h2>{dead?'원정 실패':'안전 귀환'}</h2><span>{duration(r.time)} · {r.kills}마리 처치</span></div>
    <p>{dead?'이번 원정에서 획득한 전리품을 모두 잃었습니다.':'이번 원정의 전리품이 보관함에 저장되었습니다.'}</p>
    <h3>{dead?'손실 전리품':'보관한 전리품'}</h3><LootDetails loot={r.loot}/>
    <h3>{dead?'소멸한 남은 원정 포션':'창고로 돌려보낸 포션'}</h3>
    <ul className="loot-lines">{potionIds.filter(p=>r.remainingPotions[p]>0).map(p=><li key={p}>{POTIONS[p].name} 포션 ×{r.remainingPotions[p]}</li>)}
    {!potionIds.some(p=>r.remainingPotions[p]>0)&&<li className="muted">남아 있던 포션 없음</li>}</ul>
        {summary&&<section aria-label="전투 결과 리포트"><h3>전투 결과 리포트</h3><div className="mini-stats"><span>준 피해 <b>{summary.dealt}</b></span><span>받은 피해 <b>{summary.taken}</b></span><span>치명타 <b>{summary.critCount}회</b></span><span>최대 피해 <b>{summary.maxHit}</b></span></div><div className="mini-stats"><span>보호막 흡수 <b>{summary.shieldAbsorbed}</b></span><span>타격 <b>{summary.hits}회</b></span>{tally&&(tally.playerTurns>0||tally.monsterTurns>0)&&<span>턴 <b>나 {tally.playerTurns} · 적 {tally.monsterTurns}</b></span>}</div>{skillEntries.length>0&&<p className="muted">사용 기술 · {skillEntries.map(([id,n])=>skillName(id)+' ×'+n).join(' · ')}</p>}{potionsUsed.length>0&&<p className="muted">사용 포션 · {potionsUsed.map(x=>POTIONS[x.p].name+' ×'+x.used).join(' · ')}</p>}<p className="muted">최근 {summary.hits}타 기준 집계입니다.</p></section>}
    {dead&&deathSnap&&<section aria-label="사망 분석"><h3>사망 분석</h3>{lastPlayerEvent?<p>마지막 피해 · <b>{deathSnap.monsterName}</b>에게 {lastPlayerEvent.hpDamage} 피해{lastPlayerEvent.critical?' · 치명타':''}{lastPlayerEvent.absorbedByShield>0?' · 보호막 '+lastPlayerEvent.absorbedByShield+' 흡수':''}</p>:<p>마지막 타격 기록이 없습니다.</p>}{deathSnap.effects.length>0&&<p className="muted">사망 직전 상태 · {deathSnap.effects.map(e=>e.effectId).join(' · ')}</p>}<ul className="loot-lines">{deathHints.map(h=><li key={h.id}>{h.text}</li>)}</ul></section>}
    <p className="muted">{dead?'기존 Silver·보관함·장비·배운 스킬은 유지됩니다.':'원정 전리품은 안전 귀환 시 보관함에 저장됩니다.'} 입장에 사용한 입장권은 반환되지 않습니다.</p>
  </section>;
}

