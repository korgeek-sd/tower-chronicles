import React,{useEffect,useMemo,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {appearanceById,type AppearanceRarity} from '../../game/data/cosmetics';
import {EQUIPMENT_GRADE_NAMES} from '../../game/data/equipment';
import {RECORD_COLLECTION_SETS,recordCollectionProgress,recordCollectionRewardLabel,recordEquipmentLabel,recordCollectionBonuses,type RecordKind,type RecordCollectionSet} from '../../game/data/recordCollections';
import {registerCollectionEquipment} from '../../game/engine/collection';
import {getCollectionEquipmentRegistrations,registerOnlineCollectionEquipment} from '../../online/collection';
import {EquipmentArt} from '../inventory/EquipmentArt';
import {assetUrl} from '../../game/data/graphics';
import {Glyph,Screen} from '../../ui/mobile';
import './record-collection.css';

type Props={game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;onlineAccount?:boolean;onServerRecord?:(record:CloudSaveRecord,message:string)=>void;onAppearances?:()=>void};
const RARITIES:ReadonlyArray<'ALL'|AppearanceRarity>=['ALL','C','B','A','SR','SSR'];
export function RecordCollectionScreen({game,setGame,onlineLease=null,onlineAccount=false,onServerRecord,onAppearances}:Props){
 const [kind,setKind]=useState<RecordKind>('appearance');
 const [rarity,setRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const [status,setStatus]=useState<'all'|'progress'|'ready'|'complete'>('all');
 const [query,setQuery]=useState('');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [registered,setRegistered]=useState<string[]>([]);
 const [loading,setLoading]=useState(false),[working,setWorking]=useState(false);
 const [error,setError]=useState(''),[itemId,setItemId]=useState('');
 useEffect(()=>{
  if(!onlineLease){setRegistered([]);setLoading(false);return;}
  let active=true;setLoading(true);setError('');
  void getCollectionEquipmentRegistrations(onlineLease).then(rows=>{if(active)setRegistered(rows.map(row=>row.setId));})
   .catch(err=>{if(active)setError(err instanceof Error?err.message:'등록 내역을 확인하지 못했습니다.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[onlineLease?.leaseId,onlineLease?.generation]);
 const known=useMemo(()=>new Set(onlineLease?registered:Object.keys(game.collectionRegisteredItems??{})),[registered,onlineLease,game.collectionRegisteredItems]);
 const unlocked=game.cosmetics.unlockedAppearanceIds;
 const unlockedSet=new Set(unlocked);
 const totals=recordCollectionBonuses(unlocked,known);
 const completed=RECORD_COLLECTION_SETS.filter(set=>recordCollectionProgress(set,unlocked,known).complete).length;
 const lists=RECORD_COLLECTION_SETS.filter(set=>set.kind===kind&&
  (rarity==='ALL'||set.rarity===rarity)&&
  (status==='all'||(status==='complete'&&recordCollectionProgress(set,unlocked,known).complete)||
   (status==='ready'&&!recordCollectionProgress(set,unlocked,known).complete&&(
     set.kind==='appearance'?recordCollectionProgress(set,unlocked,known).count>=1:
     game.equipmentItems.some(item=>item.kind===set.equipment?.kind&&item.grade===set.equipment?.grade&&!Object.values(game.equipped).includes(item.id))
   ))||(status==='progress'&&!recordCollectionProgress(set,unlocked,known).complete))&&
  (!query.trim()||(set.name+' '+set.description+' '+set.appearanceIds.map(id=>appearanceById(id)?.name).join(' ')+' '+recordEquipmentLabel(set)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 );
 const selected=selectedId?RECORD_COLLECTION_SETS.find(set=>set.id===selectedId&&set.kind===kind):undefined;
 const progress=selected?recordCollectionProgress(selected,unlocked,known):null;
 const canRegister=!!selected&&selected.kind==='equipment'&&!known.has(selected.id)&&!game.expedition&&!working&&!loading&&(!onlineAccount||!!onlineLease);
 const requirement=selected?.equipment;
 const candidates=requirement?game.equipmentItems.filter(item=>item.kind===requirement.kind&&item.grade===requirement.grade&&item.id!=='starter-v2'&&!Object.values(game.equipped).includes(item.id)):[];
 const changeKind=(next:RecordKind)=>{setKind(next);setSelectedId(null);setRarity('ALL');setStatus('all');setQuery('');setItemId('');setError('');};
 const close=()=>{if(!working){setSelectedId(null);setItemId('');setError('');}};
 useEffect(()=>{
  if(!selectedId)return;
  const onEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!working)close();};
  document.addEventListener('keydown',onEscape);
  return()=>document.removeEventListener('keydown',onEscape);
 },[selectedId,working]);
 async function submitRegistration(){
  if(!selected||!canRegister||!itemId)return;
  const setId=selected.id;
  setWorking(true);setError('');
  try{
   if(onlineLease){
    if(!onServerRecord)throw Error('서버 저장 동기화가 필요합니다.');
    const result=await registerOnlineCollectionEquipment(onlineLease,setId,itemId);
    setRegistered(old=>old.includes(setId)?old:[...old,setId]);
    onServerRecord(result.record,'유물 컬렉션 등록 완료');
   }else{
    if(onlineAccount)throw Error('게임 서버에 연결한 뒤 등록해 주세요.');
    setGame(state=>registerCollectionEquipment(state,setId,itemId));
   }
   setSelectedId(null);setItemId('');
  }catch(err){
   setError(err instanceof Error?err.message:'장비 등록에 실패했습니다.');
   if(onlineLease)try{const rows=await getCollectionEquipmentRegistrations(onlineLease);setRegistered(rows.map(row=>row.setId));}catch{}
  }finally{setWorking(false);}
 }
 return <Screen title="기록의 서고" className="tc-record-screen" hideHeader>
  <div className="tc-record-root">
   <header className="tc-record-header">
    <div className="tc-record-header-art" aria-hidden="true"><span>✥</span><span>✦</span></div>
    <div className="tc-record-heading">
     <small>THE ARCHIVE OF THE TOWER</small>
     <h1>기록의 서고</h1>
     <p>잊힌 이름도, 사라진 이야기도 이곳에 다시 기록된다.</p>
    </div>
    {onAppearances&&<button className="tc-record-appearance-link" type="button" onClick={onAppearances}><Glyph name="cosmetics"/> 외형 목록 <span aria-hidden="true">›</span></button>}
   </header>
   <div className="tc-record-summary" aria-label="컬렉션 달성 현황">
    <div className="tc-record-completion">
     <span className="tc-record-summary-mark" aria-hidden="true"><Glyph name="bestiary"/></span>
     <span className="tc-record-completion-copy">완성한 기록 <strong>{completed}<small> / {RECORD_COLLECTION_SETS.length}</small></strong></span>
    </div>
    <div className="tc-record-summary-attributes">
     <span>누적 능력치</span>
     <div><span><Glyph name="sword"/> 공격 <strong>+{totals.attack}</strong></span><span><Glyph name="defense"/> 방어 <strong>+{totals.defense}</strong></span><span><Glyph name="health"/> HP <strong>+{totals.hp}</strong></span></div>
    </div>
   </div>
   <nav className="tc-record-tabs" aria-label="컬렉션 분류">
    {([['appearance','인물의 기록'],['equipment','유물의 기록']] as const).map(([id,label])=><button key={id} type="button" className={kind===id?'active':''} aria-current={kind===id?'page':undefined} onClick={()=>changeKind(id)}>
     <Glyph name={id==='appearance'?'cosmetics':'inventory'}/><span>{label}</span><small>{RECORD_COLLECTION_SETS.filter(s=>s.kind===id).length}</small>
    </button>)}
   </nav>
   <div className="tc-record-filters">
    <label className="tc-record-search"><Glyph name="search"/><span className="sr-only">컬렉션 검색</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="기록 이름·재료 검색" aria-label="컬렉션 검색"/></label>
    <select aria-label="진행 상태" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="all">전체</option><option value="progress">미완성</option><option value="ready">진행 중·등록 가능</option><option value="complete">완성</option></select>
   </div>
   <div className="tc-record-rarity" role="group" aria-label="등급 선택">{RARITIES.map(value=><button key={value} className={'tc-record-grade-'+value} type="button" aria-pressed={rarity===value} onClick={()=>setRarity(value)}>{value==='ALL'?'전체':value}</button>)}</div>
   {error&&!selected&&<p className="tc-record-error" role="alert">{error}</p>}
   <div className="tc-record-list" role="list" aria-label={kind==='appearance'?'인물의 기록 목록':'유물의 기록 목록'}>
    {lists.map(set=>{
     const p=recordCollectionProgress(set,unlocked,known);
     const portrait=set.kind==='appearance'?appearanceById(set.appearanceIds[0]):null;
     return <button type="button" role="listitem" className={'tc-record-entry tc-record-entry-'+set.rarity+(p.complete?' is-complete':'')} key={set.id} onClick={()=>{setSelectedId(set.id);setItemId('');setError('');}}>
      <span className="tc-record-entry-art" aria-hidden="true">
       {portrait?.imagePath?<img src={assetUrl(portrait.imagePath)} alt=""/>:set.equipment?<EquipmentArt kind={set.equipment.kind} grade={set.equipment.grade}/>:<Glyph name="cosmetics"/>}
       <span className="tc-record-entry-crest">{set.kind==='appearance'?'✣':'✦'}</span>
      </span>
      <span className="tc-record-entry-info">
       <strong>{set.name}</strong>
       <span className="tc-record-entry-description">{set.description}</span>
       <small className={'tc-record-rarity-tag rarity-'+set.rarity}>{set.rarity}</small>
      </span>
      <span className="tc-record-entry-reward">
       <small>완성 보너스</small>
       <strong>{recordCollectionRewardLabel(set)}</strong>
       <span className="tc-record-progress"><i><span style={{width:100*p.count/p.total+'%'}}/></i><b>{p.count}/{p.total}</b></span>
       <small className={p.complete?'tc-record-done':'tc-record-not-done'}>{p.complete?'✥ 기록 완성':'기록 미완성'}</small>
      </span>
      <span className="tc-record-entry-arrow" aria-hidden="true">›</span>
     </button>;
    })}
    {lists.length===0&&<p className="tc-record-empty">조건에 맞는 기록이 없습니다.</p>}
   </div>
   <footer className="tc-record-footnote"><span aria-hidden="true">ⓘ</span> 인물은 해금 즉시 자동 등록 · 유물은 장비 소모 시 등록 · 완성 보너스 영구 적용</footer>
  </div>
  {selected&&progress&&<div className="tc-record-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
   <section className="tc-record-dialog" role="dialog" aria-modal="true" aria-label="기록 상세 정보">
    <header><div><small>{selected.kind==='appearance'?'인물의 기록':'유물의 기록'} · {selected.rarity}</small><h2>{selected.name}</h2></div><button type="button" disabled={working} onClick={close} aria-label="닫기">×</button></header>
    <p>{selected.description}</p>
    <div className="tc-record-dialog-reward"><span>{progress.complete?'적용 중인 영구 효과':'완성 시 영구 효과'}</span><strong>{recordCollectionRewardLabel(selected)}</strong></div>
    <div className="tc-record-detail-head"><strong>등록 조건</strong><span>{progress.count} / {progress.total}</span></div>
    <div className="tc-record-materials">
     {selected.appearanceIds.map(id=>{
      const appearance=appearanceById(id),owned=unlockedSet.has(id);
      return <div className={'tc-record-material'+(owned?' is-owned':'')} key={id}>
       <div className="tc-record-material-art">{appearance?.imagePath?<img src={assetUrl(appearance.imagePath)} alt=""/>:<span>?</span>}</div>
       <span>{appearance?.name??id}</span><small>{owned?'자동 등록 완료':'미해금'}</small>
      </div>;
     })}
     {selected.equipment&&<div className={'tc-record-material'+(known.has(selected.id)?' is-owned':'')}>
      <div className="tc-record-material-art"><EquipmentArt kind={selected.equipment.kind} grade={selected.equipment.grade}/></div>
      <span>{recordEquipmentLabel(selected)}</span><small>{known.has(selected.id)?'등록 완료':'장비 1개 필요'}</small>
     </div>}
    </div>
    {selected.kind==='equipment'&&!known.has(selected.id)&&<>
     <div className="tc-record-register">
      <label htmlFor="tc-record-equipment-select">등록할 장비</label>
      <select id="tc-record-equipment-select" value={itemId} onChange={e=>setItemId(e.target.value)} disabled={!canRegister}>
       <option value="">장비 선택</option>
       {candidates.map(item=><option key={item.id} value={item.id}>{recordEquipmentLabel(selected)} +{item.enhancement}</option>)}
      </select>
      <small>등록하면 장비 1개가 영구 소모됩니다. 장착 중인 장비와 기본 지급 장비는 등록할 수 없습니다.</small>
     </div>
     {candidates.length===0&&<p className="tc-record-tip">등록 가능한 장비가 없습니다. 장비를 획득하거나 장착을 해제해 주세요.</p>}
    </>}
    {error&&<p role="alert" className="tc-record-error">{error}</p>}
    <footer>
     <button type="button" onClick={close} disabled={working}>닫기</button>
     {selected.kind==='equipment'&&!known.has(selected.id)&&<button type="button" className="primary" disabled={!canRegister||!itemId} onClick={()=>void submitRegistration()}>{working?'등록 중…':loading?'서버 확인 중…':'장비 소모하여 등록'}</button>}
     {selected.kind==='appearance'&&<span>{progress.complete?'기록 복원 완료':'필요한 외형을 해금하면 자동으로 복원됩니다.'}</span>}
    </footer>
   </section>
  </div>}
 </Screen>;
}
