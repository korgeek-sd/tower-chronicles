import React,{useMemo,useState} from 'react';
import type {GameState,Tower} from '../../game/types';
import {TOWERS,towerIds} from '../../game/data/config';
import {BESTIARY_ENTRIES,bestiaryEntriesForTower} from '../../game/data/bestiary';
import {assetUrl,graphicFor} from '../../game/data/graphics';
import {bestiaryDiscoveredCount,bestiaryEntryView} from './presentation';
import {Pager,Screen,Segments} from '../../ui/mobile';

const PAGE_SIZE=6;
const towerTabs=towerIds.map(id=>[id,TOWERS[id].name] as [Tower,string]);
const skillKind:Record<string,string>={damage:'공격',charge:'준비',reactive_prepare:'반격',effect:'효과'};

export function BestiaryScreen({game,onBack}:{game:GameState;onBack:()=>void}){
 const [tower,setTower]=useState<Tower>('ore'),[selectedId,setSelectedId]=useState<string|null>(null),[page,setPage]=useState(0);
 const entries=useMemo(()=>bestiaryEntriesForTower(tower),[tower]),pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=entries.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),selectedEntry=entries.find(e=>e.id===selectedId)??null,selected=selectedEntry?bestiaryEntryView(game,selectedEntry):null;
 return <Screen eyebrow="ASSOCIATION FIELD RECORD" title="탐사 생물록" meta={<><span>{bestiaryDiscoveredCount(game,BESTIARY_ENTRIES)}/{BESTIARY_ENTRIES.length}</span><button className="tc-action secondary slim" onClick={onBack}>닫기</button></>}>
  <div className="tc-bestiary">
   <Segments items={towerTabs} value={tower} onChange={v=>{setTower(v);setSelectedId(null);setPage(0);}} label="탑별 생물록"/>
   <div className="tc-bestiary-grid">{shown.map(entry=>{const view=bestiaryEntryView(game,entry),known=view.knowledge!=='UNKNOWN',graphic=known?graphicFor(entry.tower,{name:entry.name}):undefined;return <button key={entry.id} className="tc-beast" aria-pressed={selectedId===entry.id} onClick={()=>setSelectedId(entry.id)}><div className="tc-beast-art">{graphic?.image.idle?<img src={assetUrl(graphic.image.idle)} alt=""/>:<span>?</span>}</div><div><b>{view.displayName}</b><small>{entry.boss?'BOSS':'NORMAL'} · {known?view.floorLabel:'미확인'}</small><small>{known?'조우 '+view.encounters+' · 처치 '+view.defeats:'직접 조우 필요'}</small></div></button>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-beast" aria-hidden="true" key={'b'+i}/>)}</div>
   <Pager page={safe} count={pages} onChange={setPage}/>
  </div>
  {selectedEntry&&selected&&<section className="tc-beast-detail"><div className="tc-beast-detail-head"><div><small className="tc-kicker">{selected.boss?'BOSS RECORD':'FIELD RECORD'}</small><h2>{selected.displayName}</h2></div><button onClick={()=>setSelectedId(null)}>×</button></div><div className="tc-floor-risk">{selected.knowledge==='UNKNOWN'?'직접 조우하면 기본 기록이 공개됩니다.':selected.floorLabel+' · 조우 '+selected.encounters+'회 · 처치 '+selected.defeats+'회'}</div><div className="tc-skill-list">{selected.knowledge==='UNKNOWN'?<article><strong>기록 잠김</strong><p>이름, 외형, 출현층이 확인되지 않았습니다.</p></article>:selected.skills.slice(0,3).map(skill=><article key={skill.id}><strong>{skill.name} · {skillKind[skill.kind]??skill.kind}</strong><p>{selected.knowledge==='MASTERED'?skill.description:'처치 기록을 더 쌓으면 상세 행동이 공개됩니다.'}</p></article>)}</div><div className="tc-floor-risk">{selected.knowledge==='MASTERED'?'협회 분석 완료':selected.boss?'보스 기록은 조우·처치에 따라 갱신됩니다.':'일반 개체 3회 처치 시 상세 행동이 공개됩니다.'}</div></section>}
 </Screen>;
}
