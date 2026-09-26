import React,{useMemo,useState} from 'react';
import type {CraftJob,Field,GameState,Potion} from '../../game/types';
import {CONFIG,EQUIPMENT,FIELDS,PASSIVES,POTION_CRAFTING,POTIONS,TOWERS,WEAPONS,potionIds} from '../../game/data/config';
import {itemName} from '../../game/engine/state';
import {GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT,cancelCraft,claimAllCraft,claimCraft,cost,discount,materialFor,startCraft} from '../../game/engine/crafting';
import {getGoldenRecorderBenefits,isGoldenRecorderActive} from '../../game/premium/goldenRecorder';
import {Glyph,Pager,Screen,Segments,Meter} from '../../ui/mobile';
import type {GameplayLease} from '../../online/gameSession';
import {applyServerEconomyRecord,cancelOnlineCraft,claimOnlineCraft,startOnlineCraft} from '../../online/economy';

const PAGE_SIZE=3;
const fields=[['weapon','무기'],['armor','방어구'],['accessory','장신구'],['alchemy','연금술']] as const;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const left=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
function label(job:CraftJob){return potionIds.includes(job.kind as Potion)?POTIONS[job.kind as Potion].name+' ×'+job.quantity:itemName({id:'preview',kind:job.kind,tier:job.tier,enhancement:0});}
function desc(kind:string,tier:number,field:Field){if(kind in WEAPONS)return WEAPONS[kind as keyof typeof WEAPONS].description;if(kind in PASSIVES)return PASSIVES[kind as keyof typeof PASSIVES].description;if(field==='alchemy')return POTIONS[kind as Potion].description;if(kind==='armor')return 'HP +'+EQUIPMENT.armor.hp*tier+' · 방어 +'+EQUIPMENT.armor.defense*tier;return 'HP +'+EQUIPMENT.boots.hp*tier+' · 공속 +'+(EQUIPMENT.boots.speed*tier).toFixed(1);}

