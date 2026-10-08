import React,{useEffect,useRef,useState} from 'react';
import {Glyph} from '../../ui/mobile';
import './craft-screen.css';
import {CRAFT_RECIPES,PRODUCT_NAMES,craftLimit,craftPreview,type ProductId} from '../../game/life/crafting';
import {LIFE_MATERIAL_NAMES,type VillageLifeState} from '../../online/villageLife';
type Props={state:VillageLifeState;busy:boolean;count:number;recipe:ProductId;onRecipe:(id:ProductId)=>void;onCount:(n:number)=>void;onCraft:(id:ProductId)=>void};
export function CraftScreen({state,busy,count,recipe,onRecipe,onCount,onCraft}:Props){
 const town=state.towns.find(t=>t.id===state.location)!,recipes=CRAFT_RECIPES.filter(r=>town.kind==='city'||r.kind===town.kind),r=recipes.find(r=>r.id===recipe)??recipes[0],mastery=state.craftMastery??0;
 const limit=craftLimit(state,r.id),preview=craftPreview(r.id,Math.max(1,Math.min(100,Math.floor(count)||1)),mastery,state.craftCarry?.[r.id]??0);
 const owned=state.materials[r.material]??0;
 const [confirm,setConfirm]=useState(false),[completed,setCompleted]=useState<{id:ProductId;quantity:number}|null>(null);
 const previous=useRef({busy,products:state.products});
 useEffect(()=>{const prior=previous.current;if(prior.busy&&!busy){const delta=(state.products?.[r.id]??0)-(prior.products?.[r.id]??0);if(delta>0)setCompleted({id:r.id,quantity:delta});}previous.current={busy,products:state.products};},[busy,state.products,r.id]);
 const quantity=Math.max(1,Math.min(100,Math.floor(count)||1)),required=quantity*10,canCraft=!busy&&quantity<=limit;
 const symbols:Record<ProductId,string>={potion:'potions',attack_food:'health',defense_food:'health',experience_food:'health',challenge_ticket:'tickets'};
 const materials:Record<string,string>={herb:'materials',pepper:'materials',potato:'materials',wheat:'materials',stone:'materials'};
 const rarity=r.id==='challenge_ticket'?'rare':r.id==='potion'?'common':'uncommon';
 return <div className="tc-craft tc-game-craft">
  <header className="tc-craft-header"><h2>제작소</h2><span>{town.name}</span><b>행동력 {state.actionPoints}/100</b></header>
  <div className="tc-craft-mastery"><span>제작 숙련도 {mastery.toLocaleString()}</span><b>생산 보너스 +{Math.min(50,Math.floor(mastery/100))}%</b></div>
  <div className="tc-item-tabs">{recipes.map(item=><button key={item.id} className={r.id===item.id?'active':''} disabled={busy} onClick={()=>onRecipe(item.id)}>{PRODUCT_NAMES[item.id]}</button>)}</div>
  <section className="tc-craft-board">
   <div className={`tc-item-slot ${owned<required?'insufficient':''}`}><small>재료</small><span className="tc-craft-glyph" aria-hidden="true"><Glyph name={materials[r.material]}/></span><strong>{LIFE_MATERIAL_NAMES[r.material]}</strong><em>{owned.toLocaleString()} / {required.toLocaleString()}</em><p>{owned<required?`부족 ${required-owned}개`:'재료 확보'}</p></div>
   <div className="tc-craft-arrow">▶</div>
   <div className={`tc-item-slot result ${rarity}`}><small>예상 완성품 미리보기</small><span className="tc-craft-glyph" aria-hidden="true"><Glyph name={symbols[r.id]}/></span><strong>{PRODUCT_NAMES[r.id]}</strong><em>x{preview.quantity.toLocaleString()}</em><p>{r.description}</p></div>
  </section>
  <div className="tc-life-quantity"><label>제작 횟수 (최대 {limit})</label><div><button disabled={busy} aria-pressed={quantity===1} onClick={()=>onCount(1)}>1회</button><button disabled={busy||limit<10} aria-pressed={quantity===10} onClick={()=>onCount(10)}>10회</button><button disabled={busy||limit===0} aria-pressed={quantity===limit} onClick={()=>onCount(limit)}>최대</button></div></div>
  <button className="tc-action tc-feel-press tc-craft-main" disabled={!canCraft} onClick={()=>setConfirm(true)}>{busy?'제작 중…':`제작하기 ${quantity}회`}</button>
  <div className="tc-craft-status" role="status">{busy?'제작 요청 처리 중…':limit===0?'재료 또는 행동력이 부족합니다.':`행동력 ${quantity} · 재료 ${required}개 소비`}</div>
  {busy&&<div className="tc-craft-progress" role="progressbar" aria-label="제작 요청 처리 중"><span/></div>}
  {completed&&<div className="tc-craft-overlay" role="dialog" aria-modal="true" aria-label="제작 완료"><div className="tc-craft-dialog tc-craft-success"><div className="tc-craft-reward"><Glyph name={symbols[completed.id]}/></div><h3>제작 완료!</h3><p>{PRODUCT_NAMES[completed.id]} × {completed.quantity.toLocaleString()}</p><button onClick={()=>setCompleted(null)}>확인</button></div></div>}
  {confirm&&<div className="tc-craft-overlay" role="dialog" aria-modal="true" aria-label="제작 확인"><div className="tc-craft-dialog"><h3>제작 확인</h3><p>{PRODUCT_NAMES[r.id]} {quantity}회 제작</p><p>행동력 {quantity}, 재료 {required}개 소비</p><div><button onClick={()=>setConfirm(false)}>취소</button><button disabled={!canCraft} onClick={()=>{setConfirm(false);onCraft(r.id);}}>제작 확정</button></div></div></div>}
 </div>;
}
