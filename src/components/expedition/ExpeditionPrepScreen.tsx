import React,{useMemo,useState} from 'react';
import type {GameState,Potion,Slot,Tower} from '../../game/types';
import {
  CONFIG,ENTRY_PERMITS,POTIONS,SLOTS,TOWERS,
  floorSafety,generalPotionIds,isBossFloor,potionIds,
} from '../../game/data/config';
import {monsterFor} from '../../game/engine/drops';
import {equippedItem,itemName} from '../../game/engine/state';
import {applyPreset,canAccessPresetSlot,renamePreset,savePreset} from '../../game/engine/presets';
import {getGoldenPresetSlotLimit} from '../../game/premium/goldenRecorder';
import {ScreenHeader} from '../mobile/ScreenHeader';
import {SegmentTabs} from '../mobile/SegmentTabs';
import './expedition-mobile.css';

type PrepTab='expedition'|'equipment'|'consumables';

const PREP_TABS=[
  {value:'expedition',label:'원정'},
  {value:'equipment',label:'장비'},
  {value:'consumables',label:'소모품'},
] as const;

const SLOT_ORDER:Slot[]=['weapon','armor','accessory','boots'];

export function expeditionPrepState(game:GameState,tower:Tower){
  const general=generalPotionIds.reduce((sum,id)=>sum+game.loadout[id],0);
  const stockValid=potionIds.every(id=>
    Number.isInteger(game.loadout[id])&&
    game.loadout[id]>=0&&
    game.loadout[id]<=game.potions[id]
  );
  const hasPermit=(game.tickets[tower][0]??0)>0;
  const generalValid=general<=CONFIG.generalPotionLimit;
  const revivalValid=game.loadout.revival<=CONFIG.revivalPotionLimit;
  return {
    general,
    hasPermit,
    stockValid,
    generalValid,
    revivalValid,
    canStart:!game.expedition&&hasPermit&&stockValid&&generalValid&&revivalValid,
  };
}

function riskLabel(floor:number){
  if(isBossFloor(floor))return '보스 구간';
  return floorSafety(floor)==='SAFE'?'SAFE · PK 불가':'PK 가능 구간';
}