export function WorkshopScreen({game,setGame,now,onlineLease,onEnhancement,onMastery}:{game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;now:number;onlineLease?:GameplayLease|null;onEnhancement:()=>void;onMastery:()=>void}){
 const [field,setField]=useState<Field>('weapon'),[tier,setTier]=useState(1),[page,setPage]=useState(0),[cancelTarget,setCancelTarget]=useState<CraftJob|null>(null),[busy,setBusy]=useState(false);
 const goldenActive=isGoldenRecorderActive(game,now),golden=getGoldenRecorderBenefits(game,now),active=game.crafting.jobs.find(j=>j.status==='CRAFTING')??null,queued=game.crafting.jobs.filter(j=>j.status==='QUEUED').sort((a,b)=>a.queuedAt-b.queuedAt),completed=game.crafting.jobs.filter(j=>j.status==='COMPLETED_UNCLAIMED');
 const recipes=useMemo(()=>field==='weapon'?Object.keys(WEAPONS):field==='armor'?['armor','boots']:field==='accessory'?Object.keys(PASSIVES):potionIds.filter(p=>p!=='revival'&&POTIONS[p].tier===tier),[field,tier]),pages=Math.max(1,Math.ceil(recipes.length/PAGE_SIZE)),safe=Math.min(page,pages-1),shown=recipes.slice(safe*PAGE_SIZE,safe*PAGE_SIZE+PAGE_SIZE);
 const mastery=game.mastery[field],material=materialFor(field),materialName=TOWERS[material].material,totalDiscount=discount(mastery.crafts)+golden.craftingMaterialReductionBonus,queueFull=goldenActive&&queued.length>=GOLDEN_RECORDER_CRAFT_QUEUE_LIMIT;
 const progress=active&&active.startedAt!==null&&active.completesAt!==null?clamp((now-active.startedAt)/Math.max(1,active.durationMs),0,1):0;
 const startRecipe=async(kind:string)=>{
  const quantity=field==='alchemy'?POTION_CRAFTING.generalBatch:1,at=Date.now(),next=startCraft(game,kind,tier,quantity,at);
  const created=next.crafting.jobs.find(job=>!game.crafting.jobs.some(old=>old.jobId===job.jobId));
  if(!created||!onlineLease){setGame(next);return;}
  setBusy(true);
  try{
   const result=await startOnlineCraft(onlineLease,{jobId:created.jobId,kind,tier,quantity});
   const authoritativeJob=next.crafting.jobs.find(job=>job.jobId===created.jobId);
   if(authoritativeJob){authoritativeJob.consumedMaterials=result.materialCost;if(authoritativeJob.status==='CRAFTING'){authoritativeJob.completesAt=result.readyAt;authoritativeJob.startedAt=result.readyAt-authoritativeJob.durationMs;}}
   setGame(applyServerEconomyRecord(next,result.record));
  }catch(error){setGame({...game,notice:error instanceof Error?error.message:'서버 제작을 시작하지 못했습니다.'});}
  finally{setBusy(false);}
 };
 const cancelJob=async(job:CraftJob)=>{
  const next=cancelCraft(game,job.jobId,Date.now());
  if(!onlineLease){setGame(next);setCancelTarget(null);return;}
  setBusy(true);
  try{const result=await cancelOnlineCraft(onlineLease,job.jobId);setGame(applyServerEconomyRecord(next,result.record));setCancelTarget(null);}
  catch(error){setGame({...game,notice:error instanceof Error?error.message:'서버 제작 취소에 실패했습니다.'});}
  finally{setBusy(false);}
 };
 const claimJob=async(job:CraftJob)=>{
  const itemId=potionIds.includes(job.kind as Potion)?null:'item-'+game.nextId;
  const next=claimCraft(game,job.jobId,Date.now());
  if(!onlineLease){setGame(next);return;}
  setBusy(true);
  try{const result=await claimOnlineCraft(onlineLease,job.jobId,itemId);setGame(applyServerEconomyRecord(next,result.record));}
  catch(error){setGame({...game,notice:error instanceof Error?error.message:'서버 제작품 수령에 실패했습니다.'});}
  finally{setBusy(false);}
 };
 const claimAll=async()=>{
  if(!onlineLease){setGame(s=>claimAllCraft(s,Date.now()));return;}
  setBusy(true);let current=game;
  try{
   for(const original of completed){
    const job=current.crafting.jobs.find(j=>j.jobId===original.jobId);if(!job)continue;
    const itemId=potionIds.includes(job.kind as Potion)?null:'item-'+current.nextId;
    const result=await claimOnlineCraft(onlineLease,job.jobId,itemId);
    current=applyServerEconomyRecord(claimCraft(current,job.jobId,Date.now()),result.record);
   }
   setGame(current);
  }catch(error){setGame({...current,notice:error instanceof Error?error.message:'일부 제작품을 수령하지 못했습니다.'});}
  finally{setBusy(false);}
 };
 return <Screen eyebrow="ASSOCIATION WORKSHOP" title="공방" meta={<><button className="tc-action secondary slim" onClick={onEnhancement}>강화</button><button className="tc-action secondary slim" onClick={onMastery}>숙련</button></>}>
  <div className="tc-workshop">
   <div className="tc-work-status">{completed.length?<><div><strong>완료품 {completed.length}개</strong><small>{completed.slice(0,2).map(label).join(' · ')}</small></div><button className="tc-action slim" disabled={busy} onClick={()=>void claimAll()}>{busy?'처리 중':'모두 수령'}</button></>:active?<><div><strong>{label(active)}</strong><small>{FIELDS[active.field]} · {materialName} {active.consumedMaterials}개</small><Meter value={progress} max={1}/></div><b>{left((active.completesAt??now)-now)}</b></>:<><div><strong>작업대 대기</strong><small>제작할 품목을 선택하세요.</small></div><Glyph name="craft"/></>}</div>
   <div className="tc-work-ready">{completed.length>0&&<span>개별 수령: {completed.slice(0,2).map(job=><button key={job.jobId} disabled={busy} onClick={()=>void claimJob(job)}>{label(job)}</button>)}</span>}{active&&<button className="tc-action secondary slim" onClick={()=>setCancelTarget(active)}>현재 제작 취소</button>}</div>
   <div className="tc-work-queue">{queued.slice(0,3).map((job,i)=><button key={job.jobId} onClick={()=>setCancelTarget(job)}>{i+1}. {label(job)}<br/><small>대기 · 취소</small></button>)}{goldenActive&&queued.length<3&&Array.from({length:3-queued.length},(_,i)=><button disabled key={'q'+i}>대기 슬롯</button>)}</div>
   <div>
    <Segments items={fields} value={field} onChange={v=>{setField(v);setTier(1);setPage(0);}} label="제작 분야"/>
    <div className="tc-segments">{[1,2,3,4,5].map(t=><button key={t} aria-selected={tier===t} disabled={t>mastery.unlocked} onClick={()=>{setTier(t);setPage(0);}}>T{t}</button>)}</div>
    <div className="tc-work-grid">{shown.map(kind=>{const amount=cost(game,field,tier,now),owned=game.materials[material][tier-1],potion=field==='alchemy',title=potion?POTIONS[kind as Potion].name+' ×'+POTION_CRAFTING.generalBatch:itemName({id:'preview',kind,tier,enhancement:0}),blocked=!!game.expedition||tier>mastery.unlocked||owned<amount||(!goldenActive&&!!active)||queueFull;return <article className="tc-recipe" key={kind}><Glyph name={potion?'potions':kind}/><div><h2>{title}</h2><p>{desc(kind,tier,field)}</p><small>{materialName} {owned} / {amount}</small></div><button disabled={blocked} onClick={()=>void startRecipe(kind)}>{active&&goldenActive?'대기열':'제작'}</button></article>;})}{Array.from({length:Math.max(0,PAGE_SIZE-shown.length)},(_,i)=><div className="tc-recipe" aria-hidden="true" key={'r'+i}/>)}</div>
   </div>
   <div><Pager page={safe} count={pages} onChange={setPage}/><div className="tc-work-foot"><div><small>재료</small><b>{materialName} {game.materials[material][tier-1]}</b></div><div><small>숙련</small><b>{mastery.unlocked<5?mastery.progress+' / '+CONFIG.masteryRequired:'MAX'}</b></div><div><small>절감</small><b>{Math.round(totalDiscount*100)}%</b></div></div></div>
  </div>
  {cancelTarget&&<div className="tc-modalback" onClick={()=>setCancelTarget(null)}><section className="tc-modal" onClick={e=>e.stopPropagation()}><h2>제작 취소</h2><p><b>{label(cancelTarget)}</b><br/>{TOWERS[materialFor(cancelTarget.field)].material} ×{cancelTarget.consumedMaterials} 반환</p><div className="tc-modal-actions"><button className="tc-action secondary" onClick={()=>setCancelTarget(null)}>계속 제작</button><button className="tc-action danger" disabled={busy} onClick={()=>void cancelJob(cancelTarget)}>{busy?'처리 중':'제작 취소'}</button></div></section></div>}
 </Screen>;
}
