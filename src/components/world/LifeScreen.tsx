import React from 'react';
import {LIFE_MATERIAL_NAMES,lifeBatchLimit,type VillageLifeState,type LifeResource,type LifeMaterial} from '../../online/villageLife';
import {townKindLabel} from './worldMap';
import {assetUrl} from '../../game/data/graphics';
import {CraftItemArt} from './CraftItemArt';
import './gather-screen.css';
type Props={state:VillageLifeState;busy:boolean;count:number;now:number;message?:string;onCount:(n:number)=>void;onGather:(r:LifeResource)=>void;onBack:()=>void;onRefresh:()=>void;onWell?:()=>void;onInventory?:()=>void};
export function LifeScreen({state,busy,count,now,message,onCount,onGather,onBack,onRefresh,onWell,onInventory}:Props){
 const [selectedResource,setSelectedResource]=React.useState<LifeResource>('herb');
 const town=state.towns.find(t=>t.id===state.location)!;
 const resources:LifeResource[]=town.kind==='city'?['herb','farm']:[town.kind];
 const resource=resources.includes(selectedResource)?selectedResource:resources[0];
 const herb=resource==='herb',stock=herb?town.herbRemaining:town.farmRemaining,capacity=herb?town.herbCapacity:town.farmCapacity,limit=lifeBatchLimit(state,resource);
 const validCount=Number.isInteger(count)&&count>=1&&count<=100;
 const wellSeconds=Math.max(0,Math.ceil(((state.wellReadyAt??0)-now)/1000));
 const remaining=Math.max(0,Math.ceil((state.nextResetAt-now)/1000)),reset=`${Math.floor(remaining/3600)}시간 ${Math.floor(remaining%3600/60)}분`;
 const owner=town.owner==='중립'?'중립':town.owner+' 원정단';
 const unavailable=!validCount?'생활 횟수는 1~100 사이여야 합니다.':state.actionPoints<count?'생활 행동력이 부족합니다.':count>limit?'마을의 남은 생산량이 부족합니다.':'';
 return <section className="tc-life tc-gather-location" aria-label="마을 생활" aria-busy={busy}>
  <header className="tc-life-header">
   <div className="tc-gather-town"><small>{townKindLabel(town.kind)}</small><h1>{town.name}</h1></div>
   <div className="tc-gather-ap"><small>생활 행동력</small><b>{state.actionPoints}<span> / 100</span></b><div role="progressbar" aria-label="생활 행동력" aria-valuenow={state.actionPoints} aria-valuemin={0} aria-valuemax={100}><i style={{width:Math.max(0,Math.min(100,state.actionPoints))+'%'}}/></div></div>
   <div className="tc-life-navigation">{onInventory&&<button type="button" className="tc-feel-press" onClick={onInventory}>가방</button>}<button type="button" className="tc-feel-press" onClick={onBack}>지도</button></div>
  </header>
  <div className="tc-gather-scene" data-gather-scene={resource}>
   <img src={assetUrl(`assets/backgrounds/gathering/${resource}.webp`)} alt="" aria-hidden="true" draggable={false} width={1536} height={1024}/>
   <div className="tc-gather-scene-title"><small>{herb?'약초 채집':'농사'}</small><h2>{town.name} {herb?'약초밭':'농장'}</h2><p>{herb?'안개 아래 자란 잎을 거두는 곳':'고요한 들녘에서 오늘의 수확을'}</p></div>
   <div className="tc-gather-owner">소유 <b>{owner}</b></div>
   <div className="tc-life-resource" aria-label="채집 종류">{resources.map(r=><button type="button" className="tc-feel-press" key={r} aria-pressed={resource===r} disabled={busy} onClick={()=>setSelectedResource(r)}><CraftItemArt id={r==='herb'?'herb':'wheat'}/><span>{r==='herb'?'약초 채집':'농사'}</span></button>)}</div>
  </div>
  <section className="tc-life-gather" aria-label="선택한 채집 자원">
   <div className="tc-gather-resource-art"><CraftItemArt id={herb?'herb':'wheat'}/></div>
   <div className="tc-gather-resource-info"><h2>{herb?'약초':'농산물'}</h2><span>{herb?`보유 ${(state.materials.herb??0).toLocaleString()}개`:'고추 · 감자 · 밀'}</span><div className="tc-gather-stock-label"><small>남은 채집량</small><b>{stock.toLocaleString()} <span>/ {capacity.toLocaleString()}</span></b></div><div className="tc-gather-stock" role="progressbar" aria-label={`${herb?'약초':'농산물'} 잔여량`} aria-valuenow={stock} aria-valuemin={0} aria-valuemax={capacity}><i style={{width:Math.max(0,Math.min(100,stock/Math.max(1,capacity)*100))+'%'}}/></div></div>
   <div className="tc-gather-yield"><small>1회 생산</small><b>10<span>개</span></b><small>행동력 1</small></div>
  </section>
  <section className="tc-life-inventory" aria-label="생활 재료 보유량">{(['herb','pepper','potato','wheat'] as LifeMaterial[]).map(id=><div key={id}><CraftItemArt id={id}/><div><small>{LIFE_MATERIAL_NAMES[id]}</small><b>{(state.materials[id]??0).toLocaleString()}</b></div></div>)}</section>
  <section className="tc-life-quantity"><div className="tc-gather-quantity-label"><label htmlFor="life-count">생활 횟수</label><small>현재 최대 {limit}회 가능</small></div><div role="group" aria-label="채집 횟수">{[1,10,100].map(n=><button type="button" className="tc-feel-press" key={n} aria-pressed={count===n} disabled={busy} onClick={()=>onCount(n)}>{n}회</button>)}<input id="life-count" aria-label="생활 횟수 직접 입력" type="number" min="1" max="100" step="1" value={count} disabled={busy} onChange={e=>onCount(Math.max(1,Math.min(100,Math.trunc(Number(e.target.value)||1))))}/></div></section>
  <div className="tc-gather-action"><p>{herb?'약초':'고추·감자·밀 중 매회 랜덤 한 종류'} · 총 {count*10}개 생산</p><button type="button" className="tc-action tc-feel-press tc-gather-main" disabled={busy||!validCount||count>limit} onClick={()=>onGather(resource)}><span>{busy?'채집 요청 확인 중…':`${herb?'채집하기':'농사하기'} ${count}회`}</span><small>행동력 {count}</small></button><p className="tc-gather-unavailable">{unavailable||'획득한 재료는 인벤토리에 저장됩니다.'}</p></div>
  <div className="tc-gather-result" role="status" aria-live="polite"><small>{busy?'요청 확인 중':'생활 결과'}</small><p>{message||(busy?'서버에서 생활 결과를 확인하고 있습니다.':'채집하면 획득한 재료가 여기에 표시됩니다.')}</p></div>
  <div className="tc-gather-policy"><span>생산물 세율 {town.tax}%</span><span title={`다음 초기화까지 ${reset}`}>매일 00:00 초기화</span></div>
  <footer><button type="button" className="tc-feel-press" disabled={busy||!onWell||wellSeconds>0} onClick={onWell}>우물 · {wellSeconds>0?`${wellSeconds}초`:'무료 HP 회복'}</button><button type="button" className="tc-feel-press" disabled={busy} onClick={onRefresh}>잔여량 새로고침</button></footer>
 </section>;
}
