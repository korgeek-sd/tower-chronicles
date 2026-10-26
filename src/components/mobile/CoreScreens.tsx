import {GameSelect} from '../../ui/GameSelect';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {GameState,Tower,Potion} from '../../game/types';
import {CONFIG,POTIONS,SKILLS,TOWERS,WEAPONS,generalPotionIds,potionIds,towerIds,PLAYABLE_TOWERS} from '../../game/data/config';
import {equippedItem,itemName,stats,weaponOf} from '../../game/engine/state';
import {monsterFor} from '../../game/engine/drops';
import {APPEARANCES,APPEARANCE_RARITIES,appearanceById,type AppearanceRarity} from '../../game/data/cosmetics';
import {APPEARANCE_SETS,collectionSetProgress,collectionSetBonusLabel,collectionEquipmentLabel,type AppearanceSet} from '../../game/data/appearanceSets';
import './cosmetics-catalog.css';
import './iron-catalog.css';
import './compact-appearances.css';
import './iron-camp.css';
import './village-camp.css';
import {EquipmentArt} from '../inventory/EquipmentArt';
import {selectAppearance} from '../../game/engine/cosmetics';
import {appearanceLevel,appearanceShardCount,appearanceShardCost,APPEARANCE_MAX_LEVEL} from '../../game/data/appearanceProgress';
import {appearanceEffectFor} from '../../game/data/appearanceEquipAssignments';
import {formatAppearanceEquipEffect} from '../../game/data/appearanceEquipEffects';
import {advanceAppearance} from '../../online/appearanceProgress';
import {registerCollectionEquipment} from '../../game/engine/collection';
import {getCollectionEquipmentRegistrations,registerOnlineCollectionEquipment} from '../../online/collection';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {EQUIPMENT_GRADE_NAMES,equipmentDefinition} from '../../game/data/equipment';
import {applyPreset,getPresetSlotLimit,renamePreset,savePreset} from '../../game/engine/presets';
import {jobById} from '../../game/jobs/catalog';
import {assetUrl,playerGraphicForJob} from '../../game/data/graphics';
import {lootTotals} from '../../game/engine/loot';
import {Glyph,Pager,Screen,Segments,Stat} from '../../ui/mobile';
import {GOLD_SHOP_PACKAGES,formatKrw,getGoldPackageBySku} from '../../shop/catalog';
import {getHuntingState} from '../../online/hunting';
import type {GameplayLease} from '../../online/gameSession';
import {huntingLevel,type HuntingState} from '../../game/hunting/model';

export type AppPage='quests'|'craft'|'world'|'home'|'stats'|'hunt'|'towers'|'floor'|'battle'|'inventory'|'enhancement'|'skills'|'jobs'|'cosmetics'|'market'|'gold-exchange'|'association'|'seal'|'occupation'|'settings'|'bestiary'|'shop'|'bank';

