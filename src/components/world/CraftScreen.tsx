import React from 'react';
import {CRAFT_RECIPES,PRODUCT_NAMES,craftLimit,craftPreview,type ProductId} from '../../game/life/crafting';
import {LIFE_MATERIAL_NAMES,type VillageLifeState} from '../../online/villageLife';
type Props={state:VillageLifeState;busy:boolean;count:number;recipe:ProductId;onRecipe:(id:ProductId)=>void;onCount:(n:number)=>void;onCraft:(id:ProductId)=>void};
export function CraftScreen({state,busy,count,recipe,onRecipe,onCount,onCraft}:Props){
 const town=state.towns.find(t=>t.id===state.location)!,recipes=CRAFT_RECIPES.filter(r=>town.kind==='city'||r.kind===town.kind),r=recipes.find(r=>r.id===recipe)??recipes[0],mastery=state.craftMastery??0;
 const limit=craftLimit(state,r.id),preview=craftPreview(r.id,count,mastery,state.craftCarry?.[r.id]??0);
 return <div className="tc-craft">
  <div className="tc-craft-mastery"><span>제작 숙련도 <b>{mastery.toLocaleString()}</b></span><span>추가 생산 +{Math.min(50,Math.floor(mastery/100))}%</span><small>100회 제작마다 +1% · 최대 50% · 소수점 누적</small></div>
  <label className="tc-craft-select">제작품<select value={r.id} disabled={busy} onChange={e=>onRecipe(e.target.value as ProductId)}>{recipes.map(r=><option key={r.id} value={r.id}>{PRODUCT_NAMES[r.id]}</option>)}</select></label>
  <article className="tc-craft-recipe"><h2>{PRODUCT_NAMES[r.id]}</h2><p>{LIFE_MATERIAL_NAMES[r.material]} 10개 → 기본 {r.base.toLocaleString()}개 · 행동력 1</p><small>{r.description}</small><div><span>{LIFE_MATERIAL_NAMES[r.material]} 보유 <b>{(state.materials[r.material]??0).toLocaleString()}</b></span><span>완제품 보유 <b>{(state.products?.[r.id]??0).toLocaleString()}</b></span></div></article>
  <section className="tc-life-quantity"><label htmlFor="craft-count">제작 횟수 · 현재 최대 {limit}회</label><div>{[1,10].map(n=><button key={n} aria-pressed={count===n} disabled={busy} onClick={()=>onCount(n)}>{n}회</button>)}<button disabled={busy||limit===0} onClick={()=>onCount(limit)}>최대</button><input id="craft-count" aria-label="제작 횟수 직접 입력" type="number" min="1" max="100" value={count} disabled={busy} onChange={e=>onCount(Math.max(1,Math.min(100,Math.trunc(Number(e.target.value)||1))))}/></div></section>
  <div className="tc-craft-preview"><span>소모 {LIFE_MATERIAL_NAMES[r.material]} {count*10}개 · 행동력 {count}</span><b>예상 생산 {preview.quantity.toLocaleString()}개</b></div>
  <button className="tc-action tc-feel-press" disabled={busy||count>limit} onClick={()=>onCraft(r.id)}>{busy?'처리 중…':`${PRODUCT_NAMES[r.id]} ${count}회 제작`}</button>
  <p className="tc-craft-note">제작은 채집 행동력을 함께 사용합니다. 마을 생산량은 차감하지 않습니다. 음식 사용은 ‘가방’에서 할 수 있습니다.</p>
 </div>;
}
