import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EventScreen} from '../src/components/events/EventScreen';
import {BattleScreen} from '../src/components/battle/BattleScreen';
import {initialState} from '../src/game/engine/state';
import {enter} from '../src/game/engine/expedition';
import {initialEvents,openEvent,resolveEvent,continueEvent} from '../src/game/events/service';
import {DEV_EVENTS} from '../src/game/events/fixtures';
import {EVENT_ASSETS,PRODUCTION_EVENT_CATALOG} from '../src/game/events/catalog';
import {basicAttack} from '../src/game/engine/combat';
import '../src/style.css';import '../src/pixel-ui.css';import '../src/components/battle/battle.css';import '../src/components/battle/immersive.css';import '../src/components/events/events.css';
const query=new URLSearchParams(location.search),requested=query.get('event')??query.get('fixture'),production=PRODUCTION_EVENT_CATALOG.find(x=>x.id===requested),fixture=production??DEV_EVENTS.find(x=>x.id===requested)??DEV_EVENTS[3],mode=production?'production':'test';
const d=structuredClone(fixture);if(mode==='test'&&query.has('long')){d.title='버려진 광부의 가방과 무너진 지지대 아래에서 발견한 오래된 탐사 기록';d.description='희미한 불빛 사이로 남겨진 흔적을 발견했습니다. '.repeat(8);d.choices.push({id:'third',label:'더 살펴본 뒤 기록을 남기고 주변 흔적을 확인한다',description:'선택 조건을 확인하는 세 번째 행동입니다.',effects:[]},{id:'fourth',label:'네 번째 행동',effects:[],conditions:[{kind:'PLAYER_HP_BELOW',ratio:0}]});}if(mode==='test'&&query.has('noPreview'))delete d.rewardPreview;if(mode==='test'&&query.has('noArt'))delete d.imageAssetKey;if(mode==='test'&&query.has('brokenArt')){d.imageAssetKey='qa-broken';EVENT_ASSETS['qa-broken']='./assets/missing-qa.png';}if(mode==='test')DEV_EVENTS[DEV_EVENTS.findIndex(x=>x.id===d.id)]=d;
function seed(){const tower=d.towerIds?.[0]??'ore',floor=d.type==='BOSS'?10:1,s=initialState();s.tickets[tower][floor-1]=1;const n=enter(s,tower,floor);n.expedition!.events=initialEvents(mode);if(d.conditions?.some(condition=>condition.kind==='PLAYER_HP_BELOW'))n.expedition!.hp=1;n.expedition!.monster.currentHp=0;openEvent(n,d,()=>.1,d.type==='BOSS'?'mining_ogre':null);return n;}
function Qa(){const [s,set]=useState(seed);const e=s.expedition!;return <div className={'app '+(e.events.pendingEvent?'event-mode':'battle-mode')}><main>{e.events.pendingEvent?<EventScreen key={e.events.pendingEvent.instanceId+e.events.pendingEvent.state} game={s} definition={d} onHome={()=>{}} onChoice={(id,c)=>set(n=>resolveEvent(n,id,c))} onContinue={id=>set(n=>continueEvent(n,id,()=>.99))}/>:<BattleScreen game={s} onHome={()=>{}} onBasicAttack={()=>set(n=>basicAttack(n,()=>.99))} onSkill={()=>{}} onFlee={()=>{}}/>}<output id="qa-state" style={{display:'none'}}>{JSON.stringify(s)}</output></main><nav>{['거점','가방','거래소','조합','제작','장비'].map(x=><button key={x}>{x}</button>)}</nav></div>}
createRoot(document.getElementById('root')!).render(<Qa/>);