export function HomeScreen({game,onMove,onOpenJobs,nickname,onOpenMail=()=>{},mailUnread=0,lease=null,userId=null}:{onOpenMail?:()=>void;mailUnread?:number;nickname?:string;game:GameState;onMove:(p:AppPage)=>void;onOpenJobs:(tab:'register'|'list')=>void;lease?:GameplayLease|null;userId?:string|null}){
 const [showAllFacilities,setShowAllFacilities]=useState(false);
 const facilityToggle=useRef<HTMLButtonElement>(null);
 const [huntStatus,setHuntStatus]=useState<Pick<HuntingState,'vitality'|'maxHp'|'maxMp'|'experience'>|null>(null);
 useEffect(()=>{
  let cancelled=false;
  if(lease){
   void getHuntingState(lease).then(state=>{if(!cancelled)setHuntStatus(state);}).catch(()=>{if(!cancelled)setHuntStatus(null);});
  }else if(!userId){
   try{const raw=localStorage.getItem('tower-instant-hunting-guest-v1');const stored=raw?JSON.parse(raw) as HuntingState:null;
    setHuntStatus(stored&&typeof stored.vitality==='number'?stored:null);
   }catch{setHuntStatus(null);}
  }else setHuntStatus(null);
  return()=>{cancelled=true;};
 },[lease?.leaseId,lease?.generation,userId]);
 const equipped=game.expedition?.equipment??game.equipped;
 const st=stats(game,equipped),weaponId=weaponOf(game,equipped),job=jobById(game.currentJobId);
 const equippedArt=playerGraphicForJob(game.currentJobId,game.cosmetics.selectedAppearanceId).image.idle;
 const portrait=(game.cosmetics.selectedAppearanceId!=='default'||job?.visualAssetKey)&&equippedArt?assetUrl(equippedArt):null;
 const mainFacilities=[
  {id:'craft',glyph:'craft',name:'제작',action:()=>onMove('craft')},
  {id:'skills',glyph:'skills',name:'스킬트리',action:()=>onMove('skills')},
  {id:'appearance-summon',glyph:'jobs',name:'외형 소환',action:()=>onOpenJobs('register')},
  {id:'gold-exchange',glyph:'market',name:'골드 거래소',action:()=>onMove('gold-exchange')},
  {id:'occupation',glyph:'towers',name:'점령전',action:()=>onMove('occupation')},
  {id:'mail',glyph:'mail',name:'우편함',action:onOpenMail}
 ];
 const extraFacilities=[
  {id:'bank',glyph:'tickets',name:'은행·대출',action:()=>onMove('bank')},
  {id:'quests',glyph:'bestiary',name:'의뢰',action:()=>onMove('quests')},
  {id:'stats',glyph:'skill',name:'스탯 분배',action:()=>onMove('stats')},
  {id:'bestiary',glyph:'bestiary',name:'생물록',action:()=>onMove('bestiary')},
  {id:'cosmetics',glyph:'cosmetics',name:'컬렉션',action:()=>onMove('cosmetics')},
  {id:'jobs-list',glyph:'jobs',name:'외형 목록',action:()=>onOpenJobs('list')},
  {id:'seal',glyph:'association',name:'협회 인장',action:()=>onMove('seal')},
  {id:'association',glyph:'association',name:'원정단',action:()=>onMove('association')},
  {id:'inventory',glyph:'equipment',name:'장비 확인',action:()=>onMove('inventory')},
  {id:'settings',glyph:'settings',name:'설정',action:()=>onMove('settings')}
 ];
 return <Screen title="노바르 거점" className="tc-camp-screen tc-camp-v2-screen tc-iron-camp-screen tc-village-camp-screen" meta={<span className="tc-camp-status">{game.expedition?'원정 중':'출정 대기'}</span>}>
  <div className="tc-camp-v2" aria-label="노바르 거점 로비">
   <section className="tc-camp-v2-dossier" aria-label="캐릭터 정보">
    <div className="tc-camp-v2-portrait">{portrait?<img src={portrait} alt="현재 캐릭터 외형"/>:<Glyph name={weaponId}/>}</div>
    <div className="tc-camp-v2-bio">
     <strong>{nickname??'모험가'}</strong>
     <span>{job?.displayName??'직업 미선택'} {job?.rarity&&<small>{job.rarity}</small>} · Lv.{huntStatus?huntingLevel(huntStatus.experience):'—'}</span>
     <div className="tc-camp-v2-stats">
      <span><b>HP</b><strong>{Math.round(huntStatus?.maxHp??st.hp).toLocaleString()}</strong></span>
      <span><b>MP</b><strong>{huntStatus?.maxMp?.toLocaleString()??'—'}</strong></span>
      <span><b>활력</b><strong>{huntStatus?.vitality.toLocaleString()??'—'}</strong></span>
     </div>
    </div>
    <button type="button" className="tc-camp-v2-profile-link" aria-label="캐릭터 스탯 확인" onClick={()=>onMove('stats')}>›</button>
   </section>
   <section className="tc-village" aria-label="거점 시설">
    <button ref={facilityToggle} type="button" className="tc-village-all" aria-expanded={showAllFacilities} aria-controls="tc-camp-extra-facilities" onClick={()=>setShowAllFacilities(v=>!v)}>{showAllFacilities?'시설 닫기':'전체 시설'} <span aria-hidden="true">{showAllFacilities?'×':'+'}</span></button>
    <header className="tc-village-heading"><div><h2>노바르 거점</h2><span>{game.expedition?'탑에서 원정이 진행 중입니다':'탑의 그늘 아래, 다시 모이는 거점'}</span></div><button type="button" className="tc-feel-press" data-game-feel="press" onClick={()=>onMove('world')}><Glyph name="towers"/>마을 이동 <span aria-hidden="true">›</span></button></header>
    <div className="tc-village-scene"><div className="tc-village-map">
     <img className="tc-village-art" src={assetUrl('assets/backgrounds/hub/novar-village-v2.webp')} alt="" decoding="async"/>
     <nav className="tc-camp-v2-quick" aria-label="노바르 마을 시설 지도">{mainFacilities.map(item=><button type="button" key={item.id} className="tc-feel-press" data-game-feel="press" data-facility={item.id} onClick={item.action}><Glyph name={item.glyph}/><span className="tc-village-nameplate">{item.name}</span>{item.id==='mail'&&mailUnread>0&&<small aria-label={'미확인 우편 '+mailUnread+'개'}>{mailUnread}</small>}</button>)}</nav>
     <div className="tc-village-player" aria-hidden="true">{equippedArt?<img src={assetUrl(equippedArt)} alt=""/>:<Glyph name={weaponId}/>}</div>
     </div>
     {showAllFacilities&&<nav id="tc-camp-extra-facilities" className="tc-camp-v2-extra" aria-label="추가 시설" onKeyDown={e=>{if(e.key==='Escape'){setShowAllFacilities(false);facilityToggle.current?.focus();}}}>{extraFacilities.map(item=><button type="button" key={item.id} data-facility={item.id} onClick={item.action}><Glyph name={item.glyph}/>{item.name}</button>)}</nav>}
     {!showAllFacilities&&<span className="tc-camp-v2-extra-access" data-facility="bestiary" aria-hidden="true"/>}
    </div>
    <nav className="tc-village-services" aria-label="거점 바로가기">{(['bank','association','cosmetics'] as const).map(id=>{const item=extraFacilities.find(facility=>facility.id===id)!;return <button type="button" key={item.id} className="tc-feel-press" data-game-feel="press" data-facility={item.id} onClick={item.action}><Glyph name={item.glyph}/><span>{item.name}</span></button>;})}</nav>
    <nav className="tc-camp-v2-primary" aria-label="주요 행동"><button type="button" className="tc-camp-v2-hunt tc-feel-press" data-facility="hunt" data-game-feel="press" onClick={()=>onMove(game.expedition?'battle':'hunt')}><Glyph name="sword"/><span><b>{game.expedition?'원정 복귀':'출정하기'}</b><small>{game.expedition?'진행 중인 원정으로':'사냥하기 · 사냥터 선택'}</small></span><i aria-hidden="true">→</i></button></nav>
   </section>
   <section id="tc-camp-chat-dock" className="tc-camp-v2-chat-dock" aria-label="거점 실시간 채팅"/>
  </div>
 </Screen>;
}
export function TowersScreen({game,onSelect}:{game:GameState;onSelect:(tower:Tower)=>void}){
 return <Screen eyebrow="EXPEDITION BOARD" title="탑 선택" meta={<span>1~10F</span>}>
  <div className="tc-towers">{towerIds.map((t,i)=><button className="tc-tower" key={t} disabled={!PLAYABLE_TOWERS.includes(t)} onClick={()=>onSelect(t)} style={{'--tower':TOWERS[t].color} as React.CSSProperties}><Glyph name="towers"/><small>TOWER 0{i+1}</small><b>{TOWERS[t].name}</b><span>{TOWERS[t].material} · 발견 {game.progress[t]}F</span><em>{PLAYABLE_TOWERS.includes(t)?'입장 가능':'봉쇄'}</em></button>)}</div>
 </Screen>;
}

