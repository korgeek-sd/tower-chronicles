import React,{useMemo,useState} from 'react';
import type {Field,GameState,Slot,Tower,Potion} from '../../game/types';
import {CONFIG,FIELDS,GEAR_MASTERY_NAMES,PASSIVES,POTIONS,SLOTS,SKILLS,TOWERS,WEAPONS,generalPotionIds,potionIds,towerIds,PLAYABLE_TOWERS} from '../../game/data/config';
import {equip,equippedItem,itemName,itemSlot,masteryKeyOf,stats,weaponOf} from '../../game/engine/state';
import {monsterFor} from '../../game/engine/drops';
import {masteryPercent,masteryRequired} from '../../game/engine/gearMastery';
import {discount} from '../../game/engine/crafting';
import {APPEARANCES,TITLES,appearanceById,titleById} from '../../game/data/cosmetics';
import {selectAppearance,selectTitle} from '../../game/engine/cosmetics';
import {applyPreset,canAccessPresetSlot,renamePreset,savePreset} from '../../game/engine/presets';
import {getGoldenPresetSlotLimit,getGoldenRecorderBenefits,isGoldenRecorderActive,remainingGoldenTime} from '../../game/premium/goldenRecorder';
import {jobById} from '../../game/jobs/catalog';
import {lootTotals} from '../../game/engine/loot';
import {assetUrl,playerGraphicFor} from '../../game/data/graphics';
import {inventoryView} from '../../game/inventoryView';
import {InventoryDetailSheet} from '../inventory/InventoryDetailSheet';
import {Glyph,Meter,Pager,Screen,Segments,Stat} from '../../ui/mobile';

export type AppPage='home'|'towers'|'floor'|'battle'|'inventory'|'equipment'|'craft'|'mastery'|'enhancement'|'skills'|'jobs'|'cosmetics'|'premium'|'market'|'association'|'settings'|'bestiary';

export function HomeScreen({game,onMove}:{game:GameState;onMove:(p:AppPage)=>void}){
 const st=stats(game,game.expedition?.equipment),weapon=WEAPONS[weaponOf(game,game.expedition?.equipment)],job=jobById(game.currentJobId);
 return <Screen eyebrow="NOVAR / BASE CAMP" title="탑의 기록" meta={<span>{job?.displayName??'무직능'}</span>}>
  <div className="tc-home">
   <section className="tc-dossier"><div className="tc-dossier-top"><small>ACTIVE EXPLORER DOSSIER</small><span className="tc-dossier-symbol">{weapon.icon}</span></div><h2>{weapon.name}을 든 모험가</h2><p>{weapon.description}</p><div className="tc-stat-grid"><Stat label="HP" value={Math.round(st.hp)}/><Stat label="공격" value={Math.round(st.attack)}/><Stat label="방어" value={Math.round(st.defense)}/><Stat label="공속" value={st.speed.toFixed(2)}/></div><button className="tc-action" onClick={()=>onMove('towers')}>{game.expedition?'원정으로 돌아가기':'원정 준비'}</button></section>
   <div className="tc-cycle"><div><b>01</b><strong>원정</strong><small>재료 확보</small></div><div><b>02</b><strong>제작</strong><small>장비 생산</small></div><div><b>03</b><strong>성장</strong><small>더 높은 층</small></div></div>
   <div className="tc-quick">{[['bestiary','bestiary','생물록','조우 기록'],['jobs','jobs','직업','전투 키트'],['settings','settings','저장','백업 관리'],['cosmetics','cosmetics','외형','칭호·표시'],['skills','skills','스킬','3개 구성'],['mastery','craft','숙련','제작 자격']] .map(([p,g,t,s])=><button key={p} onClick={()=>onMove(p as AppPage)}><Glyph name={g}/><b>{t}</b><small>{s}</small></button>)}</div>
  </div>
 </Screen>;
}

