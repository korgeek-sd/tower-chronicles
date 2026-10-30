import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {GameState,EquipmentItem} from '../../game/types';
import {RECORD_COLLECTIONS,collectionRecordProgress,collectionRecordBonuses,equipmentRecordEntryId,type CollectionRecord} from '../../game/data/recordCollections';
import {appearanceById} from '../../game/data/cosmetics';
import {assetUrl} from '../../game/data/graphics';
import {EQUIPMENT_GRADE_NAMES,equipmentItemName} from '../../game/data/equipment';
import {EquipmentArt} from '../inventory/EquipmentArt';
import {registerCollectionEquipment} from '../../game/engine/collection';
import {getCollectionEquipmentRegistrations,registerOnlineCollectionEquipment} from '../../online/collection';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import './record-collections.css';

type Props={
 game:GameState;
 setGame:React.Dispatch<React.SetStateAction<GameState>>;
 onlineLease?:GameplayLease|null;
 onlineAccount?:boolean;
 onServerRecord?:(record:CloudSaveRecord,message:string)=>void;
 onAppearanceList?:()=>void;
 onClose?:()=>void;
};
const rarityLabels={C:'일반',B:'고급',A:'희귀',SR:'영웅',SSR:'전설'};
const bonusLabels={hp:'최대 HP',attack:'공격력',defense:'방어력'};
const rewardText=(record:CollectionRecord)=>bonusLabels[record.reward.stat]+' +'+record.reward.value;
const requirementLabel=(item:{kind:EquipmentItem['kind'];grade:EquipmentItem['grade']})=>EQUIPMENT_GRADE_NAMES[item.grade]+' '+equipmentItemName({...item,id:'preview',enhancement:0});
/** A single scrollable list and a modal for details; never swallow the primary hub navigation. */
export function RecordCollectionsScreen({game,setGame,onlineLease=null,onlineAccount=false,onServerRecord,onAppearanceList,onClose}:Props){
 const [kind,setKind]=useState<'appearance'|'equipment'>('appearance');
 const [filter,setFilter]=useState<'all'|'progress'|'complete'>('all');
 const [query,setQuery]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [registrationIds,setRegistrationIds]=useState<string[]>([]);
 const [loaded,setLoaded]=useState(!onlineAccount);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [targetIndex,setTargetIndex]=useState<number|null>(null);
 const [itemId,setItemId]=useState('');
 const [confirming,setConfirming]=useState(false);
 const closeButton=useRef<HTMLButtonElement>(null);
 const trigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
  if(!onlineLease){setRegistrationIds([]);setLoaded(!onlineAccount);return;}
  let active=true;setLoaded(false);setError('');
  void getCollectionEquipmentRegistrations(onlineLease).then(rows=>{
   if(active){setRegistrationIds(rows.map(row=>row.setId));setLoaded(true);}
  }).catch(e=>{if(active){setError(e instanceof Error?e.message:'등록 정보를 불러오지 못했습니다.');setLoaded(false);}});
  return()=>{active=false;};
 },[onlineLease?.leaseId,onlineLease?.generation,onlineAccount]);
 useEffect(()=>{
  if(!selectedId)return;
  closeButton.current?.focus();
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setSelectedId(null);setTargetIndex(null);setConfirming(false);}
   if(event.key!=='Tab')return;
   const dialog=closeButton.current?.closest('[role="dialog"]');
   if(!dialog)return;
   const list=Array.from(dialog.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button:not([disabled]),select:not([disabled])'));
   const first=list[0],last=list[list.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',onKey);
  return()=>{document.removeEventListener('keydown',onKey);trigger.current?.focus();};
 },[selectedId]);
 const owned=game.cosmetics.unlockedAppearanceIds;
 const registered=new Set(onlineAccount?registrationIds:Object.keys(game.collectionRegisteredItems??{}));
 const bonuses=collectionRecordBonuses(owned,registered);
 const filtered=useMemo(()=>RECORD_COLLECTIONS.filter(record=>{
  if(record.kind!==kind)return false;
  const p=collectionRecordProgress(record,owned,registered);
  if(filter==='complete'&&!p.complete)return false;
  if(filter==='progress'&&(p.complete||p.count===0))return false;
  const search=query.trim().toLocaleLowerCase();
  return !search||record.name.toLocaleLowerCase().includes(search)||record.description.toLocaleLowerCase().includes(search)||
   (record.kind==='appearance'&&record.appearanceIds.some(id=>appearanceById(id)?.name.includes(search)));
 }),[kind,filter,query,game,registrationIds]);
 const selected=RECORD_COLLECTIONS.find(x=>x.id===selectedId)??null;
 const selection=selected?collectionRecordProgress(selected,owned,registered):null;
 const requirement=selected?.kind==='equipment'&&targetIndex!==null?selected.equipment[targetIndex]:null;
 const target=selected?.kind==='equipment'&&targetIndex!==null?equipmentRecordEntryId(selected,targetIndex):null;
 const eligible=requirement?game.equipmentItems.filter(item=>item.kind===requirement.kind&&item.grade===requirement.grade&&item.id!=='starter-v2'&&!Object.values(game.equipped).includes(item.id)):[];
 const canSubmit=Boolean(selected?.kind==='equipment'&&target&&itemId&&loaded&&!busy&&!game.expedition&&(!onlineAccount||(onlineLease&&onServerRecord)));
 function close(){if(busy)return;setSelectedId(null);setTargetIndex(null);setConfirming(false);setItemId('');setError('');}
 async function register(){
  if(!canSubmit||!target)return;
  setBusy(true);setError('');
  try{
   if(onlineAccount){
    if(!onlineLease||!onServerRecord)throw Error('온라인 연결이 필요합니다.');
    const result=await registerOnlineCollectionEquipment(onlineLease,target,itemId);
    onServerRecord(result.record,'유물의 기록에 장비를 등록했습니다.');
    setRegistrationIds(current=>current.includes(target)?current:[...current,target]);
   }else{
    setGame(current=>registerCollectionEquipment(current,target,itemId));
   }
   setTargetIndex(null);setItemId('');setConfirming(false);
  }catch(e){
   setError(e instanceof Error?e.message:'장비 등록이 실패했습니다.');
   if(onlineLease)try{const rows=await getCollectionEquipmentRegistrations(onlineLease);setRegistrationIds(rows.map(row=>row.setId));}catch{}
  }finally{setBusy(false);}
 }
 return <section className="tc-record-screen" aria-label="기록의 서고">
  <header className="tc-record-heading"><div><small>THE ARCHIVE OF THE TOWER</small><h1>기록의 서고</h1></div><div className="tc-record-heading-actions">{onAppearanceList&&<button type="button" onClick={onAppearanceList}>외형 목록</button>}{onClose&&<button type="button" aria-label="서고 닫기" onClick={onClose}>×</button>}</div></header>
  <div className="tc-record-summary"><div><small>완성한 컬렉션</small><strong>{loaded?bonuses.completed:'-'} <em>/ {bonuses.total}</em></strong><progress value={loaded?bonuses.completed:0} max={bonuses.total}/></div><div><small>누적 컬렉션 능력치</small><strong>공격력 +{loaded?bonuses.attack:0}</strong><span>방어력 +{loaded?bonuses.defense:0} · HP +{loaded?bonuses.hp:0}</span></div></div>
  <div className="tc-record-tabs" role="group" aria-label="컬렉션 종류"><button type="button" aria-pressed={kind==='appearance'} onClick={()=>{setKind('appearance');setSelectedId(null);}}>인물의 기록</button><button type="button" aria-pressed={kind==='equipment'} onClick={()=>{setKind('equipment');setSelectedId(null);}}>유물의 기록</button></div>
  <div className="tc-record-tools"><input aria-label="컬렉션 검색" placeholder="기록 이름 검색" value={query} onChange={event=>setQuery(event.target.value)}/><select aria-label="진행 상태 필터" value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">전체</option><option value="progress">진행 중</option><option value="complete">완성</option></select></div>
  <div className="tc-record-list" role="list" aria-label={kind==='appearance'?'인물 컬렉션 목록':'장비 컬렉션 목록'}>
   {filtered.map(record=>{
    const p=collectionRecordProgress(record,owned,registered);
    return <button type="button" role="listitem" key={record.id} className={'tc-record-entry tc-feel-press'+(p.complete?' complete':'')} onClick={e=>{trigger.current=e.currentTarget;setSelectedId(record.id);setError('');setTargetIndex(null);}} aria-haspopup="dialog" aria-label={record.name+' 상세 보기'}>
     <span className="tc-record-emblem">✥</span><span className="tc-record-entry-main"><strong>{record.name}</strong><small>{rarityLabels[record.rarity]} · {rewardText(record)}</small><span className="tc-record-tiny-progress"><i style={{width:(p.count/p.total*100)+'%'}}/></span></span><span className="tc-record-progress">{loaded||kind==='appearance'?p.count:'-'} / {p.total}<small>{p.complete?'완성':'미완성'}</small></span><span className="tc-record-chevron">›</span>
    </button>;
   })}
   {!filtered.length&&<p className="tc-record-empty">조건에 맞는 기록이 없습니다.</p>}
  </div>
  <p className="tc-record-footnote">{kind==='appearance'?'외형 해금 시 자동 기록 · 외형 소모 없음':'장착하지 않은 장비를 각 칸에 1개씩 등록 · 등록 장비 영구 소모'}</p>
  {!loaded&&<p className="tc-record-status" role="status">서버 등록 기록을 확인하는 중입니다. 장비 등록은 확인 후 가능합니다.</p>}
  {error&&!selected&&<p role="alert" className="tc-record-error">{error}</p>}
  {selected&&<div className="tc-record-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
   <section className="tc-record-dialog" role="dialog" aria-modal="true" aria-label={selected.name+' 상세정보'}>
    <header><div><small>{selected.kind==='appearance'?'인물의 기록':'유물의 기록'} · {rarityLabels[selected.rarity]}</small><h2>{selected.name}</h2></div><button ref={closeButton} type="button" aria-label="컬렉션 상세 닫기" onClick={close} disabled={busy}>×</button></header>
    <p className="tc-record-description">{selected.description}</p>
    <div className="tc-record-reward"><small>완성 보너스 {selection?.complete?'· 적용 중':''}</small><strong>{rewardText(selected)}</strong><span>완성 조건 {selection?.count} / {selection?.total}</span></div>
    <div className="tc-record-requirements">
     {selected.kind==='appearance'?selected.appearanceIds.map(id=>{const a=appearanceById(id);const has=owned.includes(id);return <div key={id} className={'tc-record-requirement'+(has?' acquired':'')}><div className="tc-record-image">{a?.imagePath?<img src={assetUrl(a.imagePath)} alt=""/>:<span>?</span>}</div><span>{a?.name??id}<small>{has?'자동 등록 완료':'미해금'}</small></span><b>{has?'✓':'—'}</b></div>;})
      :selected.equipment.map((req,index)=>{
       const id=equipmentRecordEntryId(selected,index),has=registered.has(id);
       return <div key={id} className={'tc-record-requirement'+(has?' acquired':'')}><div className="tc-record-image"><EquipmentArt kind={req.kind} grade={req.grade}/></div><span>{requirementLabel(req)}<small>{has?'등록 완료':'미등록 · 장비 1개 필요'}</small></span><button type="button" disabled={has||!loaded||busy||!!game.expedition} onClick={()=>{setTargetIndex(index);setItemId('');setConfirming(false);setError('');}}>{has?'✓':'등록'}</button></div>;
      })}
    </div>
    {requirement&&target&&!registered.has(target)&&<div className="tc-record-register"><h3>장비 등록</h3><p>{requirementLabel(requirement)}을 등록하면 장비가 영구 소모됩니다. 장착 중인 장비와 기본 지급 장비는 등록할 수 없습니다.</p><label>등록할 장비<select value={itemId} onChange={e=>{setItemId(e.target.value);setConfirming(false);}}><option value="">장비 선택</option>{eligible.map(item=><option key={item.id} value={item.id}>{equipmentItemName(item)} · +{item.enhancement} ({item.id.slice(-6)})</option>)}</select></label>{!eligible.length&&<small>등록 가능한 장비가 없습니다. 같은 종류와 등급의 장비를 확보해 주세요.</small>}
     <div className="tc-record-register-actions"><button type="button" onClick={()=>{setTargetIndex(null);setConfirming(false);}}>취소</button><button type="button" disabled={!canSubmit} onClick={()=>confirming?void register():setConfirming(true)}>{busy?'등록 중':confirming?'확인 · 영구 소모':'장비 등록 진행'}</button></div>
    </div>}
    {error&&<p className="tc-record-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={close} disabled={busy}>닫기</button></footer>
   </section>
  </div>}
 </section>;
}
