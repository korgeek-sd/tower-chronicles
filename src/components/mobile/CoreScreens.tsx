import React,{useEffect,useMemo,useState} from 'react';
import type {GameState,Tower,Potion} from '../../game/types';
import {CONFIG,POTIONS,SKILLS,TOWERS,WEAPONS,generalPotionIds,potionIds,towerIds,PLAYABLE_TOWERS} from '../../game/data/config';
import {equippedItem,itemName,stats,weaponOf} from '../../game/engine/state';
import {monsterFor} from '../../game/engine/drops';
import {APPEARANCES,APPEARANCE_COLLECTIONS,APPEARANCE_RARITIES,TITLES,appearanceById,appearanceBonusLabel,appearanceCollectionProgress,appearanceCollectionById,titleById,type AppearanceRarity} from '../../game/data/cosmetics';
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

export function CosmeticsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<'appearance'|'collection'|'title'>('appearance');
 const [rarity,setRarity]=useState<'ALL'|AppearanceRarity>('ALL');
 const [page,setPage]=useState(0);
 const PAGE=4;
 const owned=game.cosmetics.unlockedAppearanceIds;
 const collectible=APPEARANCES.filter(a=>a.rarity);
 const ownedCount=collectible.filter(a=>owned.includes(a.id)).length;
 const appearances=APPEARANCES.filter(a=>rarity==='ALL'||a.rarity===rarity);
 const titles=TITLES.filter(t=>game.cosmetics.unlockedTitleIds.includes(t.id));
 const count=tab==='appearance'?appearances.length:tab==='collection'?APPEARANCE_COLLECTIONS.length:titles.length;
 const pages=Math.max(1,Math.ceil(count/PAGE)),safe=Math.min(page,pages-1),offset=safe*PAGE;
 const shownAppearances=appearances.slice(offset,offset+PAGE);
 const shownCollections=APPEARANCE_COLLECTIONS.slice(offset,offset+PAGE);
 const shownTitles=titles.slice(offset,offset+PAGE);
 const chooseTab=(next:'appearance'|'collection'|'title')=>{setTab(next);setPage(0);};
 return <Screen eyebrow="APPEARANCE ARCHIVE" title="외형 도감" className="tc-cosmetics-catalog-screen" meta={<span>{ownedCount} / {collectible.length} 수집</span>}>
  <div className="tc-cosmetics-catalog">
   <Segments items={[['appearance','외형 목록'],['collection','도감 세트'],['title','칭호']] as const} value={tab} onChange={chooseTab} label="외형 메뉴"/>
   <div className="tc-cosmetics-meta">
    <span>적용 중 · <b>{appearanceById(game.cosmetics.selectedAppearanceId)?.name??'기본 모험가'}</b></span>
    <small>능력치·도감 효과는 향후 업데이트 예정</small>
   </div>
   {tab==='appearance'?<div className="tc-cosmetics-filters" role="group" aria-label="외형 등급 선택">
    {(['ALL',...APPEARANCE_RARITIES] as const).map(r=><button key={r} type="button" data-rarity={r} aria-pressed={rarity===r} onClick={()=>{setRarity(r);setPage(0);}}>{r==='ALL'?'전체':r}</button>)}
   </div>:<div className="tc-cosmetics-category-info">{tab==='collection'?'테마별 5종을 모아 도감을 완성하세요.':'획득한 칭호를 변경할 수 있습니다.'}</div>}
   <div className="tc-cosmetics-items" role="list" aria-label={tab==='appearance'?'외형 카탈로그':tab==='collection'?'외형 도감 세트':'칭호 목록'}>
    {tab==='appearance'?shownAppearances.map(a=>{
     const isOwned=owned.includes(a.id);
     const isSelected=game.cosmetics.selectedAppearanceId===a.id;
     const artReady=!!a.imagePath&&a.artStatus!=='pending';
     const theme=a.collectionId?appearanceCollectionById(a.collectionId):null;
     return <article className={'tc-cosmetics-item'+(isOwned?' owned':'')+(isSelected?' equipped':'')} role="listitem" key={a.id} data-appearance-id={a.id}>
      <div className={'tc-cosmetics-icon rarity-'+(a.rarity??'default')}>{artReady?<img src={assetUrl(a.imagePath!)} alt="" loading="lazy"/>:<Glyph name="cosmetics"/>}</div>
      <div className="tc-cosmetics-item-body">
       <div className="tc-cosmetics-item-title">{a.rarity&&<span className={'tc-cosmetics-grade rarity-'+a.rarity}>{a.rarity}</span>}<b>{a.name}</b></div>
       <small>{theme?.name??'기본 외형'} · {isSelected?'착용 중':isOwned?'보유':'미보유'}</small>
       <span>{a.proposedBonus?appearanceBonusLabel(a.proposedBonus)+' (예정)':a.description}</span>
      </div>
      <button type="button" className="tc-cosmetics-equip tc-feel-press" disabled={!isOwned||isSelected||!!game.expedition||!artReady} onClick={()=>setGame(s=>selectAppearance(s,a.id))}>{isSelected?'적용 중':!isOwned?'미보유':!artReady?'준비 중':'적용'}</button>
     </article>;
    }):tab==='collection'?shownCollections.map(collection=>{
     const progress=appearanceCollectionProgress(collection,owned);
     return <article className="tc-cosmetics-collection" role="listitem" key={collection.id} data-collection-id={collection.id}>
      <div className="tc-cosmetics-collection-head"><b>{collection.name}</b><span>{progress.count} / {progress.total}</span></div>
      <small>{collection.description}</small>
      <div className="tc-cosmetics-collection-slots" aria-label={collection.name+' 수집 현황'}>{collection.appearanceIds.map((id,i)=><span key={id} className={owned.includes(id)?'collected':''} title={appearanceById(id)?.name}><b>{APPEARANCE_RARITIES[i]}</b></span>)}</div>
      <strong>{progress.complete?'완성':'완성 보너스 (예정)'} · {appearanceBonusLabel(collection.proposedCompletionBonus)}</strong>
     </article>;
    }):shownTitles.map(t=><article className="tc-cosmetics-item" role="listitem" key={t.id}><div className="tc-cosmetics-icon"><Glyph name="registration"/></div><div className="tc-cosmetics-item-body"><div className="tc-cosmetics-item-title"><b>「{t.name}」</b></div><small>{t.description}</small></div><button type="button" className="tc-cosmetics-equip" disabled={!!game.expedition||game.cosmetics.selectedTitleId===t.id} onClick={()=>setGame(s=>selectTitle(s,t.id))}>{game.cosmetics.selectedTitleId===t.id?'적용 중':'적용'}</button></article>)}
    {count===0&&<p className="tc-cosmetics-empty">획득한 칭호가 없습니다.</p>}
   </div>
   <Pager page={safe} count={pages} onChange={setPage}/>
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
