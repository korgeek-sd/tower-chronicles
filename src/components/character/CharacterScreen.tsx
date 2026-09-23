import React from 'react';
import type {GameState,Slot} from '../../game/types';
import {SLOTS,GEAR_MASTERY_KEYS,GEAR_MASTERY_NAMES} from '../../game/data/config';
import {stats,equippedItem,itemName} from '../../game/engine/state';
import {equipmentIcon,shortItemName,formatStat,statLabels,tierRoman} from '../../game/equipmentView';
import {masteryPercent,masteryRequired} from '../../game/engine/gearMastery';
import {APPEARANCES,TITLES,appearanceById,titleById} from '../../game/data/cosmetics';
import {selectAppearance,selectTitle} from '../../game/engine/cosmetics';
import {jobById} from '../../game/jobs/catalog';
import {InventoryIcon} from '../inventory/InventoryDetailSheet';
import {CharacterSkills} from './CharacterSkills';

export type CharacterTab='equipment'|'skills'|'cosmetics';
export function CharacterScreen({game,setGame,tab,onTab,onInventory}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;tab:CharacterTab;onTab:(tab:CharacterTab)=>void;onInventory:(slot?:Slot)=>void}){
 const equipment=game.expedition?.equipment??game.equipped,base=stats(game,equipment),appearance=appearanceById(game.cosmetics.selectedAppearanceId)??APPEARANCES[0],title=titleById(game.cosmetics.selectedTitleId??''),job=jobById(game.currentJobId);
 return <section className="character-screen">
  <div className="journal-heading"><div><small>CHARACTER / 탐사자 기록</small><h1>나의 모험가</h1></div><button onClick={()=>onInventory()}>가방 <span>↗</span></button></div>
  <div className="character-tabs" aria-label="캐릭터 관리">{([['equipment','장비'],['skills','직업 · 스킬'],['cosmetics','외형 · 칭호']] as const).map(([value,label])=><button key={value} aria-pressed={tab===value} onClick={()=>onTab(value)}>{label}</button>)}</div>
  {game.expedition&&<p className="journal-lock">원정 진행 중 · 장비, 직업, 스킬, 외형은 귀환 후 변경할 수 있습니다.</p>}
  {tab==='equipment'&&<>
   <section className="character-portrait"><div className="character-identity"><small>{title?'「'+title.name+'」':'노바르에 기록된 탐사자'}</small><h2>{job?.displayName??'자유 탐사자'}</h2></div><div className="character-paperdoll"><figure><img src={'./'+appearance.imagePath} alt={appearance.name}/></figure>{(['weapon','armor','boots','accessory'] as Slot[]).map(slot=>{const item=equippedItem(game,slot,equipment);return <button key={slot} className={'character-gear-slot slot-'+slot+(item?' has-gear':'')} onClick={()=>onInventory(slot)} aria-label={SLOTS[slot]+' 선택'+(item?' · '+itemName(item):' · 비어 있음')}><span>{SLOTS[slot]}</span><InventoryIcon id={item?equipmentIcon(item):slot==='weapon'?'sword':slot} tier={item?.tier}/><small>{item?shortItemName(itemName(item)):'비어 있음'}</small></button>;})}</div><p className="portrait-caption">장비 슬롯을 눌러 교체 · 외형은 장비와 별도로 적용됩니다</p></section>
   <div className="character-stats" aria-label="캐릭터 기본 능력치">{statLabels.map(([key,label])=><div key={key}><small>{label}</small><b>{formatStat(base[key])}{key==='skillPower'&&<em>×</em>}</b></div>)}</div>
   <div className="journal-section-title"><h2>장비 숙련도</h2><small>원정에서 쌓이는 성장</small></div><section className="character-mastery">{GEAR_MASTERY_KEYS.map(key=>{const value=game.gearMastery[key],percent=masteryPercent(game,key);return <div className="character-mastery-row" key={key}><InventoryIcon id={key}/><div><div><strong>{GEAR_MASTERY_NAMES[key]}</strong><span>{tierRoman(value.unlockedTier)}단계</span></div><progress aria-label={GEAR_MASTERY_NAMES[key]+' 숙련도'} value={percent} max={100}/><small>{value.unlockedTier>=5?'최고 단계':value.progress+' / '+masteryRequired(value.unlockedTier+1)+' · 다음 '+tierRoman(value.unlockedTier+1)+'단계'}</small></div></div>;})}</section>
  </>}
  {tab==='skills'&&<CharacterSkills game={game} setGame={setGame}/>}
  {tab==='cosmetics'&&<><section className="appearance-hero"><img src={'./'+appearance.imagePath} alt={appearance.name}/><div><span className="journal-eyebrow">현재 외형</span><h2>{appearance.name}</h2><p>외형과 칭호는 전투 능력치에 영향을 주지 않습니다.</p></div></section><div className="journal-section-title"><h2>외형 보관함</h2><small>{game.cosmetics.unlockedAppearanceIds.length}종 등록</small></div>{APPEARANCES.map(value=>{const owned=game.cosmetics.unlockedAppearanceIds.includes(value.id),selected=value.id===appearance.id;return <div className="appearance-row journal-panel" key={value.id}><img src={'./'+value.imagePath} alt=""/><div><strong>{value.name}</strong><small>{value.sourceLabel}</small></div><button disabled={!!game.expedition||!owned||selected} onClick={()=>setGame(s=>selectAppearance(s,value.id))}>{selected?'적용 중':owned?'적용':'미등록'}</button></div>;})}<section className="journal-panel"><h2>칭호</h2>{game.cosmetics.selectedTitleId&&<button disabled={!!game.expedition} onClick={()=>setGame(s=>selectTitle(s,null))}>현재 칭호 해제</button>}{TITLES.filter(value=>game.cosmetics.unlockedTitleIds.includes(value.id)).map(value=><div className="job-catalog-row" key={value.id}><div><strong>{value.name}</strong><small>{value.description}</small></div><button disabled={!!game.expedition||game.cosmetics.selectedTitleId===value.id} onClick={()=>setGame(s=>selectTitle(s,value.id))}>적용</button></div>)}{!game.cosmetics.unlockedTitleIds.length&&<p className="journal-description">아직 기록된 칭호가 없습니다.</p>}</section></>}
 </section>;
}
