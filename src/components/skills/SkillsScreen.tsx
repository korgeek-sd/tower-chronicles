import React,{useEffect,useState} from 'react';
import type {GameState} from '../../game/types';
import {SKILLS,WEAPONS} from '../../game/data/config';
import {weaponOf} from '../../game/engine/state';
import {PageStepper} from '../mobile/PageStepper';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {clampPageIndex,pageSizeFor,pageSlice} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import './skills-mobile.css';

export function SkillsScreen({game,setGame,onBack}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
  onBack:()=>void;
}){
  const [page,setPage]=useState(0);
  const height=useViewportHeight();
  const pageSize=pageSizeFor('skills',height);
  const pageCount=Math.max(1,Math.ceil(SKILLS.length/pageSize));
  const safePage=clampPageIndex(page,SKILLS.length,pageSize);
  const visible=pageSlice(SKILLS,safePage,pageSize);
  const locked=!!game.expedition;
  const weapon=weaponOf(game);

  useEffect(()=>{
    if(page!==safePage)setPage(safePage);
  },[page,safePage]);

  const updateSlot=(index:number,value:string)=>{
    if(locked)return;
    setGame(state=>{
      const skills=[...state.skills] as GameState['skills'];
      skills[index]=value||null;
      return {...state,skills};
    });
  };

  return <section className="skills-screen">
    <ScreenHeader title="자동 스킬" meta={locked?'원정 중 변경 불가':'1 → 2 → 3순위로 조건 검사'} onBack={onBack}/>

    {locked&&<div className="skills-lock-banner">원정 중 변경 불가 · 안전 귀환 후 스킬 구성을 변경할 수 있습니다.</div>}

    <div className="skill-loadout" aria-label="장착 스킬">
      {game.skills.map((id,index)=><label className="skill-loadout-slot" key={index}>
        <span><small>{index+1}순위</small><b>{id?SKILLS.find(skill=>skill.id===id)?.name??id:'비어 있음'}</b></span>
        <select
          aria-label={(index+1)+'순위 스킬'}
          disabled={locked}
          value={id||''}
          onChange={event=>updateSlot(index,event.target.value)}
        >
          <option value="">비워두기</option>
          {SKILLS.filter(skill=>game.learned.includes(skill.id)).map(skill=><option
            key={skill.id}
            disabled={game.skills.includes(skill.id)&&id!==skill.id}
            value={skill.id}
          >{skill.name}</option>)}
        </select>
      </label>)}
    </div>

    <div className="skill-catalog" aria-label="스킬 카탈로그">
      {visible.map(skill=>{
        const learned=game.learned.includes(skill.id);
        const compatible=skill.weapons.includes(weapon);
        return <article className={'skill-catalog-card '+(!learned?'locked':'')} key={skill.id}>
          <div className="skill-catalog-icon" aria-hidden="true">{skill.effect==='damage'?'✦':'◆'}</div>
          <div className="skill-catalog-copy">
            <div><strong>{skill.name}</strong><span>{learned?'배움':'스킬북 필요'}</span></div>
            <p>{skill.description}</p>
            <small>대기 {skill.cooldown}턴 · {skill.weapons.map(id=>WEAPONS[id].name).join(' · ')}</small>
          </div>
          <div className={'skill-compatibility '+(compatible?'ok':'bad')}>{compatible?'사용 가능':'무기 불일치'}</div>
        </article>;
      })}
    </div>

    <PageStepper page={safePage} pageCount={pageCount} onPage={setPage}/>
  </section>;
}