export function TowersScreen({game,onSelect}:{game:GameState;onSelect:(tower:Tower)=>void}){
 return <Screen eyebrow="EXPEDITION BOARD" title="탑 선택" meta={<span>1~10F</span>}>
  <div className="tc-towers">{towerIds.map((t,i)=><button className="tc-tower" key={t} disabled={!PLAYABLE_TOWERS.includes(t)} onClick={()=>onSelect(t)} style={{'--tower':TOWERS[t].color} as React.CSSProperties}><Glyph name="towers"/><small>TOWER 0{i+1}</small><b>{TOWERS[t].name}</b><span>{TOWERS[t].material} · 발견 {game.progress[t]}F</span><em>{PLAYABLE_TOWERS.includes(t)?'입장 가능':'봉쇄'}</em></button>)}</div>
 </Screen>;
}

export function FloorScreen({game,setGame,tower,floor,setFloor,now,onBack,onEnter}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;tower:Tower;floor:number;setFloor:(n:number)=>void;now:number;onBack:()=>void;onEnter:()=>void}){
 const [tab,setTab]=useState<'bag'|'preset'>('bag'),[presetSlot,setPresetSlot]=useState(1),exp=game.expedition,presetLimit=getGoldenPresetSlotLimit(game,now),preset=game.expeditionPresets[presetSlot-1],open=canAccessPresetSlot(presetSlot,presetLimit),monster=monsterFor(tower,floor),generalCount=generalPotionIds.reduce((n,p)=>n+game.loadout[p],0),valid=!!game.tickets[tower][floor-1]&&generalCount<=CONFIG.generalPotionLimit;
 function updateBag(p:Potion,value:number){setGame(s=>({...s,loadout:{...s.loadout,[p]:Math.max(0,Math.min(s.potions[p],Math.floor(value)||0))}}));}
 return <Screen eyebrow="EXPEDITION PREP" title={TOWERS[tower].name} meta={<button className="tc-action secondary slim" onClick={onBack}>탑 변경</button>}>
  <div className="tc-floor">
   <div className="tc-floor-hero"><button onClick={()=>setFloor(Math.max(1,floor-1))}>−</button><div className="tc-floor-center"><b>{floor}F</b><small>{floor<=2?'SAFE · PK 불가':floor<=5?'PK 가능':'BOSS 구간'} · 입장권 {game.tickets[tower][floor-1]}장</small><div className="tc-stat-grid"><Stat label="적 HP" value={monster.hp}/><Stat label="공격" value={monster.attack.toFixed(0)}/><Stat label="방어" value={monster.defense.toFixed(0)}/><Stat label="공속" value={monster.speed.toFixed(2)}/></div></div><button onClick={()=>setFloor(Math.min(CONFIG.maxFloor,floor+1))}>+</button></div>
   <div className="tc-floor-content"><Segments items={[['bag','원정 가방'],['preset','프리셋']] as const} value={tab} onChange={setTab} label="원정 준비"/><div className="tc-floor-tabbody">{tab==='bag'?<div className="tc-potion-list">{potionIds.map(p=><label className="tc-potion-row" key={p}><span><b>{POTIONS[p].name}</b><small>T{POTIONS[p].tier} · 창고 {game.potions[p]}개{p==='revival'?' · 최대 '+CONFIG.revivalPotionLimit:''}</small></span><input type="number" min="0" disabled={!!exp||game.potions[p]===0} max={p==='revival'?Math.min(game.potions[p],CONFIG.revivalPotionLimit):game.potions[p]} value={game.loadout[p]} onChange={e=>updateBag(p,+e.target.value)}/></label>)}</div>:<div className="tc-preset"><select value={presetSlot} onChange={e=>setPresetSlot(+e.target.value)}>{game.expeditionPresets.map((x,i)=><option value={i+1} key={i}>슬롯 {i+1} · {x?.name||'비어 있음'}{canAccessPresetSlot(i+1,presetLimit)?'':' · 잠김'}</option>)}</select><div className="tc-preset-info"><strong>{preset?.name||'비어 있는 프리셋'}</strong><small>{open?(preset?'장비·스킬·포션 구성을 불러오거나 덮어쓸 수 있습니다.':'현재 구성을 저장할 수 있습니다.'):'황금기록자 전용 슬롯 · 데이터는 유지됩니다.'}</small></div><div className="tc-preset-actions"><button disabled={!open||!preset||!!exp} onClick={()=>setGame(s=>applyPreset(s,presetSlot,presetLimit))}>불러오기</button><button disabled={!open||!!exp} onClick={()=>setGame(s=>savePreset(s,presetSlot,preset?.name,presetLimit))}>저장</button><button disabled={!open||!preset||!!exp} onClick={()=>{const name=window.prompt('프리셋 이름',preset?.name);if(name!==null)setGame(s=>renamePreset(s,presetSlot,name,presetLimit));}}>이름</button></div></div>}</div></div>
   <div className="tc-floor-footer"><div className="tc-floor-risk">일반 포션 {generalCount}/{CONFIG.generalPotionLimit}<br/>사망 시 이번 원정 획득물과 남은 원정 포션 소멸</div><button className="tc-floor-enter" disabled={!valid} onClick={onEnter}>{floor}층 입장<small>{TOWERS[tower].material} 수집 · 입장권 1장 사용</small></button></div>
  </div>
 </Screen>;
}

