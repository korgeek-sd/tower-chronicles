import React from 'react';
import {LIFE_MATERIAL_NAMES,lifeBatchLimit,type VillageLifeState,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {assetUrl} from '../../game/data/graphics';
import {CraftItemArt} from './CraftItemArt';
import {lifeMasteryLevel,LIFE_MASTERY_NAMES,LIFE_MASTERY_LEVEL_XP} from '../../game/life/crafting';
import './gather-screen.css';
type Props={state:VillageLifeState;busy:boolean;count:number;now:number;message?:string;onCount:(n:number)=>void;onGather:(r:LifeResource)=>void;onBack:()=>void;onRefresh:()=>void;onWell?:()=>void;onInventory?:()=>void};
export function LifeScreen({state,busy,count,now,message,onCount,onGather,onBack,onInventory}:Props){
 const [selectedResource,setSelectedResource]=React.useState<LifeResource>('herb');
 const town=state.towns.find(t=>t.id===state.location)!;
 const resources:LifeResource[]=town.kind==='city'?['herb','farm']:[town.kind];
 const resource=resources.includes(selectedResource)?selectedResource:resources[0];
 const herb=resource==='herb',name=herb?'약초':'농산물';
 const stock=herb?town.herbRemaining:town.farmRemaining,capacity=herb?town.herbCapacity:town.farmCapacity,limit=lifeBatchLimit(state,resource);
 const xp=state.lifeMasteries?.[resource]??0,level=lifeMasteryLevel(xp),nextXp=LIFE_MASTERY_LEVEL_XP[level]??null;
 const levelStart=LIFE_MASTERY_LEVEL_XP[level-1],levelSpan=nextXp===null?1:nextXp-levelStart,levelProgress=nextXp===null?1:Math.max(0,Math.min(levelSpan,xp-levelStart));
 const validCount=Number.isInteger(count)&&count>=1&&count<=100;
 const remaining=Math.max(0,Math.ceil((state.nextResetAt-now)/1000)),reset=`${Math.floor(remaining/3600)}시간 ${Math.floor(remaining%3600/60)}분`;
 const owner=town.owner==='중립'?'중립':town.owner+' 길드';
 const unavailable=!validCount?'생활 횟수는 1~100 사이여야 합니다.':state.actionPoints<count?'생활 행동력이 부족합니다.':count>limit?'마을의 남은 생산량이 부족합니다.':'';
 const materials:LifeMaterial[]=herb?['herb']:['pepper','potato','wheat'];
 return <section className="tc-life tc-gather-location" aria-label="마을 생활" aria-busy={busy}>
  <header className="tc-life-header">
   <button type="button" className="tc-gather-back tc-feel-press" onClick={onBack} aria-label="마을 지도로 돌아가기">‹ 지도</button>
   <h1>{town.name}<span> · 생산</span></h1>
   <div className="tc-gather-ap"><small>생활 행동력</small><b>{state.actionPoints}<span> / 100</span></b><div role="progressbar" aria-label="생활 행동력" aria-valuenow={state.actionPoints} aria-valuemin={0} aria-valuemax={100}><i style={{width:Math.max(0,Math.min(100,state.actionPoints))+'%'}}/></div></div>
  </header>
  <div className="tc-gather-scene" data-gather-scene={resource}>
   <img src={assetUrl(`assets/backgrounds/gathering/${resource}.webp`)} alt="" aria-hidden="true" draggable={false} width={1536} height={1024}/>
   <div className="tc-gather-scene-title"><h2>{town.name} {herb?'약초밭':'농장'}</h2></div>
   <small className="tc-gather-owner" title={owner}>점령 · {owner}</small>
  </div>
  {resources.length>1&&<div className="tc-life-resource" aria-label="채집 종류">{resources.map(r=><button type="button" className="tc-feel-press" key={r} aria-pressed={resource===r} disabled={busy} onClick={()=>setSelectedResource(r)}><CraftItemArt id={r==='herb'?'herb':'wheat'}/><span>{r==='herb'?'약초 채집':'농사'}</span></button>)}</div>}
  <section className="tc-life-gather" aria-label="선택한 채집 자원">
   <div className="tc-gather-mastery">
    <CraftItemArt id={herb?'herb':'wheat'}/><b>{herb?'약초':'농업'} Lv.{level}</b>
    <div className="tc-gather-meter" role="progressbar" aria-label={`${LIFE_MASTERY_NAMES[resource]} 경험치`} aria-valuenow={levelProgress} aria-valuemin={0} aria-valuemax={levelSpan} aria-valuetext={nextXp===null?'최고 레벨':`다음 레벨까지 ${levelProgress} / ${levelSpan}`}><i style={{width:(levelProgress/levelSpan*100)+'%'}}/></div>
    <small>{nextXp===null?'MAX':`${levelProgress.toLocaleString()} / ${levelSpan.toLocaleString()}`}</small>
   </div>
   <div className="tc-gather-stock-row"><span>남은 생산량</span><b>{stock.toLocaleString()} <small>/ {capacity.toLocaleString()}</small></b><div className="tc-gather-meter tc-gather-stock" role="progressbar" aria-label={`${name} 잔여량`} aria-valuenow={stock} aria-valuemin={0} aria-valuemax={capacity}><i style={{width:Math.max(0,Math.min(100,stock/Math.max(1,capacity)*100))+'%'}}/></div></div>
   <div className={'tc-gather-owned'+(herb?' single':'')+(onInventory?' with-bag':'')} aria-label="생활 재료 보유량">{materials.map(id=><div key={id}><CraftItemArt id={id}/><div><small>보유 {LIFE_MATERIAL_NAMES[id]}</small><b>{(state.materials[id]??0).toLocaleString()}</b></div></div>)}{onInventory&&<button type="button" className="tc-gather-bag tc-feel-press" onClick={onInventory}>가방</button>}</div>
  </section>
  <div className="tc-gather-controls">
   <section className="tc-life-quantity"><div className="tc-gather-quantity-label"><label htmlFor="life-count">생산 횟수</label><small>현재 최대 {limit}회 가능</small></div><div role="group" aria-label="채집 횟수">{[1,10,limit].map((n,index)=><button type="button" className="tc-feel-press" key={index} aria-pressed={count===n&&(index<2||n!==1&&n!==10)} disabled={busy||n<1||n>limit} onClick={()=>onCount(n)}>{index===2?'최대':`${n}회`}</button>)}<input id="life-count" aria-label="생활 횟수 직접 입력" type="number" inputMode="numeric" min="1" max="100" step="1" value={count} disabled={busy} onChange={e=>onCount(Math.max(1,Math.min(100,Math.trunc(Number(e.target.value)||1))))}/></div></section>
   <div className="tc-gather-feedback"><p className="tc-gather-preview">{validCount?`${name} 생산 ${(count*10).toLocaleString()}개 · 행동력 ${count}${town.tax>0?' · 세전':''}`:'생산 횟수를 확인해 주세요.'}</p><div className="tc-gather-result" role="status" aria-live="polite">{busy?'채집 요청 확인 중…':message||(herb?'1회 생산 10개 · 행동력 1':'고추·감자·밀 중 매회 랜덤 한 종류')}</div></div>
   <button type="button" className="tc-action tc-feel-press tc-gather-main" disabled={busy||!validCount||count>limit} onClick={()=>{if(!busy&&validCount&&count<=limit)onGather(resource);}}><CraftItemArt id={herb?'herb':'wheat'}/><span>{busy?'채집 요청 확인 중…':herb?'약초 채집하기':'농사하기'}</span></button>
   {unavailable&&<p className="tc-gather-unavailable">{unavailable}</p>}
   <div className="tc-gather-policy"><span>세율 {town.tax}%</span><span title={`다음 초기화까지 ${reset}`}>매일 24:00 초기화 · 한국시간</span></div>
  </div>
 </section>;
}
