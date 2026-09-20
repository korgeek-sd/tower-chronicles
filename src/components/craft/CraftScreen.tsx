import React,{useEffect,useMemo,useState} from 'react';
import type {Field,GameState,Potion,Weapon} from '../../game/types';
import {EQUIPMENT,FIELDS,PASSIVES,POTIONS,POTION_CRAFTING,TOWERS,WEAPONS,potionIds} from '../../game/data/config';
import {cost,discount,materialFor,startCraft} from '../../game/engine/crafting';
import {getGoldenRecorderBenefits,isGoldenRecorderActive} from '../../game/premium/goldenRecorder';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import {PageStepper} from '../mobile/PageStepper';
import {pageSizeFor,pageSlice,clampPageIndex} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import './craft-mobile.css';

const FIELD_ORDER:Field[]=['weapon','armor','accessory','alchemy'];

export function craftRecipesFor(field:Field,grade:number):string[]{
  if(field==='weapon')return Object.keys(WEAPONS);
  if(field==='armor')return ['armor','boots'];
  if(field==='accessory')return Object.keys(PASSIVES);
  return potionIds.filter(id=>id!=='revival'&&POTIONS[id].tier===grade);
}

export function craftGradeState(game:GameState,field:Field,grade:number,now:number){
  const material=materialFor(field);
  const materialName=TOWERS[material].material;
  const materialOwned=game.materials[material][grade-1]??0;
  const materialCost=cost(game,field,grade,now);
  const locked=grade>game.mastery[field].unlocked;
  return {
    material,
    materialName,
    materialOwned,
    materialCost,
    locked,
    canCraft:!game.expedition&&!locked&&materialOwned>=materialCost,
    discountPercent:Math.round((discount(game.mastery[field].crafts)+getGoldenRecorderBenefits(game,now).craftingMaterialReductionBonus)*100),
  };
}

function recipeTitle(kind:string,grade:number){
  if(kind in WEAPONS)return grade+'등급 '+WEAPONS[kind as Weapon].name;
  if(kind in PASSIVES)return grade+'등급 '+PASSIVES[kind as keyof typeof PASSIVES].name+' 장신구';
  if(kind==='armor')return grade+'등급 탐험가 갑옷';
  if(kind==='boots')return grade+'등급 탐험가 신발';
  if(kind in POTIONS)return POTIONS[kind as Potion].name+' 포션 ×'+POTION_CRAFTING.generalBatch;
  return kind;
}

function recipeDescription(kind:string,grade:number){
  if(kind in WEAPONS)return WEAPONS[kind as Weapon].description;
  if(kind in PASSIVES)return PASSIVES[kind as keyof typeof PASSIVES].description;
  if(kind==='armor')return '최대 HP +'+EQUIPMENT.armor.hp*grade+' · 방어 +'+EQUIPMENT.armor.defense*grade;
  if(kind==='boots')return '최대 HP +'+EQUIPMENT.boots.hp*grade+' · 공격속도 +'+(EQUIPMENT.boots.speed*grade).toFixed(1);
  if(kind in POTIONS)return POTIONS[kind as Potion].description;
  return '';
}