export function ExpeditionPrepScreen({game,setGame,tower,floor,setFloor,now,onBack,onStart}:{
  game:GameState;
  setGame:React.Dispatch<React.SetStateAction<GameState>>;
  tower:Tower;
  floor:number;
  setFloor:(floor:number)=>void;
  now:number;
  onBack:()=>void;
  onStart:()=>void;
}){
  const [tab,setTab]=useState<PrepTab>('expedition');
  const [presetSlot,setPresetSlot]=useState(1);
  const prep=expeditionPrepState(game,tower);
  const towerData=TOWERS[tower];
  const monster=useMemo(()=>monsterFor(tower,floor),[tower,floor]);
  const presetLimit=getGoldenPresetSlotLimit(game,now);
  const preset=game.expeditionPresets[presetSlot-1];
  const permitName=tower==='ore'?ENTRY_PERMITS.ore.name:towerData.name+' 입장권';

  const setPotion=(id:Potion,value:number)=>{
    setGame(state=>{
      const max=id==='revival'
        ?Math.min(state.potions[id],CONFIG.revivalPotionLimit)
        :state.potions[id];
      return {
        ...state,
        loadout:{
          ...state.loadout,
          [id]:Math.max(0,Math.min(max,Math.floor(value)||0)),
        },
      };
    });
  };

  const changePreset=(slot:number)=>{
    if(!canAccessPresetSlot(slot,presetLimit))return;
    setPresetSlot(slot);
  };

  return <section className="expedition-prep-screen" aria-label="원정 준비">
    <ScreenHeader
      title="원정 준비"
      meta={towerData.name}
      onBack={onBack}
    />

    <SegmentTabs
      items={PREP_TABS}
      value={tab}
      onChange={setTab}
      label="원정 준비 메뉴"
    />

    <div className="expedition-prep-content">
      {tab==='expedition'&&<section className="expedition-tab expedition-plan-panel">
        <div className="expedition-tower-summary">
          <span className="expedition-tower-emblem" aria-hidden="true">{towerData.icon}</span>
          <div>
            <small>SELECTED TOWER</small>
            <strong>{towerData.name}</strong>
            <span>{towerData.material} 회수 원정</span>
          </div>
          <div className={'expedition-permit-count '+(prep.hasPermit?'ready':'empty')}>
            <small>{permitName}</small>
            <b>× {game.tickets[tower][0]??0}</b>
          </div>
        </div>

        <div className="expedition-floor-selector">
          <button type="button" aria-label="이전 층" disabled={floor<=1} onClick={()=>setFloor(Math.max(1,floor-1))}>−</button>
          <div>
            <small>목표 층</small>
            <strong>{floor}F</strong>
            <span>{riskLabel(floor)}</span>
          </div>
          <button type="button" aria-label="다음 층" disabled={floor>=CONFIG.maxFloor} onClick={()=>setFloor(Math.min(CONFIG.maxFloor,floor+1))}>+</button>
        </div>

        <div className="expedition-enemy-stats">
          <span><small>적 HP</small><b>{Math.round(monster.hp)}</b></span>
          <span><small>공격</small><b>{Math.round(monster.attack)}</b></span>
          <span><small>방어</small><b>{Math.round(monster.defense)}</b></span>
          <span><small>속도</small><b>{monster.speed.toFixed(2)}</b></span>
        </div>

        <div className="expedition-risk-note">
          입장권은 탐사 시작 시에만 소비됩니다. 전리품은 안전 귀환해야 영구 보관됩니다.
        </div>
      </section>}

      {tab==='equipment'&&<section className="expedition-tab expedition-equipment-panel">
        <div className="expedition-equipped-grid">
          {SLOT_ORDER.map(slot=>{
            const item=equippedItem(game,slot);
            return <div className="expedition-equipped-slot" key={slot}>
              <small>{SLOTS[slot]}</small>
              <strong>{item?itemName(item):'비어 있음'}</strong>
            </div>;
          })}
        </div>

        <section className="expedition-preset-card">
          <div className="expedition-preset-heading">
            <div><small>원정 프리셋</small><strong>{preset?.name??'빈 프리셋 '+presetSlot}</strong></div>
            <span>{presetSlot} / {presetLimit}</span>
          </div>
          <div className="expedition-preset-slots" aria-label="프리셋 슬롯">
            {game.expeditionPresets.map((entry,index)=>{
              const slot=index+1;
              const open=canAccessPresetSlot(slot,presetLimit);
              return <button
                type="button"
                key={slot}
                className={presetSlot===slot?'active':''}
                disabled={!open}
                aria-label={slot+'번 프리셋'+(open?'':' 잠김')}
                onClick={()=>changePreset(slot)}
              >{slot}<small>{open?(entry?'저장됨':'빈칸'):'잠김'}</small></button>;
            })}
          </div>
          <div className="expedition-preset-actions">
            <button
              type="button"
              disabled={!preset}
              onClick={()=>setGame(state=>applyPreset(state,presetSlot,presetLimit))}
            >불러오기</button>
            <button
              type="button"
              onClick={()=>setGame(state=>savePreset(state,presetSlot,preset?.name,presetLimit))}
            >{preset?'덮어쓰기':'현재 설정 저장'}</button>
            <button
              type="button"
              disabled={!preset}
              onClick={()=>{
                if(!preset||typeof window==='undefined')return;
                const name=window.prompt('프리셋 이름',preset.name);
                if(name!==null)setGame(state=>renamePreset(state,presetSlot,name,presetLimit));
              }}
            >이름 변경</button>
          </div>
        </section>
      </section>}

      {tab==='consumables'&&<section className="expedition-tab expedition-consumables-panel">
        <div className={'expedition-bag-limit '+(prep.generalValid?'ready':'danger')}>
          <span><small>일반 회복 포션</small><strong>{prep.general} / {CONFIG.generalPotionLimit}</strong></span>
          <span><small>회생 포션</small><strong>{game.loadout.revival} / {CONFIG.revivalPotionLimit}</strong></span>
        </div>

        <div className="expedition-potion-list">
          {potionIds.map(id=><div className="expedition-potion-row" key={id}>
            <span className="expedition-potion-icon" aria-hidden="true">{POTIONS[id].icon}</span>
            <div>
              <strong>{POTIONS[id].name}</strong>
              <small>{POTIONS[id].tier}등급 · 창고 {game.potions[id]}개</small>
            </div>
            <div className="expedition-potion-stepper">
              <button type="button" aria-label={POTIONS[id].name+' 감소'} disabled={game.loadout[id]<=0} onClick={()=>setPotion(id,game.loadout[id]-1)}>−</button>
              <b>{game.loadout[id]}</b>
              <button type="button" aria-label={POTIONS[id].name+' 증가'} disabled={game.loadout[id]>=game.potions[id]||(id==='revival'&&game.loadout[id]>=CONFIG.revivalPotionLimit)} onClick={()=>setPotion(id,game.loadout[id]+1)}>+</button>
            </div>
          </div>)}
        </div>

        <label className="expedition-threshold-setting">
          <span><strong>회복 기준</strong><small>현재 수동 전투에서는 자동 사용하지 않음</small></span>
          <select value={game.threshold} onChange={event=>setGame(state=>({...state,threshold:+event.target.value}))}>
            {[30,50,70,0].map(value=><option key={value} value={value}>{value?'HP '+value+'% 이하':'사용 안 함'}</option>)}
          </select>
        </label>
      </section>}
    </div>

    <div className="expedition-prep-actions">
      <div className="expedition-prep-validation" role="status">
        {!prep.hasPermit?'입장권이 없습니다.'
          :!prep.generalValid?'일반 회복 포션 휴대 한도를 초과했습니다.'
          :!prep.revivalValid?'회생 포션 휴대 한도를 초과했습니다.'
          :!prep.stockValid?'창고의 포션 수량을 확인하세요.'
          :'준비 완료 · 입장권은 시작 시 소비됩니다.'}
      </div>
      <button type="button" className="game-button primary" disabled={!prep.canStart} onClick={onStart}>
        탐사 시작 <span>{permitName} {game.tickets[tower][0]??0}장</span>
      </button>
    </div>
  </section>;
}
