import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,GearMasteryKey,Item,Slot} from '../../game/types';
import {GEAR_MASTERY_KEYS,GEAR_MASTERY_NAMES,SLOTS} from '../../game/data/config';
import {appearanceById} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {equip,equippedItem,itemName,itemSlot,stats} from '../../game/engine/state';
import {masteryPercent,masteryRequired} from '../../game/engine/gearMastery';
import {BottomSheet} from '../mobile/BottomSheet';
import {PageStepper} from '../mobile/PageStepper';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import {clampPageIndex,pageSizeFor,pageSlice} from '../mobile/mobilePagination';
import {useViewportHeight} from '../mobile/useViewportHeight';
import './equipment-mobile.css';

const SLOT_SYMBOLS:Record<Slot,string>={weapon:'⚔',armor:'▣',boots:'⌁',accessory:'◇'};
const GEAR_TABS=[
  {value:'gear',label:'장비'},
  {value:'mastery',label:'숙련'},
] as const;

function EquipmentCandidateSheet({
  game,slot,items,page,pageSize,onPage,onClose,onEquip,
}:{
  game:GameState;
  slot:Slot;
  items:Item[];
  page:number;
  pageSize:number;
  onPage:(page:number)=>void;
  onClose:()=>void;
  onEquip:(id:string)=>void;
}){
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const safePage=clampPageIndex(page,items.length,pageSize);
  const visible=pageSlice(items,safePage,pageSize);
  const locked=!!game.expedition;
  return <BottomSheet open title={SLOTS[slot]+' 교체'} onClose={onClose}>
    <div className="equipment-candidate-sheet">
      {locked&&<div className="equipment-lock-note">원정 잠금 · 안전 귀환 후 장비를 변경할 수 있습니다.</div>}
      <div className="equipment-candidate-list">
        {visible.length?visible.map(item=>{
          const equipped=game.equipped[slot]===item.id;
          return <button
            type="button"
            className={'equipment-candidate '+(equipped?'equipped':'')}
            key={item.id}
            disabled={locked||equipped}
            onClick={()=>onEquip(item.id)}
          >
            <span className="equipment-candidate-icon" aria-hidden="true">{SLOT_SYMBOLS[slot]}</span>
            <span><strong>{itemName(item)}</strong><small>{item.tier}등급 · 강화 +{item.enhancement}</small></span>
            <b>{equipped?'장착 중':locked?'잠금':'장착'}</b>
          </button>;
        }):<div className="equipment-empty">보유한 {SLOTS[slot]} 장비가 없습니다.</div>}
      </div>
      <PageStepper page={safePage} pageCount={pageCount} onPage={onPage}/>
    </div>
  </BottomSheet>;
}

function MasteryView({game}:{game:GameState}){
  const [key,setKey]=useState<GearMasteryKey>('sword');
  const mastery=game.gearMastery[key];
  const target=mastery.unlockedTier+1;
  const required=masteryRequired(target);
  const percent=masteryPercent(game,key);
  return <div className="equipment-mastery-view">
    <div className="equipment-mastery-tabs" role="tablist" aria-label="장비 숙련 종류">
      {GEAR_MASTERY_KEYS.map(item=><button
        type="button"
        role="tab"
        aria-selected={item===key}
        className={item===key?'active':''}
        key={item}
        onClick={()=>setKey(item)}
      >{GEAR_MASTERY_NAMES[item]}</button>)}
    </div>
    <section className="equipment-mastery-card">
      <span className="equipment-mastery-symbol" aria-hidden="true">◆</span>
      <small>PERMANENT MASTERY</small>
      <strong>{GEAR_MASTERY_NAMES[key]} 숙련</strong>
      <b>{mastery.unlockedTier}등급 장착 가능</b>
      <div className="equipment-mastery-bar" aria-label={'숙련도 '+Math.round(percent)+'%'}>
        <span style={{width:percent+'%'}}/>
      </div>
      <p>{mastery.unlockedTier>=5
        ?'최고 단계에 도달했습니다.'
        :mastery.progress+' / '+required+' · 다음 '+target+'등급까지 '+Math.round(percent)+'%'}</p>
      <small>장착한 동일 계열 장비로 적을 처치하면 영구 숙련도가 상승합니다.</small>
    </section>
  </div>;
}

export function EquipmentScreen({game,setGame,onSkills}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
  onSkills:()=>void;
}){
  const [view,setView]=useState<'gear'|'mastery'>('gear');
  const [selectedSlot,setSelectedSlot]=useState<Slot|null>(null);
  const [page,setPage]=useState(0);
  const height=useViewportHeight();
  const pageSize=pageSizeFor('equipment',height);
  const currentStats=stats(game);
  const appearance=appearanceById(game.cosmetics.selectedAppearanceId);
  const locked=!!game.expedition;
  const candidates=useMemo(
    ()=>selectedSlot?game.items.filter(item=>itemSlot(item.kind)===selectedSlot):[],
    [game.items,selectedSlot],
  );

  useEffect(()=>setPage(0),[selectedSlot]);

  const openSlot=(slot:Slot)=>{
    if(locked)return;
    setSelectedSlot(slot);
  };

  const slotButton=(slot:Slot)=>{
    const item=equippedItem(game,slot);
    return <button
      type="button"
      className={'equipment-slot-button equipment-slot-'+slot}
      aria-label={SLOTS[slot]+' · '+(item?itemName(item):'비어 있음')}
      disabled={locked}
      onClick={()=>openSlot(slot)}
    >
      <span className="equipment-slot-symbol" aria-hidden="true">{SLOT_SYMBOLS[slot]}</span>
      <span><small>{SLOTS[slot]}</small><strong>{item?itemName(item):'비어 있음'}</strong></span>
    </button>;
  };

  return <section className="equipment-screen">
    <ScreenHeader title="장비" meta={locked?'원정 잠금':'현재 장비와 영구 숙련도'}/>
    <SegmentTabs items={GEAR_TABS} value={view} onChange={setView} label="장비 화면"/>

    {locked&&<div className="equipment-lock-banner">원정 잠금 · 장비와 스킬 구성은 안전 귀환 후 변경할 수 있습니다.</div>}

    {view==='gear'?<>
      <div className="equipment-character-stage">
        {slotButton('weapon')}
        {slotButton('armor')}
        <div className="equipment-character-art" aria-label="현재 모험가">
          {appearance?<img src={assetUrl(appearance.imagePath)} alt={appearance.name}/>:<span aria-hidden="true">♙</span>}
        </div>
        {slotButton('accessory')}
        {slotButton('boots')}
      </div>

      <div className="equipment-stat-strip">
        <span><small>HP</small><b>{Math.round(currentStats.hp)}</b></span>
        <span><small>공격</small><b>{Math.round(currentStats.attack)}</b></span>
        <span><small>방어</small><b>{Math.round(currentStats.defense)}</b></span>
        <span><small>공속</small><b>{currentStats.speed.toFixed(2)}</b></span>
      </div>

      <button type="button" className="equipment-skills-button" disabled={locked} onClick={onSkills}>
        <span>✦</span><span><strong>자동 스킬 구성</strong><small>3개 우선순위 설정</small></span><b>→</b>
      </button>
    </>:<MasteryView game={game}/>}

    {selectedSlot&&<EquipmentCandidateSheet
      game={game}
      slot={selectedSlot}
      items={candidates}
      page={page}
      pageSize={pageSize}
      onPage={setPage}
      onClose={()=>setSelectedSlot(null)}
      onEquip={id=>{
        setGame(state=>equip(state,id));
        setSelectedSlot(null);
      }}
    />}
  </section>;
}
