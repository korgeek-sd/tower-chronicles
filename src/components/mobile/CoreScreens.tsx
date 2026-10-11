import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,Tower,Potion} from '../../game/types';
import {CONFIG,POTIONS,SKILLS,TOWERS,WEAPONS,generalPotionIds,potionIds,towerIds,PLAYABLE_TOWERS} from '../../game/data/config';
import {equippedItem,itemName,stats,weaponOf} from '../../game/engine/state';
import {monsterFor} from '../../game/engine/drops';
import {APPEARANCES,APPEARANCE_RARITIES,TITLES,appearanceById,appearanceBonusLabel,titleById,type AppearanceRarity} from '../../game/data/cosmetics';
import {APPEARANCE_SETS,collectionSetProgress,collectionSetBonusLabel,type AppearanceSet} from '../../game/data/appearanceSets';
import './cosmetics-catalog.css';
import {selectAppearance,selectTitle} from '../../game/engine/cosmetics';
import {applyPreset,getPresetSlotLimit,renamePreset,savePreset} from '../../game/engine/presets';
import {jobById} from '../../game/jobs/catalog';
import {assetUrl} from '../../game/data/graphics';
import {lootTotals} from '../../game/engine/loot';
import {Glyph,Pager,Screen,Segments,Stat} from '../../ui/mobile';
import {GOLD_SHOP_PACKAGES,formatKrw,getGoldPackageBySku} from '../../shop/catalog';
import {getHuntingState} from '../../online/hunting';
import type {GameplayLease} from '../../online/gameSession';
import {huntingLevel,type HuntingState} from '../../game/hunting/model';

export type AppPage='craft'|'world'|'home'|'stats'|'hunt'|'towers'|'floor'|'battle'|'inventory'|'enhancement'|'skills'|'jobs'|'cosmetics'|'market'|'gold-exchange'|'association'|'seal'|'occupation'|'settings'|'bestiary'|'shop';

