import React,{useCallback,useEffect,useMemo,useState} from 'react';
import type {EquipmentItem,GameState,Slot} from '../../game/types';
import {inventoryView,selectInventory,categories,categoryNames,type InventoryCategory,type InventorySort,type InventoryFilter} from '../../game/inventoryView';
import {equip,equipmentStatComparison,stats,unequip} from '../../game/engine/state';
import {dismantleEquipment,equipmentDismantleYield} from '../../game/engine/equipmentDismantle';
import {V2_STARTER_EQUIPMENT_ID} from '../../game/data/equipment';
import {useSkillBook} from '../../game/engine/skills';
import {registerAppearance} from '../../game/engine/cosmetics';
import {SKILLS,SLOTS} from '../../game/data/config';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {Glyph,Pager,Screen} from '../../ui/mobile';
import {InventoryDetailSheet} from './InventoryDetailSheet';
import type {GameplayLease} from '../../online/gameSession';
import {applyServerEconomyRecord,dismantleOnlineEquipment} from '../../online/economy';
import {marketItemIdForInventory} from '../../game/market/marketService';
import type {MarketIntent} from '../market/marketNavigation';

const PAGE_SIZE=8;
const INVENTORY_SANDBOX_EQUIPMENT:EquipmentItem[]=[
 {id:'inventory-sandbox-weapon',kind:'outer_guard_longbow',grade:'rare',enhancement:0},
 {id:'inventory-sandbox-helmet',kind:'expedition_iron_helmet',grade:'rare',enhancement:2},
 {id:'inventory-sandbox-armor',kind:'return_corps_plate_armor',grade:'heroic',enhancement:4},
 {id:'inventory-sandbox-gloves',kind:'mining_detail_reinforced_gloves',grade:'uncommon',enhancement:1},
 {id:'inventory-sandbox-boots',kind:'survey_corps_dust_boots',grade:'rare',enhancement:3},
 {id:'inventory-sandbox-necklace',kind:'association_registration_tag',grade:'heroic',enhancement:5},
 {id:'inventory-sandbox-ring',kind:'expedition_merit_ring',grade:'legendary',enhancement:7},
];
const SLOT_GLYPH:Record<Slot,string>={weapon:'sword',helmet:'armor',armor:'armor',gloves:'armor',boots:'boots',necklace:'accessory',ring:'accessory'};

