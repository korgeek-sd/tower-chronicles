import React,{useEffect,useRef,useState} from 'react';
import type {GameplayLease} from '../../online/gameSession';
import type {GuildAuctionState} from '../../online/guildAuction';
import {GameScrollSelect} from '../../ui/GameScrollSelect';
import {GUILD_MATERIAL_IDS,GUILD_MATERIAL_NAMES,getGuildMaterials,registerGuildMaterialAuction,type GuildMaterial,type GuildMaterialsState} from '../../online/guildMaterials';
type Request={requestId:string;material:GuildMaterial;quantity:number;bid:number};
export function GuildMaterialAuctionForm({lease,associationId,expedition,onListed}:{lease:GameplayLease;associationId:string;expedition:boolean;onListed:(state:GuildAuctionState)=>void}){
 const [stock,setStock]=useState<GuildMaterialsState|null>(null),[material,setMaterial]=useState<GuildMaterial>('herb');
 const [quantity,setQuantity]=useState('100'),[price,setPrice]=useState('100'),[pending,setPending]=useState<Request|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=useRef(true),lock=useRef(false);
 const key='tc-guild-material-auction:'+associationId;
 useEffect(()=>{
  active.current=true;
  try{const raw=window.sessionStorage.getItem(key);setPending(raw?JSON.parse(raw) as Request:null);}catch{setPending(null);}
  void getGuildMaterials(lease).then(s=>{if(active.current)setStock(s);}).catch(()=>{if(active.current)setMessage('길드 재료 창고 정보를 불러오지 못했습니다.');});
  return()=>{active.current=false;};
 },[lease.leaseId,lease.generation,associationId]);
 const register=async()=>{
  if(lock.current)return;
  const req=pending??{requestId:crypto.randomUUID(),material,quantity:Number(quantity),bid:Number(price)};
  if(!Number.isSafeInteger(req.quantity)||req.quantity<1||req.quantity>1000000000||
   !Number.isSafeInteger(req.bid)||req.bid<1||req.bid>1000000000)return;
  lock.current=true;setBusy(true);setMessage('');
  try{
   if(!pending){sessionStorage.setItem(key,JSON.stringify(req));setPending(req);}
   const result=await registerGuildMaterialAuction(lease,req.requestId,req.material,req.quantity,req.bid);
   window.sessionStorage.removeItem(key);
   if(!active.current)return;
   setPending(null);onListed(result.state);
   setMessage(GUILD_MATERIAL_NAMES[req.material]+' ×'+req.quantity+'개 · 24시간 경매 등록 완료');
   setStock(await getGuildMaterials(lease));
  }catch(e){if(active.current)setMessage(e instanceof Error?e.message:'재료 경매 등록 실패');}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 const q=Number(quantity),p=Number(price);
 return <section className="tc-ga-register tc-ga-material-form" aria-label="길드 재료 경매 등록">
  <div className="tc-ga-section-title"><b>세금 재료 경매 등록</b><small>길드 창고 → 공헌도 경매</small></div>
  <p>재료 수량과 시작 공헌도를 지정하면 기존과 동일하게 24시간 경매됩니다.</p>
  <GameScrollSelect ariaLabel="경매 등록 재료" value={material} onChange={m=>setMaterial(m as GuildMaterial)}
   disabled={busy||!!pending} options={GUILD_MATERIAL_IDS.map(id=>({value:id,label:GUILD_MATERIAL_NAMES[id],detail:'창고 '+(stock?.materials[id]??0).toLocaleString('ko-KR')+'개'}))}/>
  <label>재료 수량<input type="number" min="1" max="1000000000" inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy||!!pending}/></label>
  <label>시작 입찰 공헌도<input type="number" min="1" max="1000000000" inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value)} disabled={busy||!!pending}/></label>
  <button type="button" onClick={()=>void register()} disabled={busy||expedition||!!pending||!stock||!Number.isSafeInteger(q)||q<1||q>(stock.materials[material]??0)||!Number.isSafeInteger(p)||p<1||p>1000000000}>재료 24시간 경매 등록</button>
  {pending&&<div className="tc-ga-pending">이전 등록 요청 확인 필요 <button type="button" disabled={busy} onClick={()=>void register()}>이전 등록 재확인</button></div>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