export function HomeScreen({game,onMove,onOpenJobs,nickname,onOpenMail=()=>{},mailUnread=0,lease=null,userId=null}:{onOpenMail?:()=>void;mailUnread?:number;nickname?:string;game:GameState;onMove:(p:AppPage)=>void;onOpenJobs:(tab:'register'|'list')=>void;lease?:GameplayLease|null;userId?:string|null}){
 const [showAllFacilities,setShowAllFacilities]=useState(false);
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
 const portrait=job?.visualAssetKey?assetUrl(job.visualAssetKey):null;
 const mainFacilities=[
  {id:'craft',glyph:'craft',name:'제작',action:()=>onMove('craft')},
  {id:'skills',glyph:'skills',name:'스킬트리',action:()=>onMove('skills')},
  {id:'stats',glyph:'skill',name:'스탯 분배',action:()=>onMove('stats')},
  {id:'gold-exchange',glyph:'market',name:'골드 거래소',action:()=>onMove('gold-exchange')},
  {id:'occupation',glyph:'towers',name:'점령전',action:()=>onMove('occupation')},
  {id:'mail',glyph:'mail',name:'우편함',action:onOpenMail}
 ];
 const extraFacilities=[
  {id:'bestiary',glyph:'bestiary',name:'생물록',action:()=>onMove('bestiary')},
  {id:'cosmetics',glyph:'cosmetics',name:'외형 도감',action:()=>onMove('cosmetics')},
  {id:'jobs-list',glyph:'jobs',name:'직능목록',action:()=>onOpenJobs('list')},
  {id:'seal',glyph:'association',name:'협회 인장',action:()=>onMove('seal')},
  {id:'association',glyph:'association',name:'원정단',action:()=>onMove('association')},
  {id:'inventory',glyph:'equipment',name:'장비 확인',action:()=>onMove('inventory')},
  {id:'settings',glyph:'settings',name:'설정',action:()=>onMove('settings')}
 ];
 return <Screen title="노바르 거점" className="tc-camp-screen tc-camp-v2-screen" meta={<span className="tc-camp-status">{game.expedition?'원정 중':'출정 대기'}</span>}>
  <div className="tc-camp-v2" aria-label="노바르 거점 로비">
   <section className="tc-camp-v2-dossier" aria-label="캐릭터 정보">
    <div className="tc-camp-v2-portrait">{portrait?<img src={portrait} alt="현재 직업 캐릭터"/>:<Glyph name={weaponId}/>}</div>
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
   <nav className="tc-camp-v2-primary" aria-label="주요 행동">
    <button type="button" className="tc-camp-v2-hunt tc-feel-press" data-facility="hunt" data-game-feel="press" onClick={()=>onMove(game.expedition?'battle':'hunt')}><Glyph name="sword"/><span><b>{game.expedition?'원정 복귀':'사냥하기'}</b><small>{game.expedition?'진행 중인 원정으로':'사냥터에서 전투 시작'}</small></span><i>›</i></button>
    <button type="button" className="tc-camp-v2-world tc-feel-press" data-game-feel="press" onClick={()=>onMove('world')}><Glyph name="towers"/><span><b>마을 이동</b><small>10개 마을 · 중앙 도시</small></span><i>›</i></button>
   </nav>
   <section className="tc-camp-v2-facilities" aria-label="거점 시설">
    <div className="tc-camp-v2-facility-heading"><b>거점 시설</b><button type="button" aria-expanded={showAllFacilities} aria-controls="tc-camp-extra-facilities" onClick={()=>setShowAllFacilities(v=>!v)}>{showAllFacilities?'접기':'전체 시설'} <span aria-hidden="true">›</span></button></div>
    <nav className="tc-camp-v2-quick" aria-label="주요 시설">{mainFacilities.map(item=><button type="button" key={item.id} className="tc-feel-press" data-game-feel="press" data-facility={item.id} onClick={item.action}><Glyph name={item.glyph}/><span>{item.name}</span>{item.id==='mail'&&mailUnread>0&&<small aria-label={'미확인 우편 '+mailUnread+'개'}>{mailUnread}</small>}</button>)}</nav>
    {showAllFacilities&&<nav id="tc-camp-extra-facilities" className="tc-camp-v2-extra" aria-label="추가 시설">{extraFacilities.map(item=><button type="button" key={item.id} data-facility={item.id} onClick={item.action}><Glyph name={item.glyph}/>{item.name}</button>)}</nav>}
    {!showAllFacilities&&<span className="tc-camp-v2-extra-access" data-facility="bestiary" aria-hidden="true"/>}
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
   <div className="tc-floor-content"><Segments items={[['bag','원정 가방'],['preset','프리셋']] as const} value={tab} onChange={setTab} label="원정 준비"/><div className="tc-floor-tabbody">{tab==='bag'?<div className="tc-potion-list">{potionIds.map(p=><label className="tc-potion-row" key={p}><span><b>{POTIONS[p].name}</b><small>T{POTIONS[p].tier} · 창고 {game.potions[p]}개{p==='revival'?' · 최대 '+CONFIG.revivalPotionLimit:''}</small></span><input type="number" min="0" disabled={!!exp||game.potions[p]===0} max={p==='revival'?Math.min(game.potions[p],CONFIG.revivalPotionLimit):game.potions[p]} value={game.loadout[p]} onChange={e=>updateBag(p,+e.target.value)}/></label>)}</div>:<div className="tc-preset"><select value={presetSlot} onChange={e=>setPresetSlot(+e.target.value)}>{game.expeditionPresets.map((x,i)=><option value={i+1} key={i}>슬롯 {i+1} · {x?.name||'비어 있음'}</option>)}</select><div className="tc-preset-info"><strong>{preset?.name||'비어 있는 프리셋'}</strong><small>{preset?'장비·스킬·포션 구성을 불러오거나 덮어쓸 수 있습니다.':'현재 구성을 저장할 수 있습니다.'}</small></div><div className="tc-preset-actions"><button disabled={!preset||!!exp} onClick={()=>setGame(s=>applyPreset(s,presetSlot,presetLimit))}>불러오기</button><button disabled={!!exp} onClick={()=>setGame(s=>savePreset(s,presetSlot,preset?.name,presetLimit))}>저장</button><button disabled={!open||!preset||!!exp} onClick={()=>{const name=window.prompt('프리셋 이름',preset?.name);if(name!==null)setGame(s=>renamePreset(s,presetSlot,name,presetLimit));}}>이름</button></div></div>}</div></div>
   <div className="tc-floor-footer"><div className="tc-floor-risk">일반 포션 {generalCount}/{CONFIG.generalPotionLimit}<br/>사망 시 이번 원정 획득물과 남은 원정 포션 소멸</div><button className="tc-floor-enter" disabled={!valid} onClick={onEnter}>{floor}층 입장<small>{TOWERS[tower].material} 수집 · 입장권 1장 사용</small></button></div>
  </div>
 </Screen>;
}