export function InventoryScreen({game,setGame,onlineLease,onEnhancement,onMarket,initialSelected,onInitialSelectedConsumed}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;onEnhancement:(itemId?:string,inventoryKey?:string)=>void;onMarket?:(intent:MarketIntent)=>void;initialSelected?:string|null;onInitialSelectedConsumed?:()=>void}){
 const [category,setCategory]=useState<InventoryCategory>('all'),[query,setQuery]=useState(''),[sort,setSort]=useState<InventorySort>('default'),[filter,setFilter]=useState<InventoryFilter>({tier:0,status:false}),[selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0),[toolsOpen,setToolsOpen]=useState(false),[busy,setBusy]=useState(false);
 const [sandboxGame,setSandboxGame]=useState<GameState|null>(null);
 const activeGame=sandboxGame??game;
 const updateActive=(fn:(state:GameState)=>GameState)=>sandboxGame?setSandboxGame(state=>state?fn(state):state):setGame(fn);
 const startInventorySandbox=()=>{
  const next=structuredClone(game);
  next.expedition=null;
  next.equipmentItems=INVENTORY_SANDBOX_EQUIPMENT.map(item=>({...item}));
  next.equipped={
   ...next.equipped,
   weapon:'inventory-sandbox-weapon',
   helmet:'inventory-sandbox-helmet',
   armor:'inventory-sandbox-armor',
   gloves:'inventory-sandbox-gloves',
   boots:'inventory-sandbox-boots',
   necklace:'inventory-sandbox-necklace',
   ring:'inventory-sandbox-ring',
  };
  setSandboxGame(next);
  setCategory('equipment');
  setSelected(null);
  setPage(0);
  setFilter({tier:0,status:false});
 };
 const stopInventorySandbox=()=>{setSandboxGame(null);setCategory('all');setSelected(null);setPage(0);setFilter({tier:0,status:false});};
 const close=useCallback(()=>setSelected(null),[]);
 const items=inventoryView(activeGame),visible=selectInventory(items,category,query,sort,filter),pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=visible.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE),item=items.find(i=>i.key===selected);
 useEffect(()=>{if(!initialSelected)return;setSelected(initialSelected);onInitialSelectedConsumed?.();},[initialSelected]);
 const categorySet=useMemo(()=>categories,[ ]),st=stats(activeGame),graphic=playerGraphicForJob(activeGame.expedition?.jobSnapshotId??activeGame.currentJobId,activeGame.cosmetics.selectedAppearanceId),characterSrc=graphic.image.idle?assetUrl(graphic.image.idle):undefined;
 const equippedCount=(Object.keys(SLOTS) as Slot[]).filter(slot=>!!activeGame.equipped[slot]).length;
 const noRealEquipment=(game.equipmentItems??[]).length===0;
 let action:(()=>void)|undefined,label='',disabled=false;
 if(item?.category==='equipment'){action=()=>updateActive(s=>item.equipped?unequip(s,item.sourceId):equip(s,item.sourceId));label=activeGame.expedition?'원정 중 변경 불가':item.equipped?'장착 해제':'장착';disabled=!!activeGame.expedition;}
 if(item?.category==='skillbooks'){action=()=>updateActive(s=>useSkillBook(s,item.sourceId));label=item.learned?'습득 완료':activeGame.expedition?'원정 중 사용 불가':'사용하여 학습';disabled=!!item.learned||!!activeGame.expedition||!SKILLS.some(s=>s.id===item.sourceId);}
 if(item?.category==='cosmetics'){action=()=>updateActive(s=>registerAppearance(s,item.sourceId));label=item.registered?'등록 완료':'외형 등록';disabled=!!item.registered;}
 const selectedEquipment=item?.category==='equipment'&&item.modern?(activeGame.equipmentItems??[]).find(value=>value.id===item.sourceId):undefined;
 const marketItemId=!sandboxGame&&item?marketItemIdForInventory(activeGame,item):null;
 const marketVisible=!!item&&!['potions','cosmetics'].includes(item.category);
 const marketLabel=marketVisible?(sandboxGame?'체험 중 거래 제외':marketItemId?'시세 · 거래':'거래 불가'):undefined;
 const marketDisabled=marketVisible&&(!!sandboxGame||!marketItemId||!onMarket);
 const marketAction=marketItemId&&onMarket&&item?()=>onMarket({itemId:marketItemId,inventoryKey:item.key,sourceName:item.name}):undefined;
 const dismantleYield=selectedEquipment?equipmentDismantleYield(selectedEquipment):0;
 const starterProtected=item?.sourceId===V2_STARTER_EQUIPMENT_ID;
 const dismantleDisabled=busy||!!activeGame.expedition||!!item?.equipped||starterProtected;
 const dismantleLabel=starterProtected?'보급 장비 분해 불가':`분해 · 강화석 +${dismantleYield}`;
 const dismantleSelected=async()=>{
  if(!item||item.category!=='equipment'||!item.modern||!selectedEquipment)return;
  if(sandboxGame){setSandboxGame(state=>state?dismantleEquipment(state,item.sourceId):state);setSelected(null);return;}
  if(!onlineLease){setGame(s=>dismantleEquipment(s,item.sourceId));setSelected(null);return;}
  setBusy(true);
  try{
   const result=await dismantleOnlineEquipment(onlineLease,item.sourceId);
   setGame(s=>({...applyServerEconomyRecord(s,result.record),notice:`${item.name} 분해 완료 · 강화석 ${result.stones}개 획득`}));
   setSelected(null);
  }catch(error){
   setGame(s=>({...s,notice:error instanceof Error?error.message:'장비 분해에 실패했습니다.'}));
  }finally{setBusy(false);}
 };
 const tierVisible=['all','equipment','materials','tickets'].includes(category);
 const statusLabel=category==='equipment'?'장착 중':category==='skillbooks'?'미습득':category==='cosmetics'?'미등록':'';
 function equippedView(slot:Slot){const id=activeGame.equipped[slot];return id?items.find(i=>i.category==='equipment'&&i.sourceId===id):undefined;}
 function openEquipped(slot:Slot){const view=equippedView(slot);if(view)setSelected(view.key);}
 function comparisonFor(sourceId:string){return equipmentStatComparison(activeGame,sourceId);}
 const signed=(value:number)=>{const rounded=Math.round(value);return rounded>0?'+'+rounded:String(rounded);};
 return <Screen eyebrow="NOVAR QUARTERMASTER / LOADOUT" title="장비 · 보관함" meta={<><span>{sandboxGame?"체험 모드 · ":""}장착 {equippedCount}/7 · {items.length}종</span>{sandboxGame?<button className="tc-action secondary slim tc-inventory-sandbox-exit" onClick={stopInventorySandbox}>체험 종료</button>:<button className="tc-action secondary slim tc-inventory-enhance-link" onClick={()=>onEnhancement()}>강화</button>}</>} className="tc-inventory-screen">
  <div className="tc-ref-inventory tc-inventory-v081">
   <section className="tc-loadout-stage" aria-label="현재 장착 장비">
    <header className="tc-loadout-ledger"><div><small>EXPLORER LOADOUT</small><b>원정 장비</b></div><span>{equippedCount}/7 장착</span></header>
    <div className="tc-loadout-vitals"><span><small>공격</small><b>{Math.round(st.attack)}</b></span><span><small>최대 HP</small><b>{Math.round(st.hp)}</b></span><span><small>방어</small><b>{Math.round(st.defense)}</b></span></div>
    <div className="tc-loadout-character">{characterSrc?<img src={characterSrc} alt="현재 모험가"/>:<Glyph name="jobs"/>}<div className="tc-loadout-ground"/><small>현재 장비</small></div>
    {(Object.keys(SLOTS) as Slot[]).map(slot=>{const equipped=equippedView(slot),comparison=equipped?comparisonFor(equipped.sourceId):null;return <button key={slot} className={'tc-equip-slot slot-'+slot+(equipped?' filled':'')+(equipped?.grade?' grade-'+equipped.grade:'')} onClick={()=>openEquipped(slot)} disabled={!equipped} aria-label={SLOTS[slot]+(equipped?' '+equipped.name:' 비어 있음')}><span className="tc-equip-icon"><Glyph name={equipped?.iconId??SLOT_GLYPH[slot]}/></span><strong>{SLOTS[slot]}</strong><small>{equipped?equipped.name:'비어 있음'}</small>{comparison&&<span className="tc-equip-impact">공 {signed(-comparison.delta.attack)} · 방 {signed(-comparison.delta.defense)} · HP {signed(-comparison.delta.hp)}</span>}{equipped&&equipped.enhancement!==undefined&&<b className="tc-equip-enhance">+{equipped.enhancement}</b>}{equipped?.grade&&<i className={'tc-equip-grade grade-'+equipped.grade}>{equipped.grade==='common'?'일반':equipped.grade==='uncommon'?'고급':equipped.grade==='rare'?'희귀':equipped.grade==='heroic'?'영웅':'전설'}</i>}</button>;})}
    <div className="tc-loadout-caption">장착 장비를 눌러 상세 비교 · 해제 · 강화를 확인합니다.</div>
    {noRealEquipment&&!sandboxGame&&<div className="tc-inventory-sandbox-entry"><b>장비가 아직 없습니다.</b><span>실제 저장을 건드리지 않고 7슬롯 장비 화면을 시험할 수 있습니다.</span><button onClick={startInventorySandbox}>테스트 장비 채우기</button></div>}
   </section>

   <section className="tc-storage-board">
    <div className="tc-storage-head"><div><small>QUARTERMASTER STORAGE</small><b>영구 보관함</b><em>{categoryNames[category]} · {visible.length}종</em></div><button className={toolsOpen?'active':''} onClick={()=>setToolsOpen(v=>!v)} aria-label="검색과 정렬"><Glyph name="filter"/> 정렬</button></div>
    <div className="tc-storage-categories">{categorySet.map(c=><button key={c} aria-selected={category===c} aria-label={categoryNames[c]} onClick={()=>{setCategory(c);setSelected(null);setFilter({tier:0,status:false});setPage(0);}}><Glyph name={c}/><small>{categoryNames[c]}</small></button>)}</div>
    {toolsOpen&&<div className="tc-storage-tools"><input aria-label="아이템 검색" placeholder="이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="정렬" value={sort} onChange={e=>setSort(e.target.value as InventorySort)}><option value="default">기본 정렬</option><option value="name">이름순</option><option value="tier">티어 높은순</option><option value="quantity">수량 많은순</option></select>{tierVisible&&<select aria-label="티어 필터" value={filter.tier} onChange={e=>{setFilter({...filter,tier:+e.target.value});setPage(0);}}>{[0,1,2,3,4,5].map(t=><option key={t} value={t}>{t?'T'+t:'전체 티어'}</option>)}</select>}{statusLabel&&<label><input type="checkbox" checked={filter.status} onChange={e=>setFilter({...filter,status:e.target.checked})}/>{statusLabel}</label>}</div>}
    <div className="tc-storage-grid">{shown.map(i=>{const comparison=i.category==='equipment'?comparisonFor(i.sourceId):null;return <button key={i.key} className={'tc-storage-item'+(i.grade?' grade-'+i.grade:'')+(i.equipped?' equipped':'')} aria-label={i.name+' · '+i.quantity+'개'} aria-pressed={selected===i.key} onClick={()=>setSelected(i.key)}><div className="tc-storage-icon"><Glyph name={i.iconId}/>{i.tier&&<span>T{i.tier}</span>}{i.grade&&<span className={'tc-storage-grade grade-'+i.grade}>{i.grade==='common'?'일반':i.grade==='uncommon'?'고급':i.grade==='rare'?'희귀':i.grade==='heroic'?'영웅':'전설'}</span>}</div><strong>{i.name}</strong>{comparison&&<span className={'tc-storage-impact '+(i.equipped?'remove':'equip')}>{i.equipped?'해제':'장착'} · 공 {signed(comparison.delta.attack)} · 방 {signed(comparison.delta.defense)} · HP {signed(comparison.delta.hp)}</span>}<small>{i.stack?i.quantity.toLocaleString()+'개':i.equipped?'장착 중':i.enhancement!==undefined?'+'+i.enhancement:'1개'}</small>{i.enhancement!==undefined&&i.enhancement>0&&<b className="tc-storage-enhance">+{i.enhancement}</b>}{i.equipped&&<em aria-label="장착 중">●</em>}</button>})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-storage-item empty" aria-hidden="true" key={'empty'+i}/>)}</div>
    <Pager page={safe} count={pages} onChange={setPage}/>
   </section>
  </div>
  {item&&<InventoryDetailSheet item={item} comparison={item.category==='equipment'?comparisonFor(item.sourceId):null} onClose={close} enhancementAction={item.category==='equipment'&&item.modern?()=>{close();onEnhancement(sandboxGame?undefined:item.sourceId,sandboxGame?undefined:item.key);}:undefined} marketAction={marketAction} marketDisabled={marketDisabled} marketLabel={marketLabel} dangerAction={item.category==='equipment'&&item.modern?dismantleSelected:undefined} dangerDisabled={dismantleDisabled} dangerLabel={busy?'분해 처리 중':dismantleLabel} {...{action,label,disabled}}/>}
 </Screen>;
}
