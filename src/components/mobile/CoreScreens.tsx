import React,{useMemo,useState} from 'react';
import type {GameState,Tower,Potion} from '../../game/types';
import {CONFIG,POTIONS,SKILLS,TOWERS,WEAPONS,generalPotionIds,potionIds,towerIds,PLAYABLE_TOWERS} from '../../game/data/config';
import {equippedItem,itemName,stats,weaponOf} from '../../game/engine/state';
import {monsterFor} from '../../game/engine/drops';
import {APPEARANCES,TITLES,appearanceById,titleById} from '../../game/data/cosmetics';
import {selectAppearance,selectTitle} from '../../game/engine/cosmetics';
import {applyPreset,getPresetSlotLimit,renamePreset,savePreset} from '../../game/engine/presets';
import {jobById} from '../../game/jobs/catalog';
import {assetUrl} from '../../game/data/graphics';
import {lootTotals} from '../../game/engine/loot';
import {Glyph,Pager,Screen,Segments,Stat} from '../../ui/mobile';
import {GOLD_SHOP_PACKAGES,formatKrw,getGoldPackageBySku} from '../../shop/catalog';

export type AppPage='craft'|'world'|'home'|'hunt'|'towers'|'floor'|'battle'|'inventory'|'enhancement'|'skills'|'jobs'|'cosmetics'|'market'|'gold-exchange'|'association'|'seal'|'occupation'|'settings'|'bestiary'|'shop';