export function FloorScreen({game,setGame,tower,floor,setFloor,onBack,onEnter}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;tower:Tower;floor:number;setFloor:(n:number)=>void;onBack:()=>void;onEnter:()=>void}){
 const [tab,setTab]=useState<'bag'|'preset'>('bag'),[presetSlot,setPresetSlot]=useState(1),exp=game.expedition,presetLimit=getPresetSlotLimit(),preset=game.expeditionPresets[presetSlot-1],monster=monsterFor(tower,floor),generalCount=generalPotionIds.reduce((n,p)=>n+game.loadout[p],0),valid=!!game.tickets[tower][floor-1]&&generalCount<=CONFIG.generalPotionLimit;
 function updateBag(p:Potion,value:number){setGame(s=>({...s,loadout:{...s.loadout,[p]:Math.max(0,Math.min(s.potions[p],Math.floor(value)||0))}}));}
 return <Screen eyebrow="EXPEDITION PREP" title={TOWERS[tower].name} meta={<button className="tc-action secondary slim" onClick={onBack}>탑 변경</button>}>
  <div className="tc-floor">
   <div className="tc-floor-hero"><button onClick={()=>setFloor(Math.max(1,floor-1))}>−</button><div className="tc-floor-center"><b>{floor}F</b><small>{floor<=2?'SAFE · PK 불가':floor<=5?'PK 가능':'BOSS 구간'} · 입장권 {game.tickets[tower][floor-1]}장</small><div className="tc-stat-grid"><Stat label="적 HP" value={monster.hp}/><Stat label="공격" value={monster.attack.toFixed(0)}/><Stat label="방어" value={monster.defense.toFixed(0)}/><Stat label="공속" value={monster.speed.toFixed(2)}/></div></div><button onClick={()=>setFloor(Math.min(CONFIG.maxFloor,floor+1))}>+</button></div>
   <div className="tc-floor-content"><Segments items={[['bag','원정 가방'],['preset','프리셋']] as const} value={tab} onChange={setTab} label="원정 준비"/><div className="tc-floor-tabbody">{tab==='bag'?<div className="tc-potion-list">{potionIds.map(p=><label className="tc-potion-row" key={p}><span><b>{POTIONS[p].name}</b><small>T{POTIONS[p].tier} · 창고 {game.potions[p]}개{p==='revival'?' · 최대 '+CONFIG.revivalPotionLimit:''}</small></span><input type="number" min="0" disabled={!!exp||game.potions[p]===0} max={p==='revival'?Math.min(game.potions[p],CONFIG.revivalPotionLimit):game.potions[p]} value={game.loadout[p]} onChange={e=>updateBag(p,+e.target.value)}/></label>)}</div>:<div className="tc-preset"><GameSelect value={presetSlot} onChange={e=>setPresetSlot(+e.target.value)}>{game.expeditionPresets.map((x,i)=><option value={i+1} key={i}>슬롯 {i+1} · {x?.name||'비어 있음'}</option>)}</GameSelect><div className="tc-preset-info"><strong>{preset?.name||'비어 있는 프리셋'}</strong><small>{preset?'장비·스킬·포션 구성을 불러오거나 덮어쓸 수 있습니다.':'현재 구성을 저장할 수 있습니다.'}</small></div><div className="tc-preset-actions"><button disabled={!preset||!!exp} onClick={()=>setGame(s=>applyPreset(s,presetSlot,presetLimit))}>불러오기</button><button disabled={!!exp} onClick={()=>setGame(s=>savePreset(s,presetSlot,preset?.name,presetLimit))}>저장</button><button disabled={!open||!preset||!!exp} onClick={()=>{const name=window.prompt('프리셋 이름',preset?.name);if(name!==null)setGame(s=>renamePreset(s,presetSlot,name,presetLimit));}}>이름</button></div></div>}</div></div>
   <div className="tc-floor-footer"><div className="tc-floor-risk">일반 포션 {generalCount}/{CONFIG.generalPotionLimit}<br/>사망 시 이번 원정 획득물과 남은 원정 포션 소멸</div><button className="tc-floor-enter" disabled={!valid} onClick={onEnter}>{floor}층 입장<small>{TOWERS[tower].material} 수집 · 입장권 1장 사용</small></button></div>
  </div>
 </Screen>;
}

export function SkillsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [page,setPage]=useState(0),PAGE=3,pages=Math.max(1,Math.ceil(SKILLS.length/PAGE)),safe=Math.min(page,pages-1),shown=SKILLS.slice(safe*PAGE,safe*PAGE+PAGE),weapon=weaponOf(game);
 return <Screen eyebrow="COMBAT KIT" title="스킬 구성" meta={<span>{WEAPONS[weapon].name}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'auto 1fr auto',gap:'6px'}}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px'}}>{game.skills.map((id,i)=><label key={i} className="tc-panel" style={{padding:'5px'}}><small style={{fontSize:'7px',color:'var(--muted)'}}>{i+1}순위</small><GameSelect style={{width:'100%',height:'30px',minHeight:0,fontSize:'8px',marginTop:'3px'}} disabled={!!game.expedition} value={id||''} onChange={e=>setGame(s=>{const skills=[...s.skills] as GameState['skills'];skills[i]=e.target.value||null;return {...s,skills};})}><option value="">비움</option>{SKILLS.filter(sk=>game.learned.includes(sk.id)).map(sk=><option key={sk.id} disabled={game.skills.includes(sk.id)&&id!==sk.id} value={sk.id}>{sk.name}</option>)}</GameSelect></label>)}</div>
   <div className="tc-work-grid">{shown.map(sk=><article className="tc-recipe" key={sk.id}><Glyph name="skills"/><div><h2>{sk.name}</h2><p>{sk.description}</p><small>{game.learned.includes(sk.id)?'습득 완료':'스킬북 필요'} · 대기 {sk.cooldown}턴 · {sk.weapons.includes(weapon)?'현재 무기 사용 가능':'무기 불일치'}</small></div></article>)}{Array.from({length:Math.max(0,PAGE-shown.length)},(_,i)=><div className="tc-recipe" key={'s'+i}/>)}</div>
   <Pager page={safe} count={pages} onChange={setPage}/>
  </div>
 </Screen>;
}

