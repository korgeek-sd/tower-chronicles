import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import {HUNT_SKILLS,HUNT_MAPS,initialHuntingState,resolveHunt,type HuntingState,type HuntMapId} from '../../game/hunting/model';
import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
import {validSkillForWeapon,validateCombatPreset,weaponForHunt,HUNT_ACTIVE_SLOTS,HUNT_PASSIVE_SLOTS,catalogSkill} from '../../game/hunting/catalogCombat';
import {stats} from '../../game/engine/state';
import {getHuntingState,huntOnce,saveHuntingPreset} from '../../online/hunting';
import type {GameplayLease} from '../../online/gameSession';
import type {CloudSaveRecord} from '../../online/cloudSave';
import {HuntingScreen} from './HuntingScreen';
import './hunting.css';
import './iron-regions.css';
const GUEST_KEY='tower-instant-hunting-guest-v1';
function loadGuest():HuntingState {try{const raw=localStorage.getItem(GUEST_KEY);if(raw){const s=JSON.parse(raw);if(Number.isInteger(s.vitality)&&s.vitality>=0&&s.vitality<=100&&Number.isFinite(s.recoveredAt)&&Number.isFinite(s.experience)&&Number.isFinite(s.mastery)&&Array.isArray(s.skills))return s;}}catch{}return initialHuntingState();}
type Props={game:GameState;setGame:React.Dispatch<React.SetStateAction<GameState>>;now:number;lease:GameplayLease|null;userId:string|null;nickname?:string;onPrepare:()=>Promise<void>;onPending:(pending:boolean)=>void;onRecord:(record:CloudSaveRecord)=>void};
export function HuntingPage({game,setGame,now,lease,userId,nickname,onPrepare,onPending,onRecord}:Props){
 const [state,setState]=useState<HuntingState|null>(userId?null:loadGuest),[busy,setBusy]=useState(false),[error,setError]=useState(''),[settings,setSettings]=useState(false),[draft,setDraft]=useState<string[]>([]),[offset,setOffset]=useState(0);
 const lock=useRef(false),alive=useRef(true),pending=useRef<{id:string;map:HuntMapId}|null>(null);
 const pendingKey=userId?'tower-hunt-pending:'+userId:null;
 const equippedKind=game.equipmentItems.find(item=>item.id===game.equipped.weapon)?.kind;
 const weapon=weaponForHunt(equippedKind);
 const availableCatalog=SKILL_TREE_CATALOG.filter(s=>game.learned.includes(s.id)&&validSkillForWeapon(s,weapon));
 const availableActive=[...HUNT_SKILLS.map(x=>({id:x.id,name:x.name,mp:0,description:x.description})),...availableCatalog.filter(x=>x.type==='active')];
 const availablePassive=availableCatalog.filter(x=>x.type==='passive');
 const activeDraft=draft.filter(id=>!catalogSkill(id)||catalogSkill(id)?.type==='active');
 const passiveDraft=draft.filter(id=>catalogSkill(id)?.type==='passive');
 function changePresetSlot(type:'active'|'passive',index:number,value:string){
  setDraft(prev=>{
   const source=(type==='active'?prev.filter(id=>!catalogSkill(id)||catalogSkill(id)?.type==='active'):prev.filter(id=>catalogSkill(id)?.type==='passive')).slice();
   const others=(type==='active'?prev.filter(id=>catalogSkill(id)?.type==='passive'):prev.filter(id=>!catalogSkill(id)||catalogSkill(id)?.type==='active')).slice();
   while(source.length<=index)source.push('');
   source[index]=value;
   const ids=(type==='active'?[...source.filter(Boolean),...others]:[...others,...source.filter(Boolean)]);
   return ids.filter((id,i)=>ids.indexOf(id)===i);
  });
 }
 const accept=(s:HuntingState&{serverNow?:number})=>{setState(s);if(s.serverNow)setOffset(s.serverNow-Date.now());};
 async function refresh(){if(userId){if(!lease)return;try{const result=await getHuntingState(lease);if(alive.current){accept(result);if(!pending.current)setError('');}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'사냥 상태를 불러오지 못했습니다.');}}}
 useEffect(()=>{alive.current=true;void refresh();if(pendingKey)try{const raw=localStorage.getItem(pendingKey);if(raw){const p=JSON.parse(raw);if(typeof p.id==='string'&&HUNT_MAPS.some(m=>m.id===p.map)){pending.current=p;setError('이전 사냥 결과를 확인해야 합니다. 다시 확인을 눌러주세요.');}}}catch{}return()=>{alive.current=false;};},[userId,lease?.generation]);
 async function hunt(map:HuntMapId){
  if(lock.current||game.expedition||!state)return;
  if(userId&&!lease){setError('플레이 권한을 확인하고 있습니다.');return;}
  if(pending.current&&pending.current.map!==map){setError('이전 사냥 결과부터 다시 확인해 주세요.');return;}
  lock.current=true;setBusy(true);setError('');
  try{
   if(userId&&lease){
    await onPrepare();if(!alive.current)return;onPending(true);
    if(!pending.current){pending.current={id:crypto.randomUUID(),map};if(pendingKey)localStorage.setItem(pendingKey,JSON.stringify(pending.current));}
    const response=await huntOnce(lease,map,pending.current.id);
    if(!alive.current)return;onRecord(response.record);if(alive.current){accept({...response.state,serverNow:response.serverNow});setSettings(false);}
    pending.current=null;if(pendingKey)localStorage.removeItem(pendingKey);
   }else{
    const resolved=resolveHunt(state,map,stats(game),state.skills,now,Math.random,game.skillEnhancements??{},weapon);localStorage.setItem(GUEST_KEY,JSON.stringify(resolved.state));setState(resolved.state);
    setGame(current=>{const next=structuredClone(current),m=HUNT_MAPS.find(x=>x.id===map)!;if(resolved.result.equipment)next.equipmentItems.push(resolved.result.equipment);next.silver+=resolved.result.silver;next.materials[m.tower][0]+=resolved.result.materialCount;return next;});
   }
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'사냥을 처리하지 못했습니다.');}
  finally{onPending(false);lock.current=false;if(alive.current)setBusy(false);}
 }
 async function savePreset(){if(lock.current||!state)return;if(!validateCombatPreset(draft,game.learned,weapon)){setError('최대 액티브 6개·패시브 3개, 배운 스킬과 장착 무기를 확인하세요.');return;}lock.current=true;setBusy(true);try{if(userId&&lease){const result=await saveHuntingPreset(lease,draft);if(!alive.current)return;accept(result);}else{const next={...state,skills:draft};localStorage.setItem(GUEST_KEY,JSON.stringify(next));setState(next);}setSettings(false);setError('');}catch(e){setError(e instanceof Error?e.message:'세팅을 저장하지 못했습니다.');}finally{lock.current=false;setBusy(false);}}
 return <><HuntingScreen game={game} hunting={state} now={now+offset} busy={busy||!!userId&&!lease} nickname={nickname} error={error} onHunt={id=>void hunt(id)} onSettings={()=>{setDraft(state?.skills??[]);setSettings(v=>!v);}} onRetry={()=>{if(pending.current&&state)void hunt(pending.current.map);else void refresh();}}/>

 {settings&&<section className="tc-hunt-preset tc-hunt-panel" aria-label="전투 세팅">
  <h2>자동전투 스킬 세팅</h2>
  <p>배운 스킬만 장착할 수 있습니다. 위쪽부터 사용 가능한 스킬을 자동 발동합니다. 전투 시작 시 MP 완충 · MP 포션 없음.</p>
  <h3>액티브 스킬 · 최대 {HUNT_ACTIVE_SLOTS}개</h3>
  {Array.from({length:HUNT_ACTIVE_SLOTS},(_,i)=><label key={'active'+i}><b>{i+1}번</b><select aria-label={'액티브 슬롯 '+(i+1)} disabled={busy} value={activeDraft[i]??''} onChange={e=>changePresetSlot('active',i,e.target.value)}><option value="">비워두기</option>{availableActive.filter(s=>s.id===(activeDraft[i]??'')||!draft.includes(s.id)).map(skill=><option key={skill.id} value={skill.id}>{skill.name} · MP {skill.mp}</option>)}</select></label>)}
  <h3>패시브 스킬 · 최대 {HUNT_PASSIVE_SLOTS}개</h3>
  {Array.from({length:HUNT_PASSIVE_SLOTS},(_,i)=><label key={'passive'+i}><b>{i+1}번</b><select aria-label={'패시브 슬롯 '+(i+1)} disabled={busy} value={passiveDraft[i]??''} onChange={e=>changePresetSlot('passive',i,e.target.value)}><option value="">비워두기</option>{availablePassive.filter(s=>s.id===(passiveDraft[i]??'')||!draft.includes(s.id)).map(skill=><option key={skill.id} value={skill.id}>{skill.name} · 상시 효과</option>)}</select></label>)}
  <p>미습득·무기 불일치 스킬은 표시되지 않으며, MP가 부족한 스킬은 자동으로 건너뜁니다.</p>
  <footer><button disabled={busy||!!userId&&!lease} onClick={()=>void savePreset()}>세팅 저장</button><button disabled={busy} onClick={()=>setSettings(false)}>닫기</button></footer>
 </section>}
 </>;
}
