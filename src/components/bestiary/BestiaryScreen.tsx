import React,{useMemo,useState} from 'react';
import type {GameState,Tower} from '../../game/types';
import {TOWERS,towerIds} from '../../game/data/config';
import {BESTIARY_ENTRIES,bestiaryEntriesForTower} from '../../game/data/bestiary';
import {assetUrl,graphicFor} from '../../game/data/graphics';
import {bestiaryDiscoveredCount,bestiaryEntryView} from './presentation';

const skillKind:Record<string,string>={damage:'공격',charge:'준비 공격',reactive_prepare:'반격 준비',effect:'상태 효과'};

export function BestiaryScreen({game,onBack}:{game:GameState;onBack:()=>void}){
  const [tower,setTower]=useState<Tower>('ore');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const entries=useMemo(()=>bestiaryEntriesForTower(tower),[tower]);
  const selectedEntry=entries.find(entry=>entry.id===selectedId)??null;
  const selected=selectedEntry?bestiaryEntryView(game,selectedEntry):null;
  const discoveredAll=bestiaryDiscoveredCount(game,BESTIARY_ENTRIES);

  const changeTower=(next:Tower)=>{setTower(next);setSelectedId(null);};

  return <div className="bestiary-screen">
    <button className="back" onClick={onBack}>← 거점</button>
    <div className="section-label">ASSOCIATION FIELD RECORD / 06</div>
    <div className="bestiary-heading">
      <div><h1>탐사 생물록</h1><p>협회가 확인한 탑 생물의 조우·처치 기록입니다.</p></div>
      <strong>{discoveredAll} / {BESTIARY_ENTRIES.length}<small>확인</small></strong>
    </div>

    <div className="bestiary-tabs" role="tablist" aria-label="탑별 생물록">
      {towerIds.map(id=>{
        const list=bestiaryEntriesForTower(id),found=bestiaryDiscoveredCount(game,list);
        return <button key={id} role="tab" aria-selected={tower===id} disabled={!list.length} onClick={()=>changeTower(id)}>
          <span>{TOWERS[id].icon}</span>
          <strong>{TOWERS[id].name}</strong>
          <small>{list.length?found+' / '+list.length:'준비 중'}</small>
        </button>;
      })}
    </div>

    {!entries.length?<section className="panel bestiary-empty"><h2>{TOWERS[tower].name}</h2><p>아직 협회 생물 기록이 등록되지 않았습니다.</p></section>:
    <div className="bestiary-grid">
      {entries.map(entry=>{
        const view=bestiaryEntryView(game,entry),known=view.knowledge!=='UNKNOWN',graphic=known?graphicFor(entry.tower,{name:entry.name}):undefined;
        return <button key={entry.id} className={'bestiary-card '+(selectedId===entry.id?'selected ':'')+'knowledge-'+view.knowledge.toLowerCase()} onClick={()=>setSelectedId(entry.id)}>
          <div className="bestiary-art">
            {graphic?.image.idle?<img src={assetUrl(graphic.image.idle)} alt=""/>:<span aria-hidden="true">?</span>}
          </div>
          <div>
            <small>{entry.boss?'BOSS':'NORMAL'} · {known?view.floorLabel:'층 기록 미확인'}</small>
            <strong>{view.displayName}</strong>
            <span>{known?'조우 '+view.encounters+' · 처치 '+view.defeats:'아직 조우하지 않음'}</span>
          </div>
        </button>;
      })}
    </div>}

    {selectedEntry&&selected&&<section className="bestiary-detail">
      <div className="bestiary-detail-heading">
        <div>
          <small>{selected.boss?'보스 개체':'일반 개체'} · {TOWERS[selectedEntry.tower].name}</small>
          <h2>{selected.displayName}</h2>
          <p>{selected.knowledge==='UNKNOWN'?'직접 조우하면 기본 기록이 공개됩니다.':selected.floorLabel+' · 조우 '+selected.encounters+'회 · 처치 '+selected.defeats+'회'}</p>
        </div>
        <button onClick={()=>setSelectedId(null)} aria-label="상세 기록 닫기">×</button>
      </div>

      {selected.knowledge==='UNKNOWN'?<div className="bestiary-lock-note">미확인 기록 · 이름, 외형, 출현층이 잠겨 있습니다.</div>:
       selected.knowledge==='ENCOUNTERED'?<div className="bestiary-lock-note">1회 처치하면 고유 스킬 이름이 기록됩니다.</div>:
       <>
        <h3>전투 기록</h3>
        {selected.skills.length?<div className="bestiary-skills">{selected.skills.map(skill=><article key={skill.id}>
          <div><strong>{skill.name}</strong><span>{skillKind[skill.kind]??skill.kind}</span></div>
          {selected.knowledge==='MASTERED'?<>
            <p>{skill.description}</p>
            <small>기본 대기 {skill.cooldown}턴</small>
            {skill.conditions.length>0&&<ul>{skill.conditions.map(condition=><li key={condition}>{condition}</li>)}</ul>}
          </>:<p className="locked-copy">상세 설명 잠김 · 일반 개체 3회 처치 시 공개</p>}
        </article>)}</div>:<p className="muted">현재 협회 기록에 별도 고유 스킬이 등록되지 않은 개체입니다.</p>}
        {selected.knowledge==='DEFEATED'&&!selected.boss&&<div className="bestiary-lock-note">일반 개체를 총 3회 처치하면 스킬 설명·대기시간·행동 조건이 공개됩니다.</div>}
       </>}
    </section>}
  </div>;
}