const COLLECTION_RARITY_NAMES:Record<AppearanceRarity,string>={C:'일반',B:'고급',A:'희귀',SR:'영웅',SSR:'전설'};
function CollectionToken({id,owned,mini=false,onOpen}:{id:string;owned:boolean;mini?:boolean;onOpen?:(id:string)=>void}){
 const a=appearanceById(id),imageReady=!!a?.imagePath&&a?.artStatus==='ready';
 const content=<>
  {imageReady?<img src={assetUrl(a!.imagePath!)} alt="" loading="lazy"/>:<Glyph name="cosmetics"/>}
  {owned?<span className="tc-collection-token-check" aria-hidden="true">✓</span>:<span className="tc-collection-token-lock" aria-hidden="true">◇</span>}
  {!mini&&<span className="tc-collection-token-rank">{a?.rarity??'C'}</span>}
 </>;
 const props={className:'tc-collection-token '+(owned?'is-owned ':'is-missing ')+'rarity-'+(a?.rarity??'C')+(mini?' is-mini':''),title:(a?.name??id)+' · '+(owned?'보유':'미보유'), 'data-appearance-id':id,'data-rarity':a?.rarity??'C'};
 return onOpen?<button type="button" {...props} aria-label={(a?.name??id)+' · '+(owned?'보유':'미보유')+' 상세 정보'} onClick={e=>{e.stopPropagation();onOpen(id);}}>{content}</button>:<span {...props}>{content}</span>;
}
export function CosmeticsScreen({game,setGame,onlineLease=null,onlineAccount=false,onServerRecord,initialTab='collection',onSummon}:{onSummon?:()=>void;initialTab?:'collection'|'appearance';game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onlineLease?:GameplayLease|null;onlineAccount?:boolean;onServerRecord?:(record:CloudSaveRecord,message:string)=>void}){
 const [tab,setTab]=useState<'collection'|'appearance'>(initialTab);
 const [rarity,setRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState<'all'|'near'|'complete'|'incomplete'|'tracked'>('all');
 const [sort,setSort]=useState<'default'|'nearest'|'bonus'>('default');
 const [selectedSetId,setSelectedSetId]=useState<string>(APPEARANCE_SETS[0]?.id??'');
 const [detailOpen,setDetailOpen]=useState(false);
 const detailCloseRef=useRef<HTMLButtonElement|null>(null);
 const detailTriggerRef=useRef<HTMLButtonElement|null>(null);
 const sheetSwipeStart=useRef<number|null>(null);
 const [trackedIds,setTrackedIds]=useState<string[]>([]);
 const [favoriteIds,setFavoriteIds]=useState<string[]>([]);
 const detailPopup=useRef<HTMLElement>(null);
 const [appearanceDetails,setAppearanceDetails]=useState<string|null>(null);
 const [relatedAppearance,setRelatedAppearance]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const [ownership,setOwnership]=useState<'all'|'owned'|'missing'>('all');
 const [appearanceRarity,setAppearanceRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const [serverRegistrations,setServerRegistrations]=useState<string[]>([]);
 const [registrationLoading,setRegistrationLoading]=useState(false);
 const [registrationError,setRegistrationError]=useState('');
 const [registerPanel,setRegisterPanel]=useState(false);
 const [registerItemId,setRegisterItemId]=useState('');
 const [registering,setRegistering]=useState(false);
 const [appearanceBusy,setAppearanceBusy]=useState(false);
 const [appearanceError,setAppearanceError]=useState('');
 const pendingAdvance=useRef<{appearanceId:string;level:number;requestId:string}|null>(null);
 useEffect(()=>{
  if(!onlineLease){setServerRegistrations([]);setRegistrationLoading(false);return;}
  let live=true;setRegistrationLoading(true);setRegistrationError('');
  void getCollectionEquipmentRegistrations(onlineLease).then(rows=>{if(live)setServerRegistrations(rows.map(r=>r.setId));}).catch(e=>{if(live)setRegistrationError(e instanceof Error?e.message:'등록 기록을 불러오지 못했습니다.');}).finally(()=>{if(live)setRegistrationLoading(false);});
  return()=>{live=false;};
 },[onlineLease?.leaseId,onlineLease?.generation]);
 const registeredIds=new Set(onlineLease?serverRegistrations:Object.keys(game.collectionRegisteredItems??{}));
 const owned=game.cosmetics.unlockedAppearanceIds;
 const ownedSet=new Set(owned);
 const collectible=APPEARANCES.filter(a=>a.rarity);
 const ownedCount=collectible.filter(a=>ownedSet.has(a.id)).length;
 const relevant=APPEARANCE_SETS.filter(s=>{
  const p=collectionSetProgress(s,owned,registeredIds);
  if(rarity!=='ALL'&&s.rarity!==rarity)return false;
  if(status==='near'&&(p.complete||p.total-p.count!==1))return false;
  if(status==='complete'&&!p.complete)return false;
  if(status==='incomplete'&&p.complete)return false;
  if(status==='tracked'&&!trackedIds.includes(s.id))return false;
  const key=query.trim().toLocaleLowerCase();
  return !key||s.name.toLocaleLowerCase().includes(key)||s.description.toLocaleLowerCase().includes(key)||s.appearanceIds.some(id=>appearanceById(id)?.name.toLocaleLowerCase().includes(key))||collectionEquipmentLabel(s.equipment).toLocaleLowerCase().includes(key);
 }).sort((a,b)=>{
  const ap=collectionSetProgress(a,owned,registeredIds),bp=collectionSetProgress(b,owned,registeredIds);
  if(sort==='nearest')return (ap.total-ap.count)-(bp.total-bp.count)||a.id.localeCompare(b.id);
  if(sort==='bonus')return b.reward.value-a.reward.value||a.id.localeCompare(b.id);
  return APPEARANCE_SETS.indexOf(a)-APPEARANCE_SETS.indexOf(b);
 });
 const selected:AppearanceSet|undefined=relevant.find(s=>s.id===selectedSetId)??relevant[0]??APPEARANCE_SETS[0];
 const progress=selected?collectionSetProgress(selected,owned,registeredIds):{count:0,total:0,complete:false};
 const appearances=APPEARANCES.filter(a=>ownership==='all'||(ownership==='owned'?ownedSet.has(a.id):!ownedSet.has(a.id))).filter(a=>appearanceRarity==='ALL'||a.rarity===appearanceRarity).filter(a=>!query.trim()||a.name.includes(query.trim()));
 const viewCount=appearances.length;
 const pages=Math.max(1,Math.ceil(viewCount/4)),safePage=Math.min(page,pages-1);
 const changeTab=(next:'collection'|'appearance')=>{setDetailOpen(false);setTab(next);setPage(0);setQuery('');};
 const toggle=(id:string,values:string[],setter:React.Dispatch<React.SetStateAction<string[]>>)=>setter(values.includes(id)?values.filter(x=>x!==id):[...values,id]);
 const selectedMissing=selected?.appearanceIds.find(id=>!ownedSet.has(id))??selected?.appearanceIds[0];
 const related=APPEARANCE_SETS.filter(s=>relatedAppearance&&s.appearanceIds.includes(relatedAppearance));
 const eligibleItems=selected?game.equipmentItems.filter(item=>item.kind===selected.equipment.kind&&item.grade===selected.equipment.grade&&item.id!=='starter-v2'&&!Object.values(game.equipped).includes(item.id)):[];
 const registerReady=!!selected&&(!onlineAccount||!!onlineLease)&&!registeredIds.has(selected.id)&&!registering&&!registrationLoading&&!game.expedition;
 async function submitAppearanceAdvance(id:string){
  const level=appearanceLevel(game.cosmetics,id);
  if(appearanceBusy||game.expedition||level>=APPEARANCE_MAX_LEVEL)return;
  if(!onlineLease||!onServerRecord){setAppearanceError('외형 해금과 강화는 온라인 접속이 필요합니다.');return;}
  if(appearanceShardCount(game.cosmetics,id)<appearanceShardCost(level)){setAppearanceError('외형 전용 조각이 부족합니다.');return;}
  const pending=pendingAdvance.current;
  const requestId=pending?.appearanceId===id&&pending.level===level?pending.requestId:crypto.randomUUID();
  pendingAdvance.current={appearanceId:id,level,requestId};
  setAppearanceBusy(true);setAppearanceError('');
  try{
   const result=await advanceAppearance(onlineLease,id,requestId);
   onServerRecord(result.record,(level===0?'외형 해금 완료':'외형 강화 완료')+' · Lv.'+result.level);
   pendingAdvance.current=null;
  }catch(e){setAppearanceError(e instanceof Error?e.message:'외형 강화에 실패했습니다.');}
  finally{setAppearanceBusy(false);}
 }
 async function submitRegistration(){
  if(!selected||!registerReady||!registerItemId)return;
  const id=registerItemId,setId=selected.id;
  setRegistering(true);setRegistrationError('');
  try{
   if(onlineLease){
    if(!onServerRecord)throw Error('서버 저장 동기화를 사용할 수 없습니다.');
    const result=await registerOnlineCollectionEquipment(onlineLease,setId,id);
    onServerRecord(result.record,'컬렉션 장비 등록 완료');
    setServerRegistrations(v=>v.includes(setId)?v:[...v,setId]);
   }else setGame(state=>registerCollectionEquipment(state,setId,id));
   setRegisterPanel(false);setRegisterItemId('');
  }catch(error){
   setRegistrationError(error instanceof Error?error.message:'등록 결과를 확인하지 못했습니다.');
   if(onlineLease){
    try{const rows=await getCollectionEquipmentRegistrations(onlineLease);setServerRegistrations(rows.map(r=>r.setId));}catch{}
   }
  }finally{setRegistering(false);}
 }
 useEffect(()=>{
  if(!appearanceDetails&&!relatedAppearance)return;
  const previous=document.activeElement as HTMLElement|null;
  detailPopup.current?.focus();
  const escape=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){setAppearanceDetails(null);setRelatedAppearance(null);}
   if(e.key==='Tab'){
    const buttons=Array.from(detailPopup.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')??[]);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===detailPopup.current)){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('keydown',escape);if(previous?.isConnected)previous.focus();};
 },[appearanceDetails,relatedAppearance]);
 useEffect(()=>{
  if(!detailOpen)return;
  const trigger=detailTriggerRef.current;
  detailCloseRef.current?.focus();
  const onKeyDown=(event:KeyboardEvent)=>{
   if(document.querySelector('.tc-collection-modal-backdrop'))return;
   if(event.key==='Escape'){event.preventDefault();setDetailOpen(false);}
   if(event.key==='Tab'){
    const dialog=detailCloseRef.current?.closest('[role="dialog"]');
    if(!dialog)return;
    const buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    if(!buttons.length)return;
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
     event.preventDefault();last.focus();
    }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
     event.preventDefault();first.focus();
    }
   }
  };
  document.addEventListener('keydown',onKeyDown);
  return()=>{document.removeEventListener('keydown',onKeyDown);if(trigger?.isConnected)trigger.focus();};
 },[detailOpen]);
 return <Screen title={tab==='appearance'?'외형 도감':'컬렉션'} className="tc-cosmetics-catalog-screen tc-iron-catalog-screen" hideHeader>
  <div className={"tc-cosmetics-catalog tc-iron-catalog"+(tab==="collection"?"":" listing-mode")}>

   {tab==='appearance'&&onSummon?<Segments items={[['summon','외형 소환'],['appearance','외형 목록']] as const} value="appearance" onChange={value=>{if(value==='summon')onSummon();}} label="외형 메뉴"/>:<Segments items={[['collection','컬렉션'],['appearance','외형 목록']] as const} value={tab} onChange={changeTab} label="컬렉션 보기"/>}
   {tab==='collection'?<>
    <div className="tc-collection-grade-tabs" role="group" aria-label="컬렉션 등급">
     {(['ALL',...APPEARANCE_RARITIES] as const).map(r=><button key={r} type="button" className={'tc-feel-press'+(rarity===r?' active':'')} data-rarity={r} aria-pressed={rarity===r} onClick={()=>{setRarity(r);setSelectedSetId('');}}>{r==='ALL'?'전체':COLLECTION_RARITY_NAMES[r]}</button>)}
    </div>
    <div className="tc-collection-tools">
     <label className="tc-collection-search"><Glyph name="search"/><input aria-label="컬렉션 검색" placeholder="컬렉션·외형·장비 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <GameSelect aria-label="컬렉션 진행 필터" value={status} onChange={e=>{setStatus(e.target.value as typeof status);setSelectedSetId('');}}><option value="all">전체</option><option value="near">완성 임박</option><option value="incomplete">미완성</option><option value="complete">완성</option><option value="tracked">추적 중</option></GameSelect>
     <GameSelect aria-label="컬렉션 정렬" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="default">기본 정렬</option><option value="nearest">완성순</option><option value="bonus">보상순</option></GameSelect>
    </div>
    <div className="tc-collection-heading"><span>컬렉션 리스트 <b>{relevant.length}</b></span><span>컬렉션 효과</span><span>필요 외형·장비 (등록 / 전체)</span></div>
    <div className="tc-collection-list" role="list" aria-label="컬렉션 목록">
     {relevant.map(s=>{
      const p=collectionSetProgress(s,owned);
      return <button type="button" role="listitem" key={s.id} className={'tc-collection-row tc-feel-press'+(selected.id===s.id?' selected':'')+(p.complete?' completed':'')} data-set-id={s.id} aria-current={selected.id===s.id?'true':undefined} aria-haspopup="dialog" aria-expanded={detailOpen&&selected.id===s.id} onClick={event=>{detailTriggerRef.current=event.currentTarget;setSelectedSetId(s.id);setDetailOpen(true);}}>
       <span className="tc-collection-row-emblem" aria-hidden="true">✦</span>
       <span className="tc-collection-row-name"><strong>{s.name}</strong><small>{COLLECTION_RARITY_NAMES[s.rarity]} · {p.complete?'완성':'미완성'}</small></span>
       <span className="tc-collection-row-bonus">{collectionSetBonusLabel(s)}<small>효과 예정</small></span>
       <span className="tc-collection-row-tokens">{s.appearanceIds.map(id=><CollectionToken key={id} id={id} owned={ownedSet.has(id)} mini/>)}<span className={'tc-collection-gear-token is-mini '+(registeredIds.has(s.id)?'is-owned':'is-missing')} title={collectionEquipmentLabel(s.equipment)+' · '+(registeredIds.has(s.id)?'등록':'미등록')}><EquipmentArt kind={s.equipment.kind} grade={s.equipment.grade}/></span></span>
       <span className="tc-collection-row-count">{p.count}/{p.total}</span>
       <span className="tc-collection-row-arrow" aria-hidden="true">›</span>
      </button>;
     })}
     {relevant.length===0&&<p className="tc-collection-none">{APPEARANCE_SETS.length===0?'등록된 컬렉션이 없습니다.':'조건에 맞는 컬렉션이 없어. 필터를 바꿔봐.'}</p>}
    </div>
    {selected&&<div className="tc-collection-sheet-backdrop" hidden={!detailOpen} role="presentation" onClick={()=>setDetailOpen(false)}>
     <div className="tc-collection-sheet" role="dialog" aria-modal="true" aria-label="선택한 컬렉션 상세" onClick={event=>event.stopPropagation()}>
      <div className="tc-collection-sheet-handle" aria-hidden="true"
       onTouchStart={event=>{sheetSwipeStart.current=event.touches[0]?.clientY??null;}}
       onTouchEnd={event=>{if(sheetSwipeStart.current!==null&&(event.changedTouches[0]?.clientY??0)-sheetSwipeStart.current>70)setDetailOpen(false);sheetSwipeStart.current=null;}}
       onTouchCancel={()=>{sheetSwipeStart.current=null;}} />
      <header className="tc-collection-sheet-header"><span>컬렉션 상세정보</span>
       <button type="button" ref={detailCloseRef} aria-label="컬렉션 상세 닫기" onClick={()=>setDetailOpen(false)}>×</button>
      </header>
      <section className="tc-collection-detail" aria-label="선택한 컬렉션 상세" data-selected-set-id={selected.id}>
       <div className="tc-collection-sheet-scroll">
        <div className="tc-collection-detail-hero">
      <div className="tc-collection-detail-title"><div><span className="tc-collection-detail-sigil" aria-hidden="true">✥</span><div><small>COLLECTION RECORD · {COLLECTION_RARITY_NAMES[selected.rarity]}</small><h2>{selected.name}</h2></div></div>
       <button type="button" className={favoriteIds.includes(selected.id)?'is-favorite':''} aria-label={favoriteIds.includes(selected.id)?'즐겨찾기 해제':'즐겨찾기 추가'} aria-pressed={favoriteIds.includes(selected.id)} onClick={()=>toggle(selected.id,favoriteIds,setFavoriteIds)}>★</button>
      </div>
      <p className="tc-collection-detail-story">{selected.description}</p>
      <div className="tc-collection-detail-stat"><small>컬렉션 효과 · 완성 시 보상 (예정)</small><strong>{collectionSetBonusLabel(selected)}</strong><span>도감 효과는 미적용 · 외형 자동 반영 / 장비 1개 소모 등록</span></div>
     </div>
     <div className="tc-collection-detail-requirements">
      <div className="tc-collection-detail-label"><strong>필요 외형·장비 <em>({progress.count}/{progress.total})</em></strong><span>{progress.complete?'등록 조건 완료 · 효과 미적용':'남은 조건 '+(progress.total-progress.count)+'개'}</span></div>
      <div className="tc-collection-required">
       {selected.appearanceIds.map(id=>{
        const a=appearanceById(id),has=ownedSet.has(id);
        return <div className="tc-collection-required-item" key={id}><CollectionToken id={id} owned={has} onOpen={setAppearanceDetails}/><span title={a?.name}>{a?.name??id}</span><small className={has?'is-owned':'is-missing'}>{has?'자동 등록':'미보유'}</small></div>;
       })}
       <div className="tc-collection-required-item"><button type="button" className={'tc-collection-gear-token '+(registeredIds.has(selected.id)?'is-owned':'is-missing')} aria-label={collectionEquipmentLabel(selected.equipment)+' · '+(registeredIds.has(selected.id)?'등록 완료':'등록 필요')} onClick={()=>{setRegisterPanel(true);setRegisterItemId('');setRegistrationError('');}}><EquipmentArt kind={selected.equipment.kind} grade={selected.equipment.grade}/></button><span title={collectionEquipmentLabel(selected.equipment)}>{collectionEquipmentLabel(selected.equipment)}</span><small className={registeredIds.has(selected.id)?'is-owned':'is-missing'}>{registeredIds.has(selected.id)?'등록 완료':'미등록'}</small></div>
      </div>
     </div>
       </div>
     <div className="tc-collection-detail-actions">
      <button type="button" className="tc-collection-action tc-feel-press" aria-pressed={trackedIds.includes(selected.id)} onClick={()=>toggle(selected.id,trackedIds,setTrackedIds)}><Glyph name="search"/>{trackedIds.includes(selected.id)?'추적 해제':'추적'}</button>
      <button type="button" className="tc-collection-action tc-feel-press" onClick={()=>setRelatedAppearance(selectedMissing)}><Glyph name="bestiary"/>관련 컬렉션</button>
      <button type="button" className="tc-collection-action primary tc-feel-press" onClick={()=>{setRegisterPanel(true);setRegisterItemId('');setRegistrationError('');}} disabled={registeredIds.has(selected.id)}><Glyph name="armor"/>{registeredIds.has(selected.id)?'장비 등록 완료':'장비 등록'}</button>
     </div>
      </section>
     </div>
    </div>
    }
    <p className="tc-collection-disclaimer">{APPEARANCE_SETS.length}개 외형+장비 조합 · 능력치 보너스는 아직 전투에 적용되지 않습니다.</p>
   </>:<>
    <div className="tc-cosmetics-meta" title="착용한 외형 1개만 강화 효과 적용"><span>적용 중 · <b>{appearanceById(game.cosmetics.selectedAppearanceId)?.name??'기본 모험가'}</b></span><small>보유 {owned.length} / {APPEARANCES.length} · 외형 강화</small></div>
    <div className="tc-cosmetics-filters" role="group" aria-label="외형 등급 선택">
     {(['ALL',...APPEARANCE_RARITIES] as const).map(r=><button key={r} type="button" data-rarity={r} aria-pressed={appearanceRarity===r} onClick={()=>{setAppearanceRarity(r);setPage(0);}}>{r==='ALL'?'전체':r}</button>)}
    </div>
    <div className="tc-appearance-find"><div className="tc-collection-tools single"><label className="tc-collection-search"><Glyph name="search"/><input aria-label="외형 검색" placeholder="외형 이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label></div>
    <div className="tc-appearance-ownership" role="group" aria-label="외형 보유 필터">{([['all','전체'],['owned','보유'],['missing','미보유']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={ownership===id} onClick={()=>{setOwnership(id);setPage(0);}}>{label}</button>)}<span>보유 {owned.length} / {APPEARANCES.length}</span></div>
    </div>
    <div className="tc-cosmetics-items" role="list" aria-label="외형 목록">
     {appearances.slice(safePage*4,safePage*4+4).map(a=>{
      const isOwned=ownedSet.has(a.id),isSelected=game.cosmetics.selectedAppearanceId===a.id,artReady=!!a.imagePath&&a.artStatus!=='pending';
      const shardCount=appearanceShardCount(game.cosmetics,a.id),level=appearanceLevel(game.cosmetics,a.id);
      const previewEffect=appearanceEffectFor(a.id,Math.max(1,level));
      return <article key={a.id} className={'tc-cosmetics-item'+(isOwned?' owned':'')+(isSelected?' equipped':'')} role="listitem" data-rarity={a.rarity??'default'} data-owned={isOwned} data-equipped={isSelected}>
       <button type="button" aria-label={a.name+' 상세 보기'} onClick={()=>{setAppearanceError('');setAppearanceDetails(a.id);}} className={'tc-cosmetics-icon rarity-'+(a.rarity??'default')+(artReady?' has-art':'')}>{artReady?<img src={assetUrl(a.imagePath!)} alt="" loading="lazy"/>:<Glyph name="cosmetics"/>}</button>
       <div className="tc-cosmetics-item-body"><div className="tc-cosmetics-item-title">{a.rarity&&<span className={'tc-cosmetics-grade rarity-'+a.rarity}>{a.rarity}</span>}<button type="button" className="tc-appearance-name" onClick={()=>{setAppearanceError('');setAppearanceDetails(a.id);}}>{a.name}</button></div><div className="tc-appearance-progress" aria-label={a.id==='default'?'기본 외형':a.name+' 강화 및 전용 조각'}><span className="tc-appearance-level">{a.id==='default'?'기본 외형':level===0?'미해금':'강화 Lv.'+level}</span>{a.id!=='default'&&<span className="tc-appearance-shards">보유 조각 {shardCount}개</span>}</div><span>{previewEffect&&a.rarity?'착용 효과 · '+formatAppearanceEquipEffect(previewEffect.id,a.rarity,Math.max(1,level)):'착용 효과 없음'}</span></div>
       <button type="button" className="tc-cosmetics-equip tc-feel-press" disabled={!isOwned||isSelected||!!game.expedition||!artReady} onClick={()=>setGame(s=>selectAppearance(s,a.id))}>{isSelected?'착용 중':!isOwned?'미보유':!artReady?'준비 중':'착용'}</button>
       <button type="button" className="tc-appearance-related" onClick={()=>{setRelatedAppearance(a.id);changeTab('collection');}}>관련 컬렉션 {APPEARANCE_SETS.filter(s=>s.appearanceIds.includes(a.id)).length} ›</button>
      </article>;
     })}
     {viewCount===0&&<p className="tc-cosmetics-empty">표시할 항목이 없어.</p>}
    </div>
    <Pager page={safePage} count={pages} onChange={setPage}/>
   </>}
   {selected&&registerPanel&&<div className="tc-collection-modal-backdrop" role="presentation" onClick={()=>{if(!registering)setRegisterPanel(false);}}>
     <section className="tc-collection-modal" role="dialog" aria-modal="true" aria-label="컬렉션 장비 등록" onClick={e=>e.stopPropagation()}>
      <header><h2>컬렉션 장비 등록</h2><button type="button" disabled={registering} aria-label="닫기" onClick={()=>setRegisterPanel(false)}>×</button></header>
      <div className="tc-collection-modal-content">
       <strong>{selected.name}</strong>
       <p>필요 장비: {collectionEquipmentLabel(selected.equipment)}</p>
       {registeredIds.has(selected.id)?<p>이미 등록한 컬렉션이야. 등록한 아이템은 인벤토리에서 소모되었어.</p>:<>
        <p>등록 시 선택한 장비 1개가 영구 소모되며 되돌릴 수 없어. 외형은 해금 상태만 확인하고 소모하지 않아.</p>
        <div className="tc-collection-register-items" role="group" aria-label="소모할 장비 선택">
         {eligibleItems.length===0?<p>장착하지 않은 해당 등급·종류의 장비가 없어. 인벤토리에서 장착을 해제하거나 장비를 획득해 줘.</p>:eligibleItems.map(item=><button type="button" key={item.id} className={registerItemId===item.id?'active':''} aria-pressed={registerItemId===item.id} disabled={registering} onClick={()=>setRegisterItemId(item.id)}><Glyph name={equipmentDefinition(item.kind).slot==='weapon'?'sword':'armor'}/>{EQUIPMENT_GRADE_NAMES[item.grade]} {equipmentDefinition(item.kind).name} +{item.enhancement}</button>)}
        </div>
        {registrationError&&<p role="alert">{registrationError}</p>}
        <button type="button" className="tc-collection-register-confirm tc-feel-press" disabled={!registerItemId||!registerReady} onClick={()=>void submitRegistration()}>{registering?'서버 등록 처리 중…':registrationLoading?'등록 내역 확인 중…':'장비 1개 소모하여 영구 등록'}</button>
       </>}
      </div>
     </section>
    </div>}
   {(appearanceDetails||relatedAppearance)&&<div className="tc-collection-modal-backdrop" role="presentation" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(null);}}>
    <section ref={detailPopup} tabIndex={-1} className={'tc-collection-modal'+(appearanceDetails?' tc-appearance-detail-popup':'')} role="dialog" aria-modal="true" aria-label={appearanceDetails?'외형 상세 정보':'관련 컬렉션'} onClick={e=>e.stopPropagation()}>
     <header><div><h2>{appearanceDetails?appearanceById(appearanceDetails)?.name??'외형 정보':'관련 컬렉션'}</h2>{appearanceDetails&&<p className="tc-appearance-detail-header-state">{appearanceById(appearanceDetails)?.rarity??'기본'} · {game.cosmetics.selectedAppearanceId===appearanceDetails?'착용 중':ownedSet.has(appearanceDetails)?'보유':'미보유'}</p>}</div><button type="button" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(null);}} aria-label="닫기">×</button></header>
     {appearanceDetails?(()=>{
      const a=appearanceById(appearanceDetails);
      const included=APPEARANCE_SETS.filter(s=>s.appearanceIds.includes(appearanceDetails));
      if(!a)return <p>외형 정보를 찾을 수 없습니다.</p>;
      const isOwned=ownedSet.has(a.id),isSelected=game.cosmetics.selectedAppearanceId===a.id,artReady=!!a.imagePath&&a.artStatus!=='pending';
      const shards=appearanceShardCount(game.cosmetics,a.id),level=appearanceLevel(game.cosmetics,a.id),cost=appearanceShardCost(level);
      const displayEffect=(nextLevel:number)=>{const next=appearanceEffectFor(a.id,nextLevel);return next&&a.rarity?formatAppearanceEquipEffect(next.id,a.rarity,nextLevel):'없음';};
      return <div className="tc-collection-modal-content tc-appearance-detail-content">
       <div className="tc-appearance-detail-art">{artReady?<img src={assetUrl(a.imagePath!)} alt={a.name}/>:<Glyph name="cosmetics"/>}</div>
       <section className="tc-appearance-detail-description"><p>{a.description||'등록된 설명이 없습니다.'}</p><small>획득처 · {a.rarity?'외형 소환 · 전용 조각':'기본 지급'}</small></section>
       <section className="tc-appearance-detail-effect"><div><h4>착용 효과 · {level?'Lv.'+level:'미해금'}</h4><p>{displayEffect(Math.max(1,level))}</p></div>
        {a.id!=='default'&&<><p>전용 조각 {shards} / {cost||'MAX'}</p><progress max={cost||1} value={cost?Math.min(cost,shards):1} style={{width:'100%',accentColor:'#bfa16c'}}/>
         <small>{level>=APPEARANCE_MAX_LEVEL?'최대 강화 완료':level===0?'조각 5개로 영구 해금':'다음 강화: 전용 조각 10개 · '+displayEffect(level+1)}</small>
         <button type="button" className="tc-appearance-advance tc-feel-press" disabled={appearanceBusy||shards<cost||!!game.expedition||!onlineLease||!onServerRecord} onClick={()=>{void submitAppearanceAdvance(a.id);}}>{appearanceBusy?'처리 중':level===0?'외형 해금 (조각 5개)':level>=APPEARANCE_MAX_LEVEL?'최대 강화 완료':'Lv.'+(level+1)+' 강화 (조각 10개)'}</button></>}
         {appearanceError&&<p role="alert">{appearanceError}</p>}
       </section>
       <div className="tc-appearance-detail-actions"><button type="button" disabled={!isOwned||isSelected||!!game.expedition||!artReady} onClick={()=>setGame(s=>selectAppearance(s,a.id))}>{isSelected?'착용 중':!isOwned?'미보유':!artReady?'준비 중':game.expedition?'원정 중':'착용'}</button><button type="button" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(a.id);changeTab('collection');}}>관련 컬렉션 {included.length} ›</button></div>
      </div>;
     })():<div className="tc-collection-modal-content"><p>{appearanceById(relatedAppearance!)?.name} 외형이 필요한 컬렉션</p><div className="tc-collection-related-list">{related.map(set=><button type="button" key={set.id} onClick={()=>{setRarity('ALL');setStatus('all');setQuery('');setSelectedSetId(set.id);setRelatedAppearance(null);}}><strong>{set.name}</strong><span>{collectionSetBonusLabel(set)} · {collectionSetProgress(set,owned,registeredIds).count}/{set.appearanceIds.length}</span></button>)}</div></div>}
    </section>
   </div>}
  </div>
 </Screen>;
}

