import React from 'react';
import './craft-screen.css';
import {CRAFT_RECIPES,PRODUCT_NAMES,craftLimit,craftPreview,type ProductId} from '../../game/life/crafting';
import {LIFE_MATERIAL_NAMES,type VillageLifeState} from '../../online/villageLife';
type Props={state:VillageLifeState;busy:boolean;count:number;recipe:ProductId;onRecipe:(id:ProductId)=>void;onCount:(n:number)=>void;onCraft:(id:ProductId)=>void};
export function CraftScreen({state,busy,count,recipe,onRecipe,onCount,onCraft}:Props){
 const town=state.towns.find(t=>t.id===state.location)!,recipes=CRAFT_RECIPES.filter(r=>town.kind==='city'||r.kind===town.kind),r=recipes.find(r=>r.id===recipe)??recipes[0],mastery=state.craftMastery??0;
 const limit=craftLimit(state,r.id),preview=craftPreview(r.id,count,mastery,state.craftCarry?.[r.id]??0);
 const owned=state.materials[r.material]??0;
 return <div className="tc-craft tc-game-craft">
  <header className="tc-craft-header"><h2>제작소</h2><span>{town.name}</span><b>행동력 {state.ap}/100</b></header>
  <div className="tc-craft-mastery"><span>숙련도 {mastery.toLocaleString()}</span><b>생산 보너스 +{Math.min(50,Math.floor(mastery/100))}%</b></div>
  <div className="tc-item-tabs">{recipes.map(item=><button key={item.id} className={r.id===item.id?'active':''} disabled={busy} onClick={()=>onRecipe(item.id)}>{PRODUCT_NAMES[item.id]}</button>)}</div>
  <section className="tc-craft-board">
   <div className="tc-item-slot"><small>재료</small><strong>{LIFE_MATERIAL_NAMES[r.material]}</strong><em>x{owned.toLocaleString()}</em><p>10개 필요</p></div>
   <div className="tc-craft-arrow">▶</div>
   <div className="tc-item-slot result"><small>완성품</small><strong>{PRODUCT_NAMES[r.id]}</strong><em>x{preview.quantity.toLocaleString()}</em></div>
  </section>
  <div className="tc-life-quantity"><label>제작 횟수 (최대 {limit})</label><div><button disabled={busy} onClick={()=>onCount(1)}>1회</button><button disabled={busy} onClick={()=>onCount(10)}>10회</button><button disabled={busy||limit===0} onClick={()=>onCount(limit)}>최대</button></div></div>
  <button className="tc-action tc-feel-press tc-craft-main" disabled={busy||count>limit} onClick={()=>onCraft(r.id)}>{busy?'제작 중…':`제작하기 ${count}회`}</button>
 </div>;
}
