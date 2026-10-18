import React,{useEffect,useRef,useState} from 'react';
import type {GameState} from '../../game/types';
import type {GameplayLease} from '../../online/gameSession';
import {getHuntingState,saveHuntingSkillSets} from '../../online/hunting';
import {initialHuntingState,HUNT_SKILLS,type HuntingState} from '../../game/hunting/model';
import {catalogSkill,validSkillForWeapon,validateCombatPreset,weaponForHunt} from '../../game/hunting/catalogCombat';
import {CONDITION_OPTIONS,conditionsLabel,needsConditionValue,validSkillConditions,readSkillSets,emptySkillSet,type HuntingSkillSet,type SkillSetup,type SkillCondition} from '../../game/hunting/skillConditions';
import {SKILL_TREE_CATALOG} from '../../game/skills/catalog';
import {GameSelect} from '../../ui/GameSelect';
import {Glyph} from '../../ui/mobile';
import './skill-setup.css';
const GUEST_KEY='tower-instant-hunting-guest-v1';
type Props={game:GameState;lease:GameplayLease|null;userId:string|null;onClose:()=>void;onSaved?:(state:HuntingState)=>void};
export function SkillSetupEditor({game,lease,userId,onClose,onSaved}:Props){
 const [setup,setSetup]=useState<SkillSetup>({slots:Array(6).fill(null),conditions:{}}),[passives,setPassives]=useState<(string|null)[]>(Array(3).fill(null));
 const [premium,setPremium]=useState(false);
 const [sets,setSets]=useState<HuntingSkillSet[]>(()=>Array.from({length:3},emptySkillSet)),[setIndex,setSetIndex]=useState(0),[appliedIndex,setAppliedIndex]=useState(0);
 const [tab,setTab]=useState<'active'|'passive'>('active'),[selected,setSelected]=useState(0),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const panel=useRef<HTMLElement>(null),lock=useRef(false),alive=useRef(true),returnFocus=useRef<HTMLElement|null>(null);
 const weapon=weaponForHunt(game.equipmentItems.find(x=>x.id===game.equipped.weapon)?.kind);
 const catalog=SKILL_TREE_CATALOG.filter(s=>game.learned.includes(s.id)&&validSkillForWeapon(s,weapon));
 const available=tab==='active'?[...HUNT_SKILLS.map(s=>({...s,mp:0,effect:s.description,icon:'skills'})),...catalog.filter(s=>s.type==='active')]:catalog.filter(s=>s.type==='passive');
 const slots=tab==='active'?setup.slots:passives,id=slots[selected],skill=available.find(s=>s.id===id),conditions=id?setup.conditions[id]??[]:[];
 useEffect(()=>{
  alive.current=true;returnFocus.current=document.activeElement as HTMLElement;panel.current?.focus();
  async function load(){try{
   let state:HuntingState;if(userId){if(!lease)throw Error('플레이 권한을 확인하고 있습니다. 잠시 후 다시 열어주세요.');state=await getHuntingState(lease);}
   else {try{state=JSON.parse(localStorage.getItem(GUEST_KEY)??'null')??initialHuntingState();}catch{state=initialHuntingState();}}
   if(!alive.current)return;
   setPremium(!!(state as HuntingState&{premiumActive?:boolean}).premiumActive);
   const bank=readSkillSets(state),index=Number.isInteger(state.activeSkillSet)&&state.activeSkillSet!>=0&&state.activeSkillSet!<3?state.activeSkillSet!:0;
   setSets(bank);setSetIndex(index);setAppliedIndex(index);loadSet(bank[index]);setReady(true);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'세팅을 불러오지 못했습니다.');}}
  void load();return()=>{alive.current=false;returnFocus.current?.focus();};
 },[userId,lease?.leaseId,lease?.generation]);
 function loadSet(value:HuntingSkillSet){setSetup(value.setup);const passive=value.skills.filter(x=>catalogSkill(x)?.type==='passive');setPassives(Array.from({length:3},(_,i)=>passive[i]??null));setSelected(0);}
 function draftSet():HuntingSkillSet{return {skills:[...setup.slots,...passives].filter((x):x is string=>!!x),setup:{...setup,conditions:Object.fromEntries(Object.entries(setup.conditions).filter(([key])=>setup.slots.includes(key)).map(([key,value])=>[key,value.slice(0,1)]))}};}
 function selectSet(index:number){if(index>0&&!premium){onClose();window.dispatchEvent(new Event('tc-open-premium'));return;}if(index===setIndex||!ready||busy)return;setSets(previous=>previous.map((s,i)=>i===setIndex?draftSet():s));loadSet(sets[index]);setSetIndex(index);setError('');}
 function changeSkill(value:string){if(tab==='active')setSetup(s=>({...s,slots:s.slots.map((x,i)=>i===selected?value||null:x)}));else setPassives(s=>s.map((x,i)=>i===selected?value||null:x));}
 function changeConditions(next:SkillCondition[]){if(id)setSetup(s=>({...s,conditions:{...s.conditions,[id]:next}}));}
 function move(direction:number){const dest=selected+direction;if(dest<0||dest>=slots.length)return;const next=[...slots];[next[selected],next[dest]]=[next[dest],next[selected]];if(tab==='active')setSetup(s=>({...s,slots:next}));else setPassives(next);setSelected(dest);}
 async function save(){
  if(lock.current||!ready||game.expedition||userId&&!lease)return;
  const bank=sets.map((s,i)=>i===setIndex?draftSet():s);
  if(bank.some((set,i)=>{const ownWeapon=i===setIndex?weapon:set.skills.map(id=>catalogSkill(id)?.weapon).find(w=>w&&w!=='any')??weapon;return !validateCombatPreset(set.skills,game.learned,ownWeapon)||Object.values(set.setup.conditions).some(c=>!validSkillConditions(c));})){setError('스킬 중복·습득·무기와 조건 수치를 확인해 주세요.');return;}
  lock.current=true;setBusy(true);setError('');
  try{
   let state:HuntingState;if(userId&&lease)state=await saveHuntingSkillSets(lease,bank,setIndex);
   else {const previous=JSON.parse(localStorage.getItem(GUEST_KEY)??'null')??initialHuntingState();state={...previous,skills:bank[setIndex].skills,skillSetup:bank[setIndex].setup,skillSets:bank,activeSkillSet:setIndex};localStorage.setItem(GUEST_KEY,JSON.stringify(state));}
   if(alive.current){onSaved?.(state);onClose();}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'저장하지 못했습니다. 다시 시도해 주세요.');}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="tc-skill-setup-backdrop"><section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tc-skill-setup-title" className="tc-skill-setup" onKeyDown={e=>{
  if(e.key==='Escape'&&!busy&&!panel.current?.querySelector('.tc-game-select.is-open')){e.stopPropagation();onClose();}if(e.key==='Tab'){const all=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]');if(all?.length){const first=all[0],last=all[all.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 }}>
  <header><div><small>COMBAT SETUP</small><h2 id="tc-skill-setup-title">스킬 구성</h2></div><button aria-label="스킬 구성 닫기" disabled={busy} onClick={onClose}>×</button></header>
  <div className="tc-skill-set-tabs" role="group" aria-label="스킬셋 선택">{[0,1,2].map(i=><button key={i} disabled={!ready||busy} aria-pressed={setIndex===i} onClick={()=>selectSet(i)}>스킬셋 {i+1}{i>0&&!premium&&<small>프리미엄</small>}{appliedIndex===i&&<small>사용 중</small>}</button>)}</div>
  <div className="tc-skill-setup-tabs" role="group" aria-label="스킬 종류">{(['active','passive'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setSelected(0);}}>{t==='active'?'액티브 · 6':'패시브 · 3'}</button>)}</div>
  <div className="tc-skill-setup-slots" role="group" aria-label={tab==='active'?'액티브 순환 슬롯':'패시브 슬롯'}>{slots.map((x,i)=>{const s=catalogSkill(x??'')??HUNT_SKILLS.find(s=>s.id===x);return <button key={i} disabled={!ready||busy} aria-pressed={selected===i} onClick={()=>setSelected(i)} aria-label={(i+1)+'번 '+(s?.name??'빈 슬롯')+' · '+(tab==='active'?conditionsLabel(x?setup.conditions[x]:[]):'상시 효과')}><b>{i+1}</b><Glyph name="skills"/><span><strong>{s?.name??'빈 슬롯'}</strong><small>{x?(tab==='active'?conditionsLabel(setup.conditions[x]):'상시 효과'):'스킬을 선택해 주세요'}</small></span><i aria-hidden="true">›</i></button>;})}</div>
  <section className="tc-skill-setup-detail" aria-label="선택 슬롯 상세 편집"><div className="tc-skill-setup-detail-heading"><b>{selected+1}번 슬롯 편집</b><div><button aria-label="슬롯 위로 이동" disabled={selected===0||busy||!ready} onClick={()=>move(-1)}>↑</button><button aria-label="슬롯 아래로 이동" disabled={selected===slots.length-1||busy||!ready} onClick={()=>move(1)}>↓</button></div></div>
   <label className="tc-skill-setup-skill"><span>스킬</span><GameSelect aria-label="슬롯 스킬 선택" disabled={!ready||busy} value={id??''} onChange={e=>changeSkill(e.target.value)}><option value="">비워두기</option>{available.filter(s=>s.id===id||![...setup.slots,...passives].includes(s.id)).map(s=><option key={s.id} value={s.id}>{s.name}{tab==='active'?' · MP '+s.mp:''}</option>)}{id&&!skill&&<option value={id}>{catalogSkill(id)?.name??id} · 현재 무기 사용 불가</option>}</GameSelect></label>
   {tab==='active'&&id&&<div className="tc-skill-setup-conditions">{(conditions.length?conditions:[{kind:'always'} as SkillCondition]).map((c,i)=><div className="tc-skill-setup-condition" key={i}><span>조건</span><GameSelect aria-label={'발동 조건 '+(i+1)} disabled={busy} value={c.kind} onChange={e=>{const next=conditions.length?[...conditions]:[{kind:'always'} as SkillCondition];next[i]={kind:e.target.value as SkillCondition['kind'],value:e.target.value.includes('pct')?50:1};changeConditions(next);}}>{CONDITION_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</GameSelect>{needsConditionValue(c.kind)&&<input aria-label={'조건 수치 '+(i+1)} type="number" inputMode="numeric" min={c.kind.startsWith('turn_')?1:0} max={c.kind.includes('_pct_')?100:999999} value={c.value??1} disabled={busy} onChange={e=>changeConditions(conditions.map((x,j)=>i===j?{...x,value:Number(e.target.value)}:x))}/>}<button aria-label={'조건 '+(i+1)+' 삭제'} disabled={busy} onClick={()=>changeConditions(conditions.filter((_,j)=>j!==i))}>×</button></div>)}</div>}
   {tab==='passive'&&<p>{skill?.effect??'습득한 패시브를 선택하면 전투 내내 적용됩니다.'}</p>}
  </section>
  <footer><p role={error?'alert':'status'}>{error||(!ready?'세팅 불러오는 중…':game.expedition?'원정 중에는 변경할 수 없습니다.':'1 → 6 순환 · 사용 불가 시 다음 슬롯 확인')}</p><button className="tc-feel-press" data-game-feel="press" disabled={!ready||busy||!!game.expedition||!!userId&&!lease} onClick={()=>void save()}>{busy?'저장 중…':'3개 저장 · 스킬셋 '+(setIndex+1)+' 사용'}</button></footer>
 </section></div>;
}