export function ShopScreen({game}:{game:GameState}){
 const [selectedSku,setSelectedSku]=useState<string|null>(null),selected=selectedSku?getGoldPackageBySku(selectedSku):null;
 return <Screen eyebrow="NOVAR SHOP" title="상점" meta={<span>{game.market.gold.toLocaleString()} Gold</span>}>
  <div className="tc-shop">
   <header className="tc-shop-intro">
    <div><small className="tc-kicker">GOLD REQUISITION</small><b>Gold 보급</b></div>
    <p>게임플레이 상품은 판매하지 않습니다.</p>
   </header>
   <div className="tc-shop-grid" aria-label="Gold 충전 상품">
    {GOLD_SHOP_PACKAGES.map((item,index)=><button type="button" className="tc-shop-card tc-feel-press" data-game-feel="press" key={item.sku} onClick={()=>setSelectedSku(item.sku)}>
     <span className="tc-shop-mark" aria-hidden="true"><i/><i/><i data-tier={Math.min(3,Math.floor(index/2)+1)}/></span>
     <span className="tc-shop-amount"><b>{item.gold.toLocaleString()}</b><small>GOLD</small></span>
     <strong>{formatKrw(item.priceKrw)}</strong>
    </button>)}
   </div>
   <footer className="tc-shop-foot"><span>유료 Gold 충전 전용</span><small>Google Play 결제 연동 후 구매가 활성화됩니다.</small></footer>
   {selected&&<div className="tc-modalback tc-shop-confirm" role="presentation" onClick={()=>setSelectedSku(null)}>
    <section className="tc-modal" role="dialog" aria-modal="true" aria-label="Gold 구매 확인" onClick={e=>e.stopPropagation()}>
     <div className="tc-shop-confirm-head"><span className="tc-shop-mark" aria-hidden="true"><i/><i/><i/></span><div><small>GOLD REQUISITION</small><h2>{selected.gold.toLocaleString()} Gold</h2></div></div>
     <div className="tc-shop-confirm-price"><span>결제 금액</span><b>{formatKrw(selected.priceKrw)}</b></div>
     <p>앱에서 Google Play 결제가 연결되면 결제 승인 후 서버 검증을 거쳐 Gold가 지급됩니다. 현재 웹 빌드에서는 Gold가 지급되지 않습니다.</p>
     <div className="tc-modal-actions">
      <button className="tc-action secondary" onClick={()=>setSelectedSku(null)}>취소</button>
      <button className="tc-action" disabled>결제 준비중</button>
     </div>
    </section>
   </div>}
  </div>
 </Screen>;
}