export function HomeScreen({game,onMove,onOpenJobs,nickname}:{nickname?:string;game:GameState;onMove:(p:AppPage)=>void;onOpenJobs:(tab:'register'|'list')=>void}){
 const equipment=game.expedition?.equipment??game.equipped,st=stats(game,equipment),weaponId=weaponOf(game,equipment),weapon=WEAPONS[weaponId],equippedWeapon=equippedItem(game,'weapon',equipment),job=jobById(game.currentJobId);
 const highestReturn=Math.max(...towerIds.map(t=>game.exploration.highestReturned[t]));
 const loot=game.expedition?.loot??game.lastExpedition?.loot,lootSummary=loot?lootTotals(loot):{materials:0,tickets:0,skillBooks:0,equipment:0},routeKills=game.expedition?.kills??game.lastExpedition?.kills??0;
 const routeTitle=game.expedition?'진행 중인 원정':game.lastExpedition?'최근 원정':'탐험 기록';
 const routeText=game.expedition?`${TOWERS[game.expedition.tower].name} · ${game.expedition.floor}층 원정 중`:game.lastExpedition?`${TOWERS[game.lastExpedition.tower].name} · ${game.lastExpedition.floor}층 ${game.lastExpedition.outcome==='returned'?'안전 귀환':'원정 종료'}`:highestReturn?`최고 ${highestReturn}층에서 안전 귀환`:'첫 원정을 앞두고';
 const routeCaption=game.expedition?'전리품은 안전 귀환 전까지 임시 보관됩니다.':game.lastExpedition?.outcome==='returned'?'최근 귀환 기록과 획득물을 요약합니다.':'다음 출정을 준비하세요.';
 const quick=[
  {id:'craft',glyph:'craft',title:'제작',subtitle:'포션 · 음식 · 도전권',action:()=>onMove('craft')},
  {id:'jobs-list',glyph:'jobs',title:'직능목록',subtitle:`보유 직능 ${game.ownedJobIds.length}종`,action:()=>onOpenJobs('list')},
  {id:'gold-exchange',glyph:'market',title:'골드 거래소',subtitle:'Gold ↔ Silver',action:()=>onMove('gold-exchange')},
  {id:'seal',glyph:'association',title:'협회 인장',subtitle:'20회 주조 · 30단계',action:()=>onMove('seal')},
  {id:'occupation',glyph:'towers',title:'점령전',subtitle:'3전선 · 토 22:00',action:()=>onMove('occupation')},
  {id:'bestiary',glyph:'bestiary',title:'생물록',subtitle:'발견한 생물',action:()=>onMove('bestiary')},
  {id:'settings',glyph:'settings',title:'계정 · 저장',subtitle:'연결과 저장 상태',action:()=>onMove('settings')},
 ];
 return <Screen title="노바르 거점" className="tc-camp-screen" meta={<span className="tc-camp-status">{game.expedition?'원정 중':'출정 대기'}</span>}>
  <div className="tc-camp tc-camp-with-world">
   <section className="tc-camp-dossier" aria-label="모험가 기록">
    <header className="tc-camp-dossier-title"><Glyph name="association"/><b>모험가 기록</b><small>{game.expedition?'EXPEDITION':'NOVAR DOSSIER'}</small></header>
    <div className="tc-camp-profile">
     <div className={'tc-camp-crest'+(job?.visualAssetKey?' has-job-art':'')} aria-hidden="true">{job?.visualAssetKey?<img src={assetUrl(job.visualAssetKey)} alt=""/>:<><span/><Glyph name={weaponId}/></>}</div>
     <div className="tc-camp-identity"><small>{job?(nickname?job.displayName:'현재 직능'):'직능 미선택'}{job&&<span>{job.rarity}</span>}</small><h2>{nickname??job?.displayName??'모험가'}</h2><p>{weapon.description}</p></div>
     <button className="tc-camp-weapon tc-feel-press" data-game-feel="press" onClick={()=>onMove('inventory')}><small>장착 무기</small><span className="tc-camp-weapon-icon"><Glyph name={weaponId}/></span><b>{equippedWeapon?itemName(equippedWeapon):'미장착'}</b><em>장비 확인 ›</em></button>
    </div>
    <dl className="tc-camp-stats"><div><dt>최대 체력</dt><dd>{Math.round(st.hp)}</dd></div><div><dt>공격</dt><dd>{Math.round(st.attack)}</dd></div><div><dt>방어</dt><dd>{Math.round(st.defense)}</dd></div><div><dt>공격속도</dt><dd>{st.speed.toFixed(2)}</dd></div></dl>
   </section>
   <section className="tc-camp-expedition" aria-label="원정">
    <div className="tc-camp-expedition-copy">
     <div className="tc-camp-route"><Glyph name="towers"/><div><small>{routeTitle}</small><b>{routeText}</b><p>{routeCaption}</p></div></div>
     <div className="tc-camp-loot" aria-label={game.expedition?'현재 원정 획득물':'최근 원정 기록'}>
      <span><Glyph name="market"/><small>Silver</small><b>{(loot?.silver??0).toLocaleString()}</b></span>
      <span><Glyph name="materials"/><small>재료</small><b>{lootSummary.materials}</b></span>
      <span><Glyph name="equipment"/><small>장비</small><b>{lootSummary.equipment}</b></span>
      <span><Glyph name="sword"/><small>처치</small><b>{routeKills}</b></span>
     </div>
    </div>
    <button className="tc-camp-depart tc-feel-press" data-game-feel="press" onClick={()=>onMove(game.expedition?'battle':'hunt')}><Glyph name="sword"/><span>{game.expedition?'원정으로 돌아가기':'사냥하기'}</span><span aria-hidden="true">›</span></button>
   </section>
   <button className="tc-action tc-feel-press" onClick={()=>onMove('world')}>마을 이동 · 10개 마을과 중앙 도시 ›</button>
   <nav className="tc-camp-links" aria-label="거점 시설">{quick.map(item=><button className="tc-feel-press" data-game-feel="press" data-facility={item.id} key={item.id} onClick={item.action}><span className="tc-camp-link-icon"><Glyph name={item.glyph}/></span><span><b>{item.title}</b><small>{item.subtitle}</small></span><i aria-hidden="true">›</i></button>)}</nav>
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
 const [tab,setTab]=useState<'appearance'|'title'>('appearance'),[page,setPage]=useState(0),PAGE=4,source=tab==='appearance'?APPEARANCES:TITLES.filter(t=>game.cosmetics.unlockedTitleIds.includes(t.id)),pages=Math.max(1,Math.ceil(source.length/PAGE)),safe=Math.min(page,pages-1),shown=source.slice(safe*PAGE,safe*PAGE+PAGE);
 return <Screen eyebrow="EXPLORER PROFILE" title="외형 · 칭호" meta={<span>{appearanceById(game.cosmetics.selectedAppearanceId)?.name||'기본'}</span>}>
  <div style={{height:'100%',display:'grid',gridTemplateRows:'auto 1fr auto',gap:'5px'}}><Segments items={[['appearance','외형'],['title','칭호']] as const} value={tab} onChange={v=>{setTab(v);setPage(0);}} label="프로필 꾸미기"/><div className="tc-job-list">{shown.map((x:any)=>tab==='appearance'?<article className="tc-job" key={x.id}><div><b>{x.name}</b><small>{x.description} · {x.sourceLabel}</small></div><button disabled={!!game.expedition||!game.cosmetics.unlockedAppearanceIds.includes(x.id)||game.cosmetics.selectedAppearanceId===x.id} onClick={()=>setGame(s=>selectAppearance(s,x.id))}>{game.cosmetics.selectedAppearanceId===x.id?'적용':'선택'}</button></article>:<article className="tc-job" key={x.id}><div><b>「{x.name}」</b><small>{x.description}</small></div><button disabled={!!game.expedition||game.cosmetics.selectedTitleId===x.id} onClick={()=>setGame(s=>selectTitle(s,x.id))}>{game.cosmetics.selectedTitleId===x.id?'적용':'선택'}</button></article>)}{Array.from({length:Math.max(0,PAGE-shown.length)},(_,i)=><div className="tc-job" key={'c'+i}/>)}</div><Pager page={safe} count={pages} onChange={setPage}/></div>
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
