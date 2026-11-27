import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {GuildEmblem} from '../components/association/GuildEmblem';
import '../game-fonts.css';
import './siege.css';
import {APPEARANCES} from '../game/data/cosmetics';
const W=11,H=14,root=document.getElementById('siege');
const img=(i)=>new URL((APPEARANCES[i%APPEARANCES.length].imagePath||APPEARANCES[0].imagePath),location.href).href;
const names=['기크','아르칸','설화','루시안','카인','테오','아벨','녹스','레온','카론','라그나','벨리온','세라','이든','렌','모르','바엘','리안','회색늑대','카엘'];
const roleNames=['전사','궁수','마법사'],roleIcon=['⚔','➶','⚕'];
const cells=[],gates=new Map(),nodes=new Map();
const id=(x,y)=>y*W+x,xy=k=>[k%W,Math.floor(k/W)],dist=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.abs(x-u)+Math.abs(y-v)};
const near=k=>{const[x,y]=xy(k);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<W&&b>=0&&b<H).map(([a,b])=>id(a,b))};
const throne=id(5,1),camp=id(5,13);
let units=[],me,goal=null,focus=null,mode='attack',path=[],running=true,ended=false,elapsed=0,hold=0,owner='',last=performance.now(),logs=[],kills=[0,0],lastUi=0,gateLog=false;
const layout=Array.from({length:W*H},(_,k)=>{const[x,y]=xy(k);if(k===throne)return'throne';if(y===3)return[2,5,8].includes(x)?'gate':'wall';if((x===0||x===10)&&y<4)return'wall';if(y<=2)return'stone';if(y===13)return'camp';if([id(1,5),id(9,5),id(0,8),id(10,8),id(3,10),id(7,10)].includes(k))return'rock';if([id(0,5),id(10,5),id(1,9),id(9,9),id(0,11),id(10,11)].includes(k))return'tree';return x===5||y===7?'road':'grass'});
root.innerHTML='<header class="sl-head"><div class="sl-top"><div><small>탑의 기록 · 전투 실험실</small><br><b>노바르 점령전</b></div><span class="sl-time" id="time">08:00</span></div><div class="sl-meter"><span class="sl-blue" id="blue"></span><span id="objective">성문 돌파</span><span class="sl-red" id="red"></span></div><div class="sl-score"><i id="balance"></i></div></header><section class="sl-panel sl-me"><button id="locate" aria-label="내 위치 찾기"><img id="myface" alt=""></button><div><div class="sl-me-name">기크 · 전사 <small>Lv. 52</small></div><div class="sl-hp"><i id="hp"></i></div><div class="sl-hp sl-mp"><i id="mp"></i></div></div><small id="myhp"></small></section><div class="sl-caption"><span>공격군 ● <span class="sl-blue">아군</span> / <span class="sl-red">적군</span></span><button id="detail" aria-pressed="false">간략 / 상세</button></div><div class="sl-viewport"><section class="sl-board" aria-label="점령전 격자 전장"><div class="sl-cells" id="cells"></div><div class="sl-units" id="units"></div><div class="sl-overlay" id="end" hidden><div><h2 id="endtitle"></h2><p id="enddesc"></p><button id="restart">다시 시작</button></div></div></section></div><section class="sl-panel" id="inspect"></section><section class="sl-status"><strong id="state">목적지를 터치하세요</strong><span id="target"></span></section><div class="sl-modes"><button data-mode="attack" class="active">공격 우선</button><button data-mode="move">이동 우선</button><button data-mode="hold">위치 방어</button></div><section class="sl-panel"><div class="sl-caption"><span>등록 스킬 · 자동 사용</span><span id="auto">AUTO</span></div><div class="sl-skills" id="skills"></div></section><div class="sl-actions"><button id="retreat">진영으로 후퇴</button><button id="pause">일시정지</button><button id="reset">초기화</button></div><section class="sl-panel sl-logs" id="logs"></section><p class="sl-help">빈 칸을 누르면 이동, 적을 누르면 집중 공격합니다. 아군을 누르면 정보를 확인합니다. 아군 칸 통과에는 1.5배 시간이 걸립니다. 스킬은 자동 발동합니다.</p><footer class="sl-footer"><span>로컬 시뮬레이션 · 실제 계정/서버 미연결</span><a href="./">게임으로 돌아가기</a></footer>';
const $=s=>document.getElementById(s),unitLayer=$('units');
for(let k=0;k<W*H;k++){const b=document.createElement('button');b.className='sl-cell '+layout[k];b.type='button';b.setAttribute('aria-label',layout[k]+' '+xy(k).join(','));if(layout[k]==='throne')b.textContent='♛';b.addEventListener('click',()=>choose(k));$('cells').append(b);cells.push(b);}
function note(t){logs.unshift(t);logs=logs.slice(0,3);$('logs').replaceChildren(...logs.map(s=>{const d=document.createElement('div');d.textContent=s;return d}))}
function alive(u){return u.hp>0}
const guilds = [
  {name:'은빛여명', emblem:{shape:'round',symbol:'moon',pattern:'band',border:'silver',base:'#2f4f80',accent:'#b5b8b1'}},
  {name:'붉은서약', emblem:{shape:'shield',symbol:'sword',pattern:'chevron',border:'gold',base:'#942f3c',accent:'#d7b878'}}
];
const unitEmblems = [];
function renderGuildEmblem(root, guild, size) {
  root.render(createElement(GuildEmblem, {value:guild.emblem, size, label:guild.name+' 원정단 문장'}));
}
const info = $('inspect');
info.style.display='flex';
info.style.alignItems='center';
info.style.gap='7px';
const infoMark=document.createElement('span'), infoText=document.createElement('span');
info.append(infoMark,infoText);
const infoRoot=createRoot(infoMark);
let infoTeam=null;
const skills = [['강타','방패 가격','방어 태세'],['조준 사격','속박 화살','연속 사격'],['화염구','서리 장판','보호막']];
const cooldowns = [[5,10,15],[7,10,6],[8,12,15]];
const power = [66,59,73], cadence = [2.2,2.7,3.1];
let inspectId = 0, detailed = false, frost = [], beams = [], playerRole = 0;
const occupied = new Map(), reserved = new Map();
const terrainBlocks = (k,u) => ['wall','rock','tree'].includes(layout[k]) || (u.team===0 && gates.get(k)>0);
const blocked = (k,u) => terrainBlocks(k,u) || (occupied.has(k) && occupied.get(k).team!==u.team) || (reserved.has(k) && reserved.get(k)!==u);
function routes(u,targets) {
  const ends=new Set(targets.filter(k=>!blocked(k,u) && (!occupied.has(k)||k===u.k)));
  if (!ends.size) return null;
  const queue=[u.k], costs=new Map([[u.k,0]]), prev=new Map();
  while(queue.length){
    let min=0;
    for(let i=1;i<queue.length;i++) if(costs.get(queue[i])<costs.get(queue[min])) min=i;
    const k=queue.splice(min,1)[0];
    if(ends.has(k)){
      const path=[];
      for(let p=k;p!==u.k;p=prev.get(p)) path.unshift(p);
      return path;
    }
    for(const n of near(k)){
      if(blocked(n,u)) continue;
      const cost=costs.get(k)+(occupied.has(n)?1.5:1)*(icy(n,u)?1.5:1);
      if(cost>=(costs.get(n)??Infinity)) continue;
      costs.set(n,cost);prev.set(n,k);if(!queue.includes(n))queue.push(n);
    }
  }
  return null;
}
const icy=(k,u)=>frost.some(z=>z.until>elapsed&&z.team!==u.team&&z.cells.includes(k));
function cancelTravel(u){
  if(u.trip)for(const k of u.trip.path) if(reserved.get(k)===u)reserved.delete(k);
  u.trip=null;
}
function travel(u,path){
  if(!path?.length||u.root>elapsed)return;
  const segment=[];
  for(const k of path){
    if(blocked(k,u))return;
    segment.push(k);
    if(!occupied.has(k))break;
  }
  if(occupied.has(segment.at(-1)))return;
  let duration=0;
  const times=segment.map(k=>duration+=1.44*(occupied.has(k)?1.5:1)*(icy(k,u)?1.5:1));
  u.trip={path:segment,times,start:elapsed};
  for(const k of segment)reserved.set(k,u);
}
function position(u){
  if(!u.trip)return xy(u.k);
  const {start,times,path}=u.trip, age=elapsed-start;
  let i=times.findIndex(t=>t>age);
  if(i<0)return xy(path.at(-1));
  const before=i?times[i-1]:0, f=(age-before)/(times[i]-before);
  const [x,y]=xy(i?path[i-1]:u.k),[a,b]=xy(path[i]);
  const side=path.length>1?.20*Math.sin(Math.PI*f):0;
  return [x+(a-x)*f+(b-y)*side,y+(b-y)*f-(a-x)*side];
}
function visible(u,v,range){
  if(dist(u.k,v.k)>range)return false;
  const [x,y]=xy(u.k),[a,b]=xy(v.k);
  const steps=Math.max(Math.abs(a-x),Math.abs(b-y));
  for(let i=1;i<steps;i++){
    const k=id(Math.round(x+(a-x)*i/steps),Math.round(y+(b-y)*i/steps));
    if(layout[k]==='wall'||gates.get(k)>0)return false;
  }
  return true;
}
function choose(k){
  if(ended||!alive(me))return;
  const v=units.find(v=>alive(v)&&id(...position(v).map(Math.round))===k)||occupied.get(k);
  if(v){inspectId=v.id;if(v.team===0){render();return}}
  cancelTravel(me);me.cast=null;
  if(v){focus=v.id;mode='attack';goal=v.k}
  else{focus=null;goal=k;if(mode==='hold')mode='move'}
  render();
}
function beam(u,v,kind='hit'){
  beams.push({from:position(u),to:position(v),kind,team:u.team,mine:u===me||v===me,until:elapsed+.48});
}
function ready(u,i){return u.cd[i]<=elapsed&&u.mp>=14}
function use(u,i){
  u.cd[i]=elapsed+cooldowns[u.role][i];u.mp-=14;
  if(u===me)note(skills[u.role][i]+' 발동');
}
function damage(u,v,n){
  if(!alive(v))return;
  let amount=Math.round(n*(v.guard>elapsed?.65:1));
  if(v.shieldUntil>elapsed){const absorbed=Math.min(amount,v.shield);v.shield-=absorbed;amount-=absorbed}
  v.hp=Math.max(0,v.hp-amount);v.hitAt=elapsed;
  if(v.hp===0){
    occupied.delete(v.k);cancelTravel(v);v.cast=null;v.respawnAt=elapsed+12;kills[u.team]++;
    if(v===me)note('전사했습니다. 12초 후 부활');
  }
}
function defend(u){
  if(u.hp>=u.max/2||u.role===1||!ready(u,2))return;
  use(u,2);
  if(u.role===0)u.guard=elapsed+3;
  else{u.shield=u.max*.2;u.shieldUntil=elapsed+3}
}
function resolveCast(u){
  const c=u.cast;
  if(!c)return false;
  if(c.type==='aim'&&(!alive(c.v)||!visible(u,c.v,4))){u.cast=null;return false}
  if(c.end>elapsed)return true;
  u.cast=null;
  if(c.type==='aim'){beam(u,c.v,'arrow');damage(u,c.v,power[1]*1.8)}
  else for(const v of units.filter(v=>alive(v)&&v.team!==u.team&&dist(v.k,c.k)<=1)){
    beam(u,v,'magic');damage(u,v,power[2]*(v.k===c.k?1.4:.7));
  }
  return true;
}
function strike(u,v,foes){
  const r=u.role, range=[1,3,3][r];
  if(u.attackAt>elapsed)return;
  if(!visible(u,v,range)&&!(r===1&&ready(u,0)&&visible(u,v,4)))return;
  u.lastTarget=v.id;u.attackAt=elapsed+cadence[r];
  if(r===0){
    if(v.cast&&ready(u,1)){use(u,1);v.cast=null;v.stun=elapsed+.6;beam(u,v);damage(u,v,power[r]);return}
    if(ready(u,0)){use(u,0);beam(u,v);damage(u,v,power[r]*1.6);return}
  }else if(r===1){
    if(v.trip&&dist(v.trip.path.at(-1),u.k)<dist(v.k,u.k)&&visible(u,v,2)&&ready(u,1)){
      use(u,1);cancelTravel(v);v.root=elapsed+1.2;beam(u,v,'arrow');return;
    }
    if(u.comboId===v.id&&u.combo>=2&&ready(u,2)){
      use(u,2);u.combo=0;beam(u,v,'arrow');damage(u,v,power[r]*.7);damage(u,v,power[r]*.7);return;
    }
    if(ready(u,0)){use(u,0);u.cast={type:'aim',v,end:elapsed+.8};return}
  }else{
    const pair=foes.find(w=>w!==v&&dist(w.k,v.k)===1&&visible(u,w,3));
    if(pair&&ready(u,1)){use(u,1);frost.push({team:u.team,cells:[v.k,pair.k],until:elapsed+2});return}
    if(ready(u,0)){use(u,0);u.cast={type:'fire',k:v.k,end:elapsed+.7};return}
  }
  beam(u,v,['hit','arrow','magic'][r]);damage(u,v,power[r]);
  u.combo=u.comboId===v.id?u.combo+1:1;u.comboId=v.id;
}
function place(u,preferred){
  const free=layout.map((_,k)=>k).filter(k=>!terrainBlocks(k,u)&&!occupied.has(k)&&!reserved.has(k));
  free.sort((a,b)=>dist(a,preferred)-dist(b,preferred));
  if(!free.length)return false;
  u.k=free[0];occupied.set(u.k,u);return true;
}
function createUnit(i){
  const team=Number(i>=10),role=i===0?playerRole:i%3;
  const max=role===0?1250:850;
  return {id:i,name:names[i],team,role,max,hp:max,mp:100,img:img(i),cp:[86210,79340,72640,77420,81210,80400,71200,76480,81670,79560,84520,80130,81250,76180,75240,84310,72690,81750,79300,78510][i],cd:[0,0,0],stun:0,root:0,guard:0,shield:0,shieldUntil:0,attackAt:0,combo:0,lastTarget:null};
}
function reset(){
  occupied.clear();reserved.clear();gates.clear();[2,5,8].forEach(x=>gates.set(id(x,3),2200));
  units=Array.from({length:20},(_,i)=>createUnit(i));me=units[0];
  for(const u of units)place(u,u.team?id(2+u.id%7,4+u.id%2):id(2+u.id%7,11+u.id%2));
  elapsed=hold=0;goal=focus=null;mode='attack';gateLog=ended=false;running=false;owner='';inspectId=0;
  kills=[0,0];logs=[];beams=[];frost=[];last=performance.now();for(const root of unitEmblems.splice(0))root.unmount();
  nodes.clear();unitLayer.replaceChildren();
  $('end').hidden=true;$('setup').hidden=false;$('pause').textContent='일시정지';$('myface').src=me.img;
  document.querySelector('.sl-me-name').textContent='기크 · '+roleNames[me.role];render();
}
function tick(dt){
  elapsed+=dt;frost=frost.filter(z=>z.until>elapsed);beams=beams.filter(b=>b.until>elapsed);
  for(const u of units){
    if(!alive(u)){
      if(elapsed>=u.respawnAt&&place(u,u.team?id(5,0):camp)){
        u.hp=u.max;u.mp=100;u.guard=elapsed+3;u.root=u.stun=u.shield=u.combo=0;u.attackAt=elapsed+2;
        if(u===me){goal=focus=null}
      }
      continue;
    }
    u.mp=Math.min(100,u.mp+dt*2);
    if(u.team===0&&xy(u.k)[1]===13)u.hp=Math.min(u.max,u.hp+dt*95);
    if(u.stun>elapsed)continue;
    defend(u);
    if(u.trip){
      if(elapsed-u.trip.start<u.trip.times.at(-1))continue;
      occupied.delete(u.k);u.k=u.trip.path.at(-1);occupied.set(u.k,u);cancelTravel(u);
    }
    if(resolveCast(u))continue;
    const foes=units.filter(v=>v.team!==u.team&&alive(v)).sort((a,b)=>dist(u.k,a.k)-dist(u.k,b.k)||a.hp-b.hp);
    const manual=u===me?foes.find(v=>v.id===focus):null;
    if(u===me&&focus!==null){if(manual)goal=manual.k;else goal=focus=null}
    if(u===me&&goal===u.k)goal=null;
    const range=[1,ready(u,0)?4:3,3][u.role];
    const enemy=manual||foes.find(v=>visible(u,v,range));
    if(enemy&&visible(u,enemy,range)&&!(u===me&&mode==='move'&&goal!==null)){strike(u,enemy,foes);continue}
    if(u.root>elapsed||(u===me&&(mode==='hold'||goal===null)))continue;
    let dest=u===me?goal:foes[0]?.k;
    if(u!==me&&u.team===0){
      const gate=id([2,5,8][u.id%3],3);
      dest=gates.get(gate)>0?gate:throne;
    }
    if(dest==null)continue;
    if(gates.get(dest)>0&&u.team===0&&dist(u.k,dest)===1){
      if(elapsed>=u.attackAt){
        u.attackAt=elapsed+2.4;gates.set(dest,Math.max(0,gates.get(dest)-72));
        if(!gates.get(dest)){gateLog=true;note('성문 돌파')}
      }
      continue;
    }
    if(u.planAt>elapsed)continue;
    u.planAt=elapsed+.45;
    const targets=blocked(dest,u)||occupied.has(dest)?near(dest):[dest];
    travel(u,routes(u,targets));
  }
  const at=units.filter(v=>alive(v)&&!v.trip&&dist(v.k,throne)<=1);
  if(gateLog&&at.some(v=>!v.team)&&!at.some(v=>v.team))hold+=dt;
  else hold=Math.max(0,hold-dt*(at.some(v=>v.team)?2:.5));
  if(hold>=10||elapsed>=480){
    ended=true;running=false;$('end').hidden=false;$('endtitle').textContent=hold>=10?'왕좌 점령 성공':'점령전 종료';
    $('enddesc').textContent='아군 처치 '+kills[0]+' · 적군 처치 '+kills[1];
  }
}
const board=document.querySelector('.sl-board');
board.insertAdjacentHTML('beforeend','<section id="setup" class="sl-overlay"><div><h2>출전 준비</h2><label>직업 <select id="profession"><option>전사</option><option>궁수</option><option>마법사</option></select></label><p id="loadout"></p><button id="start">스킬 등록 · 전투 시작</button></div></section>');
const svgNS='http://www.w3.org/2000/svg';
const fx=document.createElementNS(svgNS,'svg');
fx.setAttribute('viewBox','0 0 110 140');fx.setAttribute('preserveAspectRatio','none');
fx.classList.add('sl-effects');board.insertBefore(fx,unitLayer);
const cp=u=>u.cp.toLocaleString('ko-KR');
function drawEffects(){
  fx.replaceChildren();
  function line(from,to,color,width,dash,tip){
    const [x,y]=from.map(n=>n*10+5),[a,b]=to.map(n=>n*10+5);
    const el=document.createElementNS(svgNS,'path');
    let d='M'+x+' '+y+' L'+a+' '+b;
    if(tip){
      const angle=Math.atan2(b-y,a-x);
      for(const sign of [-1,1])d+=' M'+a+' '+b+' l'+(-2*Math.cos(angle+sign*.55))+' '+(-2*Math.sin(angle+sign*.55));
    }
    el.setAttribute('d',d);el.setAttribute('fill','none');el.setAttribute('stroke',color);el.setAttribute('stroke-width',width);
    if(dash)el.setAttribute('stroke-dasharray','1 .6');
    fx.append(el);
  }
  for(const b of beams)line(b.from,b.to,b.mine?(b.team?'#ff6e59':'#ffdb75'):(b.kind==='magic'?'#bfa0cf':'#a9aa91'),b.mine?.65:.27,false,true);
  for(const u of units)if(u.cast?.type==='aim')line(position(u),position(u.cast.v),u.team?'#fc7966':'#eed37e',.45,true,false);
}
function render(){
  const left=Math.max(0,Math.ceil(480-elapsed));
  $('time').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const counts=[0,1].map(t=>units.filter(u=>alive(u)&&u.team===t).length);
  $('blue').textContent='공격군 '+counts[0]+'명';$('red').textContent='수비군 '+counts[1]+'명';
  $('balance').style.width=counts[0]/(counts[0]+counts[1]||1)*100+'%';
  $('objective').textContent=hold?'왕좌 각인 '+hold.toFixed(1)+'초':gateLog?'왕좌 진입':'성문 돌파';
  $('hp').style.width=me.hp/me.max*100+'%';$('mp').style.width=me.mp+'%';$('myhp').textContent=Math.ceil(me.hp)+' / '+me.max;
  const target=units.find(u=>alive(u)&&u.id===focus);
  const routePreview=me.trip?.path??(goal!==null&&alive(me)?routes(me,blocked(goal,me)||occupied.has(goal)?near(goal):[goal]):null);
  const actual=target||units.find(u=>alive(u)&&u.id===me.lastTarget&&visible(me,u,[1,4,3][me.role])&&me.attackAt>elapsed&&mode!=='move');
  const inspected=units[inspectId]||me;
  if(infoTeam!==inspected.team){
    infoTeam=inspected.team;
    renderGuildEmblem(infoRoot,guilds[infoTeam],28);
  }
  infoText.textContent=(inspected===me?'나':inspected.team?'적군':'아군')+' · '+inspected.name+' · '+roleNames[inspected.role]+'　'+guilds[inspected.team].name+' 원정단 · 전투력 '+cp(inspected)+(alive(inspected)?'':' · 부활 대기');
  $('state').textContent=!alive(me)?'부활까지 '+Math.max(0,Math.ceil(me.respawnAt-elapsed))+'초':me.trip?.path.length>1?'아군 통과 중':actual?(actual.name+(visible(me,actual,[1,4,3][me.role])?' 공격 중':' 추적 중')):mode==='hold'?'위치 방어 중':goal!==null?'목적지 이동 중':'목적지를 터치하세요';
  $('target').textContent='';
  const fire=units.filter(u=>u.cast?.type==='fire').map(u=>u.cast.k);
  for(let k=0;k<cells.length;k++){
    const c=cells[k];c.classList.toggle('route',!!routePreview?.includes(k));c.classList.toggle('goal',!target&&goal===k);
    c.classList.toggle('ice',frost.some(z=>z.cells.includes(k)));
    c.classList.toggle('warn',fire.some(p=>dist(k,p)<=1));c.classList.toggle('center',fire.includes(k));
    if(gates.has(k)){const h=gates.get(k);c.classList.toggle('open',!h);c.textContent=h?Math.ceil(h/2200*100)+'%':'개방'}
  }
  for(const u of units){
    let n=nodes.get(u.id);
    if(!alive(u)){if(n)n.hidden=true;continue}
    if(!n){
      n=document.createElement('div');n.innerHTML='<div class="sl-token"><img alt=""></div><div class="sl-ring"><i></i></div><span class="sl-role"></span><span class="sl-tag"><span class="sl-tag-emblem"></span><span><small></small><b></b></span></span><span class="sl-power"></span><span class="sl-condition"></span>';
      const tag=n.querySelector('.sl-tag');
      tag.style.display='flex';tag.style.alignItems='center';tag.style.gap='2px';
      tag.querySelector('b').style.display='block';
      const emblemRoot=createRoot(tag.querySelector('.sl-tag-emblem'));
      unitEmblems.push(emblemRoot);
      renderGuildEmblem(emblemRoot,guilds[u.team],15);
      n.querySelector('img').src=u.img;n.querySelector('.sl-role').textContent=roleIcon[u.role];
      n.querySelector('.sl-role').title=roleNames[u.role];unitLayer.append(n);nodes.set(u.id,n);
    }
    n.hidden=false;
    const [x,y]=position(u);
    n.className='sl-unit'+(u===me?' me':'')+(u.team?' red':'')+(u===actual?' focus':'')+(x<1?' left-edge':x>W-2?' right-edge':'')+(y<.7?' top-edge':'');
    n.querySelector('.sl-token').classList.toggle('red',!!u.team);
    n.style.left=(x+.5)/W*100+'%';n.style.top=(y+.5)/H*100+'%';
    n.querySelector('.sl-ring i').style.width=u.hp/u.max*100+'%';
    n.querySelector('small').textContent=detailed?guilds[u.team].name:'';
    n.querySelector('b').textContent=(u===me?'나▼ ':'')+u.name;
    n.querySelector('.sl-power').textContent=detailed||u===inspected?cp(u):'';
    n.querySelector('.sl-condition').textContent=u.stun>elapsed?'✸':u.root>elapsed?'⛓':u.guard>elapsed||u.shieldUntil>elapsed&&u.shield?'▣':'';
  }
  $('skills').textContent=skills[me.role].map((s,i)=>s+' '+(me.cd[i]>elapsed?(me.cd[i]-elapsed).toFixed(1)+'초':'준비')).join('　');
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  drawEffects();
}
$('detail').onclick=()=>{detailed=!detailed;board.classList.toggle('detailed',detailed);$('detail').setAttribute('aria-pressed',String(detailed));$('detail').textContent=detailed?'상세 ▾':'간략 / 상세';render()};
$('locate').onclick=()=>{inspectId=0;render();const n=nodes.get(0);if(n&&!n.hidden)n.scrollIntoView({block:'nearest',inline:'center'});if(n&&!n.hidden)n.animate([{filter:'brightness(2)',outline:'3px solid gold'},{outline:'0 solid transparent'}],{duration:650,iterations:2})};
$('profession').onchange=()=>{playerRole=$('profession').selectedIndex;reset();$('loadout').textContent=skills[playerRole].join(' · ')};
$('start').onclick=()=>{$('setup').hidden=true;running=true;last=performance.now();note('점령전 시작 · 아군 10명 / 적군 10명')};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;if(mode==='hold'){goal=focus=null;cancelTravel(me)}if(mode==='move')me.cast=null;render()});
$('retreat').onclick=()=>{me.cast=null;cancelTravel(me);focus=null;goal=camp;mode='move';render()};
$('pause').onclick=()=>{if(ended||!$('setup').hidden)return;running=!running;last=performance.now();$('pause').textContent=running?'일시정지':'계속하기'};
$('reset').onclick=$('restart').onclick=reset;
$('loadout').textContent=skills[playerRole].join(' · ');
reset();
setInterval(()=>{const now=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;if(running&&!ended){tick(dt);render()}},100);