export function EquipmentScreen({game,setGame,onSkills,onEnhancement}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;onSkills:()=>void;onEnhancement:()=>void}){
 const [slot,setSlot]=useState<Slot>('weapon'),[page,setPage]=useState(0),[selectedId,setSelectedId]=useState<string|null>(null);
 const st=stats(game),items=game.items.filter(i=>itemSlot(i.kind)===slot),PAGE=4,pages=Math.max(1,Math.ceil(items.length/PAGE)),safe=Math.min(page,pages-1),shown=items.slice(safe*PAGE,safe*PAGE+PAGE);
 const views=inventoryView(game),selectedView=selectedId?views.find(v=>v.category==='equipment'&&v.sourceId===selectedId):undefined;
 const current=equippedItem(game,slot),key=current?masteryKeyOf(current):null,m=key?game.gearMastery[key]:null,target=m?m.unlockedTier+1:1,graphic=playerGraphicFor(game.cosmetics.selectedAppearanceId),character=graphic.image.idle?assetUrl(graphic.image.idle):null;
 const slotTabs=(Object.keys(SLOTS) as Slot[]).map(s=>[s,SLOTS[s]] as [Slot,string]);
 const slotItem=(s:Slot)=>game.items.find(i=>i.id===game.equipped[s])??null;
 const slotIcon=(s:Slot)=>s==='weapon'?'sword':s==='armor'?'armor':s==='boots'?'boots':'accessory';
 const slotButton=(s:Slot,pos:string)=>{const item=slotItem(s);return <button className={'tc-equip-slot '+pos+(slot===s?' selected':'')} aria-label={SLOTS[s]+(item?' '+itemName(item):' 비어 있음')} onClick={()=>{setSlot(s);setPage(0);if(item)setSelectedId(item.id);}}><small>{SLOTS[s]}</small><Glyph name={item?slotIcon(s):'other'}/>{item?<><b>{itemName(item)}</b><em>T{item.tier} · +{item.enhancement}</em></>:<><b>비어 있음</b><em>장비 없음</em></>}</button>;};
 return <Screen eyebrow="EXPLORER LOADOUT" title="장비" meta={<><button className="tc-action secondary slim" onClick={onSkills}>스킬</button><button className="tc-action secondary slim" onClick={onEnhancement}>강화</button></>}>
  <div className="tc-loadout">
   <section className="tc-loadout-stage">
    <div className="tc-loadout-vitals"><Stat label="HP" value={Math.round(st.hp)}/><Stat label="공격" value={Math.round(st.attack)}/><Stat label="방어" value={Math.round(st.defense)}/></div>
    {slotButton('armor','left-top')}{slotButton('accessory','left-bottom')}{slotButton('boots','right-bottom')}{slotButton('weapon','center-bottom')}
    <div className="tc-character-figure">{character?<img src={character} alt="모험가"/>:<Glyph name="cosmetics"/>}</div>
   </section>
   <Segments items={slotTabs} value={slot} onChange={v=>{setSlot(v);setPage(0);setSelectedId(null);}} label="장비 부위"/>
   <div className="tc-loadout-inventory">{shown.map(item=><button className={'tc-loadout-card '+(game.equipped[slot]===item.id?'equipped':'')} key={item.id} onClick={()=>setSelectedId(item.id)}><span className="tc-item-tier">T{item.tier}</span><Glyph name={slotIcon(slot)}/><b>{itemName(item)}</b><small>+{item.enhancement}{game.equipped[slot]===item.id?' · 장착':''}</small></button>)}{Array.from({length:Math.max(0,PAGE-shown.length)},(_,i)=><div className="tc-loadout-card empty" key={'g'+i}/>)}</div>
   <div><Pager page={safe} count={pages} onChange={setPage}/>{m&&key&&<div className="tc-floor-risk">{GEAR_MASTERY_NAMES[key]} · T{m.unlockedTier} 착용 가능 · {m.unlockedTier>=5?'MAX':m.progress+'/'+masteryRequired(target)}<Meter value={masteryPercent(game,key)} max={100}/></div>}</div>
  </div>
  {selectedView&&<InventoryDetailSheet item={selectedView} onClose={()=>setSelectedId(null)} action={()=>setGame(state=>equip(state,selectedView.sourceId))} disabled={!!game.expedition||selectedView.equipped} label={selectedView.equipped?'장착 중':game.expedition?'원정 중 변경 불가':'장착'} secondaryAction={()=>{setSelectedId(null);onEnhancement();}} secondaryDisabled={!!game.expedition||selectedView.sourceId==='starter'} secondaryLabel="강화"/>}
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

export function MasteryScreen({game}:{game:GameState}){
 return <Screen eyebrow="WORKSHOP CERTIFICATION" title="제작 숙련도" meta={<span>분야별 독립</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:'5px'}}>{(Object.keys(FIELDS) as Field[]).map(f=>{const m=game.mastery[f],pct=m.unlocked===5?100:m.progress/CONFIG.masteryRequired*100;return <section className="tc-panel strong" key={f} style={{display:'grid',alignContent:'center',gap:'6px'}}><div className="tc-panel-title"><b>{FIELDS[f]}</b><small>T{m.unlocked}</small></div><Meter value={pct} max={100}/><div className="tc-stat-grid" style={{gridTemplateColumns:'1fr 1fr'}}><Stat label="진척" value={m.unlocked===5?'MAX':m.progress+'/'+CONFIG.masteryRequired}/><Stat label="절감" value={Math.round(discount(m.crafts)*100)+'%'}/></div><small style={{fontSize:'7px',color:'var(--muted)'}}>총 제작 {m.crafts}회 · 현재 최고 티어 제작만 다음 자격 진척</small></section>;})}</div>
 </Screen>;
}

