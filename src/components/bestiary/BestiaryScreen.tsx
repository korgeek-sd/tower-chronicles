import React,{useState} from 'react';
import type {GameState} from '../../game/types';
import {HUNT_MAPS,type HuntMapId} from '../../game/hunting/model';
import {HUNT_MONSTERS} from '../../game/hunting/encounters';
import {monsterSkillDescription} from '../../game/hunting/monsterSkills';
import {assetUrl} from '../../game/data/graphics';
import {Pager,Screen} from '../../ui/mobile';

const PAGE_SIZE=6;

/** The active bestiary uses the same monster catalog as normal hunting.
 * Historical tower expedition records remain in saved data but are not shown here.
 */
export function BestiaryScreen({onBack}:{game:GameState;onBack:()=>void}){
 const [mapId,setMapId]=useState<HuntMapId>('plains');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const map=HUNT_MAPS.find(item=>item.id===mapId)!;
 const monsters=HUNT_MONSTERS[mapId];
 const pages=Math.ceil(monsters.length/PAGE_SIZE);
 const safe=Math.min(page,pages-1);
 const shown=monsters.slice(safe*PAGE_SIZE,(safe+1)*PAGE_SIZE);
 const selected=monsters.find(monster=>monster.id===selectedId)??null;
 const total=HUNT_MAPS.reduce((sum,item)=>sum+HUNT_MONSTERS[item.id].length,0);

 return <Screen eyebrow="HUNTING FIELD RECORD" title="사냥 생물록" meta={<><span>몬스터 {total}종</span><button className="tc-action secondary slim" onClick={onBack}>닫기</button></>}>
  <div className="tc-bestiary">
   <nav className="tc-hunt-bestiary-tabs" aria-label="사냥터별 몬스터">
    {HUNT_MAPS.map(item=><button type="button" key={item.id} aria-pressed={item.id===mapId} onClick={()=>{setMapId(item.id);setSelectedId(null);setPage(0);}}>{item.name}</button>)}
   </nav>
   <div className="tc-bestiary-grid">
    {shown.map(monster=><button type="button" key={monster.id} className="tc-beast" aria-pressed={monster.id===selectedId} onClick={()=>setSelectedId(monster.id)}>
     <div className="tc-beast-art"><img src={assetUrl(monster.image)} alt="" loading="lazy"/></div>
     <div><b>{monster.name}</b><small>{map.name}</small><small>HP {monster.hp} · 공격 {monster.attack}</small></div>
    </button>)}
    {Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-beast" aria-hidden="true" key={'empty-'+i}/>)}
   </div>
   <Pager page={safe} count={pages} onChange={setPage}/>
  </div>
  {selected&&<section className="tc-beast-detail" aria-label={selected.name+' 정보'}>
   <div className="tc-beast-detail-head"><div><small className="tc-kicker">{map.name} · 권장 Lv. {map.recommendedLevel}</small><h2>{selected.name}</h2></div><button type="button" onClick={()=>setSelectedId(null)} aria-label="몬스터 정보 닫기">×</button></div>
   <div className="tc-floor-risk">HP {selected.hp} · 공격 {selected.attack} · 방어 {selected.defense}</div>
   <div className="tc-skill-list">
    {selected.skills.map((skill,index)=><article key={index}><strong>{skill.name}</strong><p>{monsterSkillDescription(skill)}</p></article>)}
   </div>
   <div className="tc-floor-risk">{selected.description}</div>
  </section>}
 </Screen>;
}