export function SkillsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [page,setPage]=useState(0),PAGE=3,pages=Math.max(1,Math.ceil(SKILLS.length/PAGE)),safe=Math.min(page,pages-1),shown=SKILLS.slice(safe*PAGE,safe*PAGE+PAGE),weapon=weaponOf(game);
 return <Screen eyebrow="COMBAT KIT" title="스킬 구성" meta={<span>{WEAPONS[weapon].name}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'auto 1fr auto',gap:'6px'}}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px'}}>{game.skills.map((id,i)=><label key={i} className="tc-panel" style={{padding:'5px'}}><small style={{fontSize:'7px',color:'var(--muted)'}}>{i+1}순위</small><select style={{width:'100%',height:'30px',minHeight:0,fontSize:'8px',marginTop:'3px'}} disabled={!!game.expedition} value={id||''} onChange={e=>setGame(s=>{const skills=[...s.skills] as GameState['skills'];skills[i]=e.target.value||null;return {...s,skills};})}><option value="">비움</option>{SKILLS.filter(sk=>game.learned.includes(sk.id)).map(sk=><option key={sk.id} disabled={game.skills.includes(sk.id)&&id!==sk.id} value={sk.id}>{sk.name}</option>)}</select></label>)}</div>
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
 const props={className:'tc-collection-token '+(owned?'is-owned ':'is-missing ')+'rarity-'+(a?.rarity??'C')+(mini?' is-mini':''),title:(a?.name??id)+' · '+(owned?'보유':'미보유'), 'data-appearance-id':id};
 return onOpen?<button type="button" {...props} aria-label={(a?.name??id)+' · '+(owned?'보유':'미보유')+' 상세 정보'} onClick={e=>{e.stopPropagation();onOpen(id);}}>{content}</button>:<span {...props}>{content}</span>;
}
export function CosmeticsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<'collection'|'appearance'|'title'>('collection');
 const [rarity,setRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState<'all'|'near'|'complete'|'incomplete'|'tracked'>('all');
 const [sort,setSort]=useState<'default'|'nearest'|'bonus'>('default');
 const [selectedSetId,setSelectedSetId]=useState<string>(APPEARANCE_SETS[0].id);
 const [trackedIds,setTrackedIds]=useState<string[]>([]);
 const [favoriteIds,setFavoriteIds]=useState<string[]>([]);
 const [appearanceDetails,setAppearanceDetails]=useState<string|null>(null);
 const [relatedAppearance,setRelatedAppearance]=useState<string|null>(null);
 const [page,setPage]=useState(0);
 const [appearanceRarity,setAppearanceRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const owned=game.cosmetics.unlockedAppearanceIds;
 const ownedSet=new Set(owned);
 const collectible=APPEARANCES.filter(a=>a.rarity);
 const ownedCount=collectible.filter(a=>ownedSet.has(a.id)).length;
 const completeCount=APPEARANCE_SETS.filter(s=>collectionSetProgress(s,owned).complete).length;
 const relevant=APPEARANCE_SETS.filter(s=>{
  const p=collectionSetProgress(s,owned);
  if(rarity!=='ALL'&&s.rarity!==rarity)return false;
  if(status==='near'&&(p.complete||p.total-p.count!==1))return false;
  if(status==='complete'&&!p.complete)return false;
  if(status==='incomplete'&&p.complete)return false;
  if(status==='tracked'&&!trackedIds.includes(s.id))return false;
  const key=query.trim().toLocaleLowerCase();
  return !key||s.name.toLocaleLowerCase().includes(key)||s.description.toLocaleLowerCase().includes(key)||s.appearanceIds.some(id=>appearanceById(id)?.name.toLocaleLowerCase().includes(key));
 }).sort((a,b)=>{
  const ap=collectionSetProgress(a,owned),bp=collectionSetProgress(b,owned);
  if(sort==='nearest')return (ap.total-ap.count)-(bp.total-bp.count)||a.id.localeCompare(b.id);
  if(sort==='bonus')return b.reward.value-a.reward.value||a.id.localeCompare(b.id);
  return APPEARANCE_SETS.indexOf(a)-APPEARANCE_SETS.indexOf(b);
 });
 const selected:AppearanceSet=relevant.find(s=>s.id===selectedSetId)??relevant[0]??APPEARANCE_SETS[0];
 const progress=collectionSetProgress(selected,owned);
 const appearances=APPEARANCES.filter(a=>appearanceRarity==='ALL'||a.rarity===appearanceRarity).filter(a=>!query.trim()||a.name.includes(query.trim()));
 const titles=TITLES.filter(t=>game.cosmetics.unlockedTitleIds.includes(t.id));
 const viewCount=tab==='appearance'?appearances.length:titles.length;
 const pages=Math.max(1,Math.ceil(viewCount/4)),safePage=Math.min(page,pages-1);
 const changeTab=(next:'collection'|'appearance'|'title')=>{setTab(next);setPage(0);setQuery('');};
 const toggle=(id:string,values:string[],setter:React.Dispatch<React.SetStateAction<string[]>>)=>setter(values.includes(id)?values.filter(x=>x!==id):[...values,id]);
 const selectedMissing=selected.appearanceIds.find(id=>!ownedSet.has(id))??selected.appearanceIds[0];
 const related=APPEARANCE_SETS.filter(s=>relatedAppearance&&s.appearanceIds.includes(relatedAppearance));
 useEffect(()=>{
  if(!appearanceDetails&&!relatedAppearance)return;
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAppearanceDetails(null);setRelatedAppearance(null);}};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[appearanceDetails,relatedAppearance]);
 return <Screen eyebrow="APPEARANCE COLLECTION" title="외형 컬렉션" className="tc-cosmetics-catalog-screen" meta={<span>{ownedCount} / {collectible.length} 수집</span>}>
  <div className="tc-cosmetics-catalog">
   <div className="tc-collection-top" style={{backgroundImage:"linear-gradient(90deg,#17130edc,#14100cb5),url("+assetUrl('assets/backgrounds/hunting/world-map.webp')+")"}}>
    <span className="tc-collection-top-mark"><Glyph name="bestiary"/></span>
    <span>탑의 기록 <b>외형 컬렉션</b><small>COLLECTION ARCHIVE · 완성 {completeCount} / {APPEARANCE_SETS.length}</small></span>
   </div>
   <Segments items={[['collection','도감 세트'],['appearance','외형 목록'],['title','칭호']] as const} value={tab} onChange={changeTab} label="외형 컬렉션 보기"/>
   {tab==='collection'?<>
    <div className="tc-collection-grade-tabs" role="group" aria-label="컬렉션 등급">
     {(['ALL',...APPEARANCE_RARITIES] as const).map(r=><button key={r} type="button" className={'tc-feel-press'+(rarity===r?' active':'')} data-rarity={r} aria-pressed={rarity===r} onClick={()=>{setRarity(r);setSelectedSetId('');}}>{r==='ALL'?'전체':COLLECTION_RARITY_NAMES[r]}</button>)}
    </div>
    <div className="tc-collection-tools">
     <label className="tc-collection-search"><Glyph name="search"/><input aria-label="컬렉션 검색" placeholder="컬렉션 이름을 입력하세요." value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <select aria-label="컬렉션 진행 필터" value={status} onChange={e=>{setStatus(e.target.value as typeof status);setSelectedSetId('');}}><option value="all">전체</option><option value="near">완성 임박</option><option value="incomplete">미완성</option><option value="complete">완성</option><option value="tracked">추적 중</option></select>
     <select aria-label="컬렉션 정렬" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="default">기본 정렬</option><option value="nearest">완성순</option><option value="bonus">보상순</option></select>
    </div>
    <div className="tc-collection-heading"><span>컬렉션 리스트 <b>{relevant.length}</b></span><span>컬렉션 효과</span><span>필요 외형 (보유 / 전체)</span></div>
    <div className="tc-collection-list" role="list" aria-label="외형 컬렉션 목록">
     {relevant.map(s=>{
      const p=collectionSetProgress(s,owned);
      return <button type="button" role="listitem" key={s.id} className={'tc-collection-row tc-feel-press'+(selected.id===s.id?' selected':'')+(p.complete?' completed':'')} data-set-id={s.id} aria-current={selected.id===s.id?'true':undefined} onClick={()=>setSelectedSetId(s.id)}>
       <span className="tc-collection-row-emblem" aria-hidden="true">✦</span>
       <span className="tc-collection-row-name"><strong>{s.name}</strong><small>{COLLECTION_RARITY_NAMES[s.rarity]} · {p.complete?'완성':'미완성'}</small></span>
       <span className="tc-collection-row-bonus">{collectionSetBonusLabel(s)}<small>효과 예정</small></span>
       <span className="tc-collection-row-tokens">{s.appearanceIds.map(id=><CollectionToken key={id} id={id} owned={ownedSet.has(id)} mini/>)}</span>
       <span className="tc-collection-row-count">{p.count}/{p.total}</span>
       <span className="tc-collection-row-arrow" aria-hidden="true">›</span>
      </button>;
     })}
     {relevant.length===0&&<p className="tc-collection-none">조건에 맞는 컬렉션이 없어. 필터를 바꿔봐.</p>}
    </div>
    <section className="tc-collection-detail" aria-label="선택한 컬렉션 상세" data-selected-set-id={selected.id}>
     <div className="tc-collection-detail-hero" style={{backgroundImage:"linear-gradient(90deg,#17130fe8 0%,#17130f99 56%,#11141993 100%),url("+assetUrl('assets/backgrounds/hunting/world-map.webp')+")"}}>
      <div className="tc-collection-detail-title"><div><span className="tc-collection-detail-sigil" aria-hidden="true">✥</span><div><small>COLLECTION RECORD · {COLLECTION_RARITY_NAMES[selected.rarity]}</small><h2>{selected.name}</h2></div></div>
       <button type="button" className={favoriteIds.includes(selected.id)?'is-favorite':''} aria-label={favoriteIds.includes(selected.id)?'즐겨찾기 해제':'즐겨찾기 추가'} aria-pressed={favoriteIds.includes(selected.id)} onClick={()=>toggle(selected.id,favoriteIds,setFavoriteIds)}>★</button>
      </div>
      <p className="tc-collection-detail-story">{selected.description}</p>
      <div className="tc-collection-detail-stat"><small>컬렉션 효과 · 완성 시 보상 (예정)</small><strong>{collectionSetBonusLabel(selected)}</strong><span>도감 효과는 미적용 · 착용과 관계없이 수집 여부로 계산</span></div>
     </div>
     <div className="tc-collection-detail-requirements">
      <div className="tc-collection-detail-label"><strong>필요 외형 <em>({progress.count}/{progress.total})</em></strong><span>{progress.complete?'수집 조건 완료 · 효과 미적용':'부족한 외형 '+(progress.total-progress.count)+'종'}</span></div>
      <div className="tc-collection-required">
       {selected.appearanceIds.map(id=>{
        const a=appearanceById(id),has=ownedSet.has(id);
        return <div className="tc-collection-required-item" key={id}><CollectionToken id={id} owned={has} onOpen={setAppearanceDetails}/><span title={a?.name}>{a?.name??id}</span><small className={has?'is-owned':'is-missing'}>{has?'보유':'미보유'}</small></div>;
       })}
      </div>
     </div>
     <div className="tc-collection-detail-actions">
      <button type="button" className="tc-collection-action tc-feel-press" aria-pressed={trackedIds.includes(selected.id)} onClick={()=>toggle(selected.id,trackedIds,setTrackedIds)}><Glyph name="search"/>{trackedIds.includes(selected.id)?'추적 해제':'추적'}</button>
      <button type="button" className="tc-collection-action tc-feel-press" onClick={()=>setRelatedAppearance(selectedMissing)}><Glyph name="bestiary"/>관련 컬렉션</button>
      <button type="button" className="tc-collection-action primary tc-feel-press" onClick={()=>setAppearanceDetails(selectedMissing)}><Glyph name="cosmetics"/>외형 확인</button>
     </div>
    </section>
    <p className="tc-collection-disclaimer">65개 조합 · 능력치 수치는 설계값이며 아직 전투에 적용되지 않습니다.</p>
   </>:<>
    <div className="tc-cosmetics-meta"><span>적용 중 · <b>{appearanceById(game.cosmetics.selectedAppearanceId)?.name??'기본 모험가'}</b></span><small>외형 능력치는 향후 업데이트 예정</small></div>
    <div className="tc-cosmetics-filters" role="group" aria-label="외형 등급 선택">
     {(['ALL',...APPEARANCE_RARITIES] as const).map(r=><button key={r} type="button" data-rarity={r} aria-pressed={appearanceRarity===r} onClick={()=>{setAppearanceRarity(r);setPage(0);}}>{r==='ALL'?'전체':r}</button>)}
    </div>
    <div className="tc-collection-tools single"><label className="tc-collection-search"><Glyph name="search"/><input aria-label="외형 검색" placeholder="외형 이름 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label></div>
    <div className="tc-cosmetics-items" role="list" aria-label={tab==='appearance'?'외형 목록':'칭호 목록'}>
     {tab==='appearance'?appearances.slice(safePage*4,safePage*4+4).map(a=>{
      const isOwned=ownedSet.has(a.id),isSelected=game.cosmetics.selectedAppearanceId===a.id,artReady=!!a.imagePath&&a.artStatus!=='pending';
      return <article key={a.id} className={'tc-cosmetics-item'+(isOwned?' owned':'')+(isSelected?' equipped':'')} role="listitem">
       <div className={'tc-cosmetics-icon rarity-'+(a.rarity??'default')}>{artReady?<img src={assetUrl(a.imagePath!)} alt="" loading="lazy"/>:<Glyph name="cosmetics"/>}</div>
       <div className="tc-cosmetics-item-body"><div className="tc-cosmetics-item-title">{a.rarity&&<span className={'tc-cosmetics-grade rarity-'+a.rarity}>{a.rarity}</span>}<b>{a.name}</b></div><small>{isSelected?'착용 중':isOwned?'보유':'미보유'} · {a.sourceLabel}</small><span>{a.proposedBonus?appearanceBonusLabel(a.proposedBonus)+' (예정)':a.description}</span></div>
       <button type="button" className="tc-cosmetics-equip tc-feel-press" disabled={!isOwned||isSelected||!!game.expedition||!artReady} onClick={()=>setGame(s=>selectAppearance(s,a.id))}>{isSelected?'적용 중':!isOwned?'미보유':!artReady?'준비 중':'적용'}</button>
      </article>;
     }):titles.slice(safePage*4,safePage*4+4).map(t=><article className="tc-cosmetics-item" role="listitem" key={t.id}><div className="tc-cosmetics-icon"><Glyph name="bestiary"/></div><div className="tc-cosmetics-item-body"><div className="tc-cosmetics-item-title"><b>「{t.name}」</b></div><small>{t.description}</small></div><button type="button" className="tc-cosmetics-equip" disabled={!!game.expedition||game.cosmetics.selectedTitleId===t.id} onClick={()=>setGame(s=>selectTitle(s,t.id))}>{game.cosmetics.selectedTitleId===t.id?'적용 중':'적용'}</button></article>)}
     {viewCount===0&&<p className="tc-cosmetics-empty">표시할 항목이 없어.</p>}
    </div>
    <Pager page={safePage} count={pages} onChange={setPage}/>
   </>}
   {(appearanceDetails||relatedAppearance)&&<div className="tc-collection-modal-backdrop" role="presentation" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(null);}}>
    <section className="tc-collection-modal" role="dialog" aria-modal="true" aria-label={appearanceDetails?'외형 상세 정보':'관련 컬렉션'} onClick={e=>e.stopPropagation()}>
     <header><h2>{appearanceDetails?'외형 상세':'관련 컬렉션'}</h2><button type="button" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(null);}} aria-label="닫기">×</button></header>
     {appearanceDetails?(()=>{
      const a=appearanceById(appearanceDetails);
      const included=APPEARANCE_SETS.filter(s=>s.appearanceIds.includes(appearanceDetails));
      return <div className="tc-collection-modal-content"><strong>{a?.name??'외형 정보 없음'}</strong><p>{a?.description??''}</p><p>{a?.rarity?COLLECTION_RARITY_NAMES[a.rarity]+' · ':''}{ownedSet.has(appearanceDetails)?'보유 중':'미보유'} · 이미지 {a?.artStatus==='ready'?'등록됨':'제작 예정'}</p><p>관련 컬렉션 {included.length}개 · 획득은 외형 뽑기 구현 후 가능합니다.</p><button type="button" onClick={()=>{setAppearanceDetails(null);setRelatedAppearance(appearanceDetails);}}>이 외형이 필요한 도감 보기 ›</button></div>;
     })():<div className="tc-collection-modal-content"><p>{appearanceById(relatedAppearance!)?.name} 외형이 필요한 컬렉션</p><div className="tc-collection-related-list">{related.map(set=><button type="button" key={set.id} onClick={()=>{setRarity('ALL');setStatus('all');setQuery('');setSelectedSetId(set.id);setRelatedAppearance(null);}}><strong>{set.name}</strong><span>{collectionSetBonusLabel(set)} · {collectionSetProgress(set,owned).count}/{set.appearanceIds.length}</span></button>)}</div></div>}
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