export function ExpeditionCompleteScreen({game,onInventory,onTowers}:{game:GameState;onInventory:()=>void;onTowers:()=>void}){
 const r=game.lastExpedition;if(!r)return <Screen eyebrow="EXPEDITION REPORT" title="원정 기록"><div className="tc-panel">{game.notice}</div></Screen>;
 const totals=lootTotals(r.loot),dead=r.outcome==='dead';
 return <Screen eyebrow="EXPEDITION REPORT" title={dead?'원정 실패':'안전 귀환'} meta={<span>{r.kills}체 처치</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'1fr auto',gap:'6px'}}><section className={'tc-panel strong '+(dead?'danger':'')} style={{display:'grid',alignContent:'center',gap:'8px'}}><small className="tc-kicker">{dead?'LOST IN EXPEDITION':'SETTLEMENT COMPLETE'}</small><h2 style={{font:'700 20px Georgia',margin:0}}>{dead?'이번 원정 전리품을 잃었습니다.':'획득물이 영구 보관함에 저장되었습니다.'}</h2><div className="tc-stat-grid"><Stat label="Silver" value={(dead?0:r.loot.silver).toLocaleString()}/><Stat label="재료" value={dead?0:totals.materials}/><Stat label="입장권" value={dead?0:totals.tickets}/><Stat label="처치" value={r.kills}/></div><p style={{fontSize:'8px',color:'var(--muted)',margin:0}}>{dead?'기존 Silver·보관함·장비·스킬은 유지됩니다.':'입장에 사용한 입장권은 반환되지 않습니다.'}</p></section><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}><button className="tc-action secondary" onClick={onInventory}>보관함</button><button className="tc-action" onClick={onTowers}>다음 원정</button></div></div>
 </Screen>;
}