export function CraftScreen({game,setGame,now,onMastery}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
  now:number;
  onMastery:()=>void;
}){
  const [field,setField]=useState<Field>('weapon');
  const [grade,setGrade]=useState(1);
  const [page,setPage]=useState(0);
  const [selectedKind,setSelectedKind]=useState<string|null>('sword');
  const height=useViewportHeight();
  const pageSize=pageSizeFor('recipes',height);
  const recipes=useMemo(()=>craftRecipesFor(field,grade),[field,grade]);
  const pageCount=Math.max(1,Math.ceil(recipes.length/pageSize));
  const safePage=clampPageIndex(page,recipes.length,pageSize);
  const pageRecipes=pageSlice(recipes,safePage,pageSize);
  const gradeState=craftGradeState(game,field,grade,now);
  const selected=selectedKind&&recipes.includes(selectedKind)?selectedKind:(recipes[0]??null);
  const activeJob=game.crafting.jobs.find(job=>job.status==='CRAFTING');
  const goldenActive=isGoldenRecorderActive(game,now);

  useEffect(()=>{
    const next=craftRecipesFor(field,grade);
    setPage(0);
    setSelectedKind(next[0]??null);
  },[field,grade]);

  const changeField=(next:Field)=>{
    setField(next);
    setGrade(1);
  };

  const changePage=(next:number)=>{
    const safe=clampPageIndex(next,recipes.length,pageSize);
    setPage(safe);
    setSelectedKind(pageSlice(recipes,safe,pageSize)[0]??null);
  };

  const craftSelected=()=>{
    if(!selected)return;
    const quantity=field==='alchemy'?POTION_CRAFTING.generalBatch:1;
    setGame(state=>startCraft(state,selected,grade,quantity,Date.now()));
  };

  const canStart=!!selected&&gradeState.canCraft;
  const actionLabel=game.expedition
    ?'원정 중 제작 불가'
    :gradeState.locked
      ?grade+'등급 잠김'
      :!selected
        ?'제작법 없음'
        :gradeState.materialOwned<gradeState.materialCost
          ?'재료 부족'
          :activeJob&&goldenActive
            ?'대기열에 추가'
            :'제작 시작';

  return <section className="craft-screen" aria-label="제작">
    <ScreenHeader
      title="모험가의 공방"
      meta="재료를 장비와 소모품으로 가공합니다"
    />

    <div className="craft-title-actions">
      <SegmentTabs
        label="제작 분야"
        items={FIELD_ORDER.map(value=>({value,label:FIELDS[value].replace(' 제작','')}))}
        value={field}
        onChange={changeField}
      />
      <button type="button" className="craft-mastery-link" onClick={onMastery}>숙련도</button>
    </div>

    <section className="craft-grade-panel" aria-label="제작 등급">
      <div className="craft-grade-heading">
        <div><small>제작 등급</small><strong>{grade}등급</strong></div>
        <div className="craft-material-stock">
          <small>{gradeState.materialName}</small>
          <b>{gradeState.materialOwned}개</b>
        </div>
      </div>
      <div className="craft-grade-selector">
        {[1,2,3,4,5].map(value=>{
          const locked=value>game.mastery[field].unlocked;
          return <button
            type="button"
            key={value}
            className={grade===value?'active':''}
            aria-pressed={grade===value}
            disabled={locked}
            onClick={()=>setGrade(value)}
          >
            <b>{value}</b><small>{locked?'잠김':'등급'}</small>
          </button>;
        })}
      </div>
      <div className="craft-grade-meta">
        <span>필요 <b>{gradeState.materialCost}</b></span>
        <span>절감 <b>{gradeState.discountPercent}%</b></span>
        <span>자격 <b>{game.mastery[field].unlocked}등급</b></span>
      </div>
    </section>

    <div className="craft-recipe-list" aria-label="제작법">
      {pageRecipes.length?pageRecipes.map(kind=><button
        type="button"
        key={kind}
        className={'craft-recipe-card '+(selected===kind?'selected':'')}
        aria-pressed={selected===kind}
        onClick={()=>setSelectedKind(kind)}
      >
        <span className="craft-recipe-emblem" aria-hidden="true">
          {kind in WEAPONS?WEAPONS[kind as Weapon].icon:field==='alchemy'?POTIONS[kind as Potion].icon:field==='accessory'?'◇':'▰'}
        </span>
        <span className="craft-recipe-copy">
          <strong>{recipeTitle(kind,grade)}</strong>
          <small>{recipeDescription(kind,grade)}</small>
        </span>
        <span className="craft-recipe-cost">{gradeState.materialCost}<small>{gradeState.materialName}</small></span>
      </button>):<div className="craft-empty">현재 등급에 공개된 제작법이 없습니다.</div>}
    </div>

    <div className="craft-local-actions">
      <PageStepper page={safePage} pageCount={pageCount} onPage={changePage}/>
      <button
        type="button"
        className="game-button primary craft-primary-action"
        disabled={!canStart}
        onClick={craftSelected}
      >
        {actionLabel}
      </button>
    </div>

    {activeJob&&<div className="craft-job-strip" role="status">
      <span>제작 진행 중</span>
      <b>{recipeTitle(activeJob.kind,activeJob.tier)}</b>
      <small>{goldenActive?'황금기록자 대기열 사용 가능':'완료 후 다음 제작 가능'}</small>
    </div>}
  </section>;
}