export function CosmeticsScreen({game,setGame}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>}){
 const [tab,setTab]=useState<'appearance'|'title'>('appearance'),[page,setPage]=useState(0),PAGE=4,source=tab==='appearance'?APPEARANCES:TITLES.filter(t=>game.cosmetics.unlockedTitleIds.includes(t.id)),pages=Math.max(1,Math.ceil(source.length/PAGE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE,safe*PAGE+PAGE);
 return <Screen eyebrow="EXPLORER PROFILE" title="외형 · 칭호" meta={<span>{appearanceById(game.cosmetics.selectedAppearanceId)?.name||'기본'}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'auto 1fr auto',gap:'5px'}}><Segments items={[['appearance','외형'],['title','칭호']] as const} value={tab} onChange={v=>{setTab(v);setPage(0);}} label="프로필 꾸미기"/><div className="tc-job-list">{shown.map((x:any)=>tab==='appearance'?<article className="tc-job" key={x.id}><div><b>{x.name}</b><small>{x.description} · {x.sourceLabel}</small></div><button disabled={!!game.expedition||!game.cosmetics.unlockedAppearanceIds.includes(x.id)||game.cosmetics.selectedAppearanceId===x.id} onClick={()=>setGame(s=>selectAppearance(s,x.id))}>{game.cosmetics.selectedAppearanceId===x.id?'적용':'선택'}</button></article>:<article className="tc-job" key={x.id}><div><b>「{x.name}」</b><small>{x.description}</small></div><button disabled={!!game.expedition||game.cosmetics.selectedTitleId===x.id} onClick={()=>setGame(s=>selectTitle(s,x.id))}>{game.cosmetics.selectedTitleId===x.id?'적용':'선택'}</button></article>)}{Array.from({length:Math.max(0,PAGE-shown.length)},(_,i)=><div className="tc-job" key={'c'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></div>
 </Screen>;
}

export function PremiumScreen({game,setGame,now}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;now:number}){
 const active=isGoldenRecorderActive(game,now),benefit=getGoldenRecorderBenefits(game,now);
 return <Screen eyebrow="ACCOUNT STATUS" title="황금기록자" meta={<span>{active?'활성':'미등록'}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'1fr auto',gap:'6px'}}><section className="tc-panel strong" style={{display:'grid',alignContent:'center',gap:'8px'}}><small className="tc-kicker">GOLDEN RECORDER</small><h2 style={{font:'700 19px Georgia',margin:0}}>{active?remainingGoldenTime(game.goldenRecorder.expiresAt,now)+' 남음':'등록 혜택 미적용'}</h2><div className="tc-stat-grid"><Stat label="프리셋" value={benefit.presetSlots+'칸'}/><Stat label="제작 절감" value={benefit.craftingMaterialReductionBonus?Math.round(benefit.craftingMaterialReductionBonus*100)+'%':'없음'}/><Stat label="Gold 수수료" value={Math.round(benefit.goldSaleFeeRate*100)+'%'}/><Stat label="만료" value={active?new Date(game.goldenRecorder.expiresAt!).toLocaleDateString('ko-KR'):'—'}/></div><p style={{fontSize:'8px',color:'var(--muted)',margin:0}}>게임 플레이 규칙은 그대로이며 표시된 혜택은 기존 황금기록자 데이터에서 읽습니다.</p></section>{import.meta.env.DEV&&<div className="tc-segments"><button onClick={()=>setGame(s=>({...s,goldenRecorder:{expiresAt:now+3600000}}))}>QA +1H</button><button onClick={()=>setGame(s=>({...s,goldenRecorder:{expiresAt:now+30*86400000}}))}>QA +30D</button><button onClick={()=>setGame(s=>({...s,goldenRecorder:{expiresAt:now}}))}>QA 만료</button></div>}</div>
 </Screen>;
}

export function ExpeditionCompleteScreen({game,onInventory,onTowers}:{game:GameState;onInventory:()=>void;onTowers:()=>void}){
 const r=game.lastExpedition;if(!r)return <Screen eyebrow="EXPEDITION REPORT" title="원정 기록"><div className="tc-panel">{game.notice}</div></Screen>;
 const totals=lootTotals(r.loot),dead=r.outcome==='dead';
 return <Screen eyebrow="EXPEDITION REPORT" title={dead?'원정 실패':'안전 귀환'} meta={<span>{r.kills}체 처치</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'1fr auto',gap:'6px'}}><section className={'tc-panel strong '+(dead?'danger':'')} style={{display:'grid',alignContent:'center',gap:'8px'}}><small className="tc-kicker">{dead?'LOST IN EXPEDITION':'SETTLEMENT COMPLETE'}</small><h2 style={{font:'700 20px Georgia',margin:0}}>{dead?'이번 원정 전리품을 잃었습니다.':'획득물이 영구 보관함에 저장되었습니다.'}</h2><div className="tc-stat-grid"><Stat label="Silver" value={(dead?0:r.loot.silver).toLocaleString()}/><Stat label="재료" value={dead?0:totals.materials}/><Stat label="입장권" value={dead?0:totals.tickets}/><Stat label="처치" value={r.kills}/></div><p style={{fontSize:'8px',color:'var(--muted)',margin:0}}>{dead?'기존 Silver·보관함·장비·스킬은 유지됩니다.':'입장에 사용한 입장권은 반환되지 않습니다.'}</p></section><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}><button className="tc-action secondary" onClick={onInventory}>보관함</button><button className="tc-action" onClick={onTowers}>다음 원정</button></div></div>
 </Screen>;
}
