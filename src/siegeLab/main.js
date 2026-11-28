import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {HubIcon} from '../components/mobile/HubIcon';
import {GuildEmblem} from '../components/association/GuildEmblem';
import '../game-fonts.css';
import './siege.css';
import {APPEARANCES} from '../game/data/cosmetics';
const W=59,H=54,root=document.getElementById('siege');
const img=(i)=>new URL((APPEARANCES[i%APPEARANCES.length].imagePath||APPEARANCES[0].imagePath),location.href).href;
const names=['기크','아르칸','설화','루시안','카인','테오','아벨','녹스','레온','카론','라그나','벨리온','세라','이든','렌','모르','바엘','리안','회색늑대','카엘'];
const sideSize=12, battleSeconds=30*60;
const fronts=[
  {frontX:29,sideX:40,sideY:29,innerX:29,rock:[2,14,0,16,5,11],tree:[0,16,2,14,0,16]},
  {frontX:27,sideX:40,sideY:29,innerX:31,rock:[3,13,3,11,2,14],tree:[0,14,6,13,0,16]},
  {frontX:31,sideX:18,sideY:31,innerX:27,rock:[2,11,5,13,0,11],tree:[0,16,3,10,2,14]},
  {frontX:29,sideX:18,sideY:29,innerX:31,rock:[0,16,5,11,2,14],tree:[3,13,0,16,3,13]},
  {frontX:25,sideX:40,sideY:31,innerX:29,rock:[0,13,2,10,3,14],tree:[2,16,5,13,0,11]}
];
let front=0;
const extraNames=['아린','토르','레아','세인','유나','로한','베라','이안','달빛','나린','은별','로이','제나','하람','세온','니아','파란','미르','노을','연우','루카','자운','헤라','로잔','타린','엘렌','도안','제온','무영','화린','다온','라움','포르','리엘','테린','하온','유란','라온','레드','칼린'];
const roleNames=['전사','궁수','마법사'],roleIcon=['⚔','➶','⚕'];
const cells=[],gates=new Map(),nodes=new Map();
const id=(x,y)=>y*W+x,xy=k=>[k%W,Math.floor(k/W)],dist=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.abs(x-u)+Math.abs(y-v)};
const near=k=>{const[x,y]=xy(k);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<W&&b>=0&&b<H).map(([a,b])=>id(a,b))};
const centerX=Math.floor(W/2), northWall=18,gateRow=35,innerRow=25,westWall=18,eastWall=W-19;
const tower=id(centerX,northWall+4), towerMaxHp=1800;
let towerHp=towerMaxHp;
const throne=id(centerX,northWall+2);
root.style.setProperty('--cols',W);
root.style.setProperty('--rows',H);
let units=[],me,goal=null,focus=null,path=[],running=true,ended=false,elapsed=0,hold=0,owner=1,last=performance.now(),logs=[],kills=Array(5).fill(0),lastUi=0,gateLog=false;
function castleGates(field){
  return [id(field.frontX,gateRow),id(field.sideX,field.sideY),id(field.innerX,innerRow)];
}
const campNames=['남','동','북','서'];
const camps=[id(centerX,H-6),id(W-6,26),id(centerX,5),id(5,26)];
let campByTeam=[0,-1,1,2,3],claimant=null;
function insideCamp(k,anchor){
  const [x,y]=xy(k),[a,b]=xy(anchor);
  const lateral=a===centerX?Math.abs(x-a):Math.abs(y-b);
  const depth=a===centerX?Math.abs(y-b):Math.abs(x-a);
  return lateral<=2&&depth<=1;
}
function homeCamp(u){return camps[campByTeam[u.team]]}
function buildLayout(field){
  const entries=castleGates(field);
  const rocks=new Set(),trees=new Set();
  function scatter(coords,tiles,offset){
    coords.forEach((n,i)=>{
      const depth=3+((i*5+offset)%13), along=(n*3+i)%W;
      for(const k of [id(along,gateRow+depth),id(W-1-along,northWall-depth),
        id(westWall-depth,along%H),id(eastWall+depth,H-1-along%H)])tiles.add(k);
    });
  }
  scatter(field.rock,rocks,0);scatter(field.tree,trees,2);
  const tiles=Array.from({length:W*H},(_,k)=>{
    const [x,y]=xy(k);
    if(k===throne)return 'throne';
    if(entries.includes(k))return 'gate';
    if(y>=northWall&&y<=gateRow&&x>=westWall&&x<=eastWall){
      if(x===westWall||x===eastWall||y===northWall||y===innerRow||y===gateRow)return 'wall';
      return 'stone';
    }

    if(camps.some(c=>insideCamp(k,c)))return 'camp';
    if(camps.some(c=>{
      const [cx,cy]=xy(c);
      return Math.abs(x-cx)<=5&&Math.abs(y-cy)<=5;
    }))return 'grass';
    if(rocks.has(k))return 'rock';
    if(trees.has(k))return 'tree';
    return 'grass';
  });

  // Follow walkable tiles so the painted approach always leads through its own gate.
  function layRoad(start,end,minY,maxY){
    const queue=[start], parent=new Map([[start,null]]);
    for(let i=0;i<queue.length;i++){
      const k=queue[i];
      if(k===end){
        for(let n=k;n!==null;n=parent.get(n)){
          if(['grass','stone'].includes(tiles[n]))tiles[n]='road';
        }
        return;
      }
      const steps=near(k).sort((a,b)=>dist(a,end)-dist(b,end));
      for(const n of steps){
        const [,y]=xy(n);
        if(y<minY||y>maxY||parent.has(n)||['tree','rock','wall','gate'].includes(tiles[n]))continue;
        parent.set(n,k);queue.push(n);
      }
    }
  }
  const flank=field.sideX===westWall?-1:1;
  const lane=field.sideX+flank;
  const outsideFront=id(field.frontX,gateRow+1),outsideSide=id(lane,field.sideY);
  for(const camp of camps){
    const entry=dist(camp,outsideFront)<=dist(camp,outsideSide)?outsideFront:outsideSide;
    layRoad(camp,entry,0,H-1);
  }
  for(let i=0;i<camps.length;i++)layRoad(camps[i],camps[(i+1)%camps.length],0,H-1);
  layRoad(id(field.frontX,gateRow-1),id(field.innerX,innerRow+1),innerRow+1,gateRow-1);
  layRoad(id(field.sideX-flank,field.sideY),id(field.innerX,innerRow+1),innerRow+1,gateRow-1);
  layRoad(id(field.innerX,innerRow-1),throne,1,innerRow-1);
  tiles[tower]='tower';
  return tiles;
}
let layout=buildLayout(fronts[front]);
let [frontGate,sideGate,innerGate]=castleGates(fronts[front]);
const gateName=k=>k===frontGate?'정문':k===sideGate?'측문':'내성문';
const gateMaxHp=2200;
function paintCell(cell,k){
  const tile=layout[k], [x,y]=xy(k);
  cell.className='sl-cell '+tile;
  if(tile==='wall' && (x===westWall||x===eastWall) && y<gateRow)cell.classList.add('side-wall');
  delete cell.dataset.hp;
  cell.replaceChildren();
  if(tile==='tower')cell.textContent='♜';
  if(tile==='gate'||tile==='tower'){
    const bar=document.createElement('i');
    bar.className='gate-health';
    cell.append(bar);
  }
  cell.setAttribute('aria-label',({tower:'수호탑',gate:'철문',wall:'성벽',throne:'왕좌',road:'흙길'})[tile]||tile);
  if(tile==='camp')cell.setAttribute('aria-label',campNames[camps.findIndex(anchor=>insideCamp(k,anchor))]+' 캠프');
  cell.setAttribute('aria-label',cell.getAttribute('aria-label')+' '+x+','+y);
}
root.innerHTML='<header class="sl-head"><div class="sl-top"><div><b>노바르 점령전</b></div><button id="pause" aria-label="일시정지">Ⅱ</button><span class="sl-time" id="time">30:00</span></div><div class="sl-meter"><span class="sl-blue" id="blue"></span><span id="objective">성문 돌파</span><span class="sl-red" id="red"></span></div><div class="sl-score"><i id="balance"></i></div></header><section class="sl-panel sl-me"><button id="locate" aria-label="내 위치 찾기"><img id="myface" alt=""></button><div><div class="sl-me-name">기크 · 전사 <small>Lv. 52</small></div><div class="sl-hp"><i id="hp"></i></div><div class="sl-hp sl-mp"><i id="mp"></i></div></div><small id="myhp"></small></section><div class="sl-caption"><span><span id="owner-label"></span> ● <span class="sl-blue">아군</span> / <span class="sl-red">적군</span></span><button id="view-toggle">전장 전체</button></div><div class="sl-frame"><div class="sl-viewport"><section class="sl-board" aria-label="점령전 격자 전장"><div class="sl-cells" id="cells"></div><div class="sl-units" id="units"></div></section></div><div class="sl-overlay" id="end" hidden><div><h2 id="endtitle"></h2><p id="enddesc"></p><button id="restart">다시 시작</button></div></div><button type="button" class="retreat-orb" id="retreat" aria-label="진영으로 후퇴" title="진영으로 후퇴">↶</button><section class="sl-status"><strong id="state"></strong><span id="target"></span></section><section class="sl-panel" id="inspect" hidden><button id="close-info" aria-label="정보 닫기">×</button></section></div>';
const bottomNav=document.createElement('nav');
bottomNav.className='sl-bottom-nav';
bottomNav.setAttribute('aria-label','주요 메뉴');
root.append(bottomNav);
const destinations=[['home','거점'],['shop','상점'],['inventory','가방'],['market','거래소'],['association','원정단']];
createRoot(bottomNav).render(destinations.map(([page,label])=>
  createElement('a',{key:page,href:'./?tab='+page,'aria-current':page==='association'?'location':undefined},
    createElement(HubIcon,{name:page}),label)
));
const $=s=>document.getElementById(s),unitLayer=$('units');
for(let k=0;k<W*H;k++){const b=document.createElement('button');b.type='button';paintCell(b,k);b.addEventListener('click',()=>choose(k));$('cells').append(b);cells.push(b);}
let message='', messageUntil=0;
function note(t){message=t;messageUntil=elapsed+1.1}
function alive(u){return u.hp>0}
const guilds = [
  {name:'은빛여명', emblem:{shape:'round',symbol:'moon',pattern:'band',border:'silver',base:'#2f4f80',accent:'#b5b8b1'}},
  {name:'붉은서약', emblem:{shape:'shield',symbol:'sword',pattern:'chevron',border:'gold',base:'#942f3c',accent:'#d7b878'}},
  {name:'황금서광',emblem:{shape:'shield',symbol:'sword',pattern:'band',border:'gold',base:'#945d23',accent:'#f1ce7c'}},
  {name:'녹빛수호',emblem:{shape:'round',symbol:'moon',pattern:'chevron',border:'silver',base:'#416544',accent:'#c5db94'}},
  {name:'보랏빛별',emblem:{shape:'shield',symbol:'moon',pattern:'band',border:'silver',base:'#67477e',accent:'#dcb4eb'}}
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
let inspectId = 0, overview = false, frost = [], beams = [], basicAttacks = [], playerRole = 0;
const occupied = new Map(), reserved = new Map();
const terrainBlocks = (k,u) => ['wall','rock','tree'].includes(layout[k]) || (u.team!==owner && gates.get(k)>0) || (k===tower&&towerHp>0);
const blocked = (k,u) => terrainBlocks(k,u) || (occupied.has(k) && occupied.get(k).team!==u.team) || (reserved.has(k) && reserved.get(k)!==u);
function routes(u,targets) {
  const ends=new Set(targets.filter(k=>!blocked(k,u) && (!occupied.has(k)||k===u.k)));
  if (!ends.size) return null;
  // Movement weights are multiples of a quarter step; bucketed costs avoid scanning the frontier.
  const buckets=[ [u.k] ],costs=new Map([[u.k,0]]),prev=new Map();
  for(let score=0;score<buckets.length;score++){
    const bucket=buckets[score];
    if(!bucket)continue;
    for(const k of bucket){
    if(costs.get(k)!==score)continue;
    if(ends.has(k)){
      const path=[];
      for(let p=k;p!==u.k;p=prev.get(p)) path.unshift(p);
      return path;
    }
    for(const n of near(k)){
      if(blocked(n,u)) continue;
      const cost=score+(occupied.has(n)?6:4)*(icy(n,u)?1.5:1);
      if(cost>=(costs.get(n)??Infinity)) continue;
      costs.set(n,cost);prev.set(n,k);(buckets[cost]??=[]).push(n);
    }
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
// Fortifications block movement. Attacks can cross them in either direction.
function inAttackRange(u,v,range){
  return dist(u.k,v.k)<=range;
}
function issueOrder(k, enemy=null){
  cancelTravel(me);me.cast=null;me.lastTarget=null;me.planAt=0;
  focus=enemy?.id??null;goal=k;
  render();
}
const attackRange=u=>[1,ready(u,0)?4:3,3][u.role];
function choose(k){
  if(ended||!alive(me)||!$('setup').hidden)return;
  const unit=units.find(v=>alive(v)&&id(...position(v).map(Math.round))===k)||occupied.get(k);
  if(unit){
    inspectId=unit.id;$('inspect').hidden=false;
    if(unit.team===me.team){render();return}
    issueOrder(unit.k,unit);return;
  }
  if(!terrainBlocks(k,me)||(me.team!==owner&&(gates.get(k)>0||(gates.get(innerGate)===0&&k===tower)))){$('inspect').hidden=true;issueOrder(k)}
}
function beam(u,v,kind='hit'){
  beams.push({from:position(u),to:position(v),kind,team:u.team,mine:u===me||v===me,until:elapsed+.48});
}
function ready(u,i){return u.cd[i]<=elapsed&&u.mp>=14}
function use(u,i){
  u.cd[i]=elapsed+cooldowns[u.role][i];u.mp-=14;
  if(u===me)note(skills[u.role][i]+' 발동');
}
function hpColor(ratio){
  if(ratio<=.25)return '#f66b62';
  if(ratio<=.5)return '#edc448';
  return '#74cf77';
}
function damage(u,v,n,source=position(u)){
  if(!alive(v))return;
  let amount=Math.round(n*(v.guard>elapsed?.65:1));
  if(v.shieldUntil>elapsed){const absorbed=Math.min(amount,v.shield);v.shield-=absorbed;amount-=absorbed}
  if(amount>0){
    if(!(v.trailUntil>elapsed))v.trailHp=v.hp;
    v.trailUntil=elapsed+.4;
    v.hp=Math.max(0,v.hp-amount);v.hitAt=elapsed;
    if(v===me){
      const [x,y]=position(v);
      v.hitDirection=Math.atan2(source[1]-y,source[0]-x)*180/Math.PI;
    }
  }
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
  if(c.type==='aim'&&(!alive(c.v)||!inAttackRange(u,c.v,4))){u.cast=null;return false}
  if(c.end>elapsed)return true;
  u.cast=null;
  if(c.type==='aim'){beam(u,c.v,'arrow');damage(u,c.v,power[1]*1.8)}
  else for(const v of units.filter(v=>alive(v)&&v.team!==u.team&&dist(v.k,c.k)<=1)){
    beam(u,v,'magic');damage(u,v,power[2]*(v.k===c.k?1.4:.7));
  }
  return true;
}
function startBasicAttack(u,v){
  const from=position(u),to=position(v);
  const duration=u.role===0?.18:.28;
  basicAttacks.push({u,v,from,start:elapsed,end:elapsed+duration});
  if(u.role===0){
    const angle=Math.atan2(to[1]-from[1],to[0]-from[0]);
    u.lunge={angle,start:elapsed,end:elapsed+duration*2};
  }
}
function resolveBasicAttacks(){
  const flying=[];
  for(const attack of basicAttacks){
    if(!alive(attack.v))continue;
    if(elapsed<attack.end)flying.push(attack);
    else damage(attack.u,attack.v,power[attack.u.role],attack.from);
  }
  basicAttacks=flying;
}
function strike(u,v,foes){
  const r=u.role, range=[1,3,3][r];
  if(u.attackAt>elapsed)return;
  if(!inAttackRange(u,v,range)&&!(r===1&&ready(u,0)&&inAttackRange(u,v,4)))return;
  u.lastTarget=v.id;u.attackAt=elapsed+cadence[r];
  if(r===0){
    if(v.cast&&ready(u,1)){use(u,1);v.cast=null;v.stun=elapsed+.6;beam(u,v);damage(u,v,power[r]);return}
    if(ready(u,0)){use(u,0);beam(u,v);damage(u,v,power[r]*1.6);return}
  }else if(r===1){
    if(v.trip&&dist(v.trip.path.at(-1),u.k)<dist(v.k,u.k)&&inAttackRange(u,v,2)&&ready(u,1)){
      use(u,1);cancelTravel(v);v.root=elapsed+1.2;beam(u,v,'arrow');return;
    }
    if(u.comboId===v.id&&u.combo>=2&&ready(u,2)){
      use(u,2);u.combo=0;beam(u,v,'arrow');damage(u,v,power[r]*.7);damage(u,v,power[r]*.7);return;
    }
    if(ready(u,0)){use(u,0);u.cast={type:'aim',v,end:elapsed+.8};return}
  }else{
    const pair=foes.find(w=>w!==v&&dist(w.k,v.k)===1&&inAttackRange(u,w,3));
    if(pair&&ready(u,1)){use(u,1);frost.push({team:u.team,cells:[v.k,pair.k],until:elapsed+2});return}
    if(ready(u,0)){use(u,0);u.cast={type:'fire',k:v.k,end:elapsed+.7};return}
  }
  startBasicAttack(u,v);
  u.combo=u.comboId===v.id?u.combo+1:1;u.comboId=v.id;
}
function insideCastle(k){
  const [x,y]=xy(k);
  return x>westWall&&x<eastWall&&y>northWall&&y<gateRow;
}
function place(u,preferred){
  const free=layout.map((_,k)=>k).filter(k=>(u.team===owner?insideCastle(k):insideCamp(k,homeCamp(u)))&&layout[k]!=='gate'&&!terrainBlocks(k,u)&&!occupied.has(k)&&!reserved.has(k));
  free.sort((a,b)=>dist(a,preferred)-dist(b,preferred));
  if(!free.length)return false;
  u.k=free[0];occupied.set(u.k,u);return true;
}
function createUnit(i){
  const team=Math.floor(i/sideSize), index=i%sideSize;
  const sample=i%names.length,role=i===0?playerRole:sample%3;
  const name=i<names.length?names[i]:extraNames[i-names.length];
  const max=role===0?1250:850;
  return {id:i,name,team,role,max,hp:max,mp:100,img:img(i),cp:[86210,79340,72640,77420,81210,80400,71200,76480,81670,79560,84520,80130,81250,76180,75240,84310,72690,81750,79300,78510][sample]+Math.floor(index/10)*733,cd:[0,0,0],stun:0,root:0,guard:0,shield:0,shieldUntil:0,attackAt:0,combo:0,lastTarget:null};
}
function restoreStructures(){
  gateLog=false;towerHp=towerMaxHp;hold=0;
  gates.clear();
  [frontGate,sideGate,innerGate]=castleGates(fronts[front]);
  for(const k of [frontGate,sideGate,innerGate])gates.set(k,gateMaxHp);
}
function deploySides(){
  refreshCampLabels();
  occupied.clear();reserved.clear();basicAttacks=[];frost=[];beams=[];
  for(const u of units){
    u.trip=null;u.cast=null;u.lastTarget=null;u.planAt=0;u.lunge=null;
    if(!alive(u))continue;
    const slot=u.id%sideSize;
    if(u.team!==owner){
      const [x,y]=xy(homeCamp(u)),n=slot;
      place(u,id(x+n%5-2,y+Math.floor(n/5)-1));continue;
    }
    const field=fronts[front], squad=slot%3;
    const anchor=squad===0?id(field.frontX,gateRow-2):squad===1?id(field.sideX+(field.sideX===westWall?2:-2),field.sideY):id(field.innerX,innerRow-2);
    place(u,anchor);
  }
}
function captureCastle(winner){
  campByTeam[owner]=campByTeam[winner];campByTeam[winner]=-1;
  claimant=null;owner=winner;goal=focus=null;restoreStructures();deploySides();
  following=true;trackPlayer(true);
  note(guilds[owner].name+' 점령 · 공수 교대');messageUntil=elapsed+4;
}
function reset(){
  document.querySelector('.sl-top b').textContent='노바르 · 제'+(front+1)+'전장';
  message='';messageUntil=0;$('inspect').hidden=true;$('halt').hidden=true;
  owner=1;campByTeam=[0,-1,1,2,3];claimant=null;restoreStructures();
  units=Array.from({length:sideSize*guilds.length},(_,i)=>createUnit(i));me=units[0];
  deploySides();
  elapsed=hold=0;goal=focus=null;gateLog=ended=false;running=false;inspectId=0;following=true;overview=false;frame.classList.remove('overview');$('view-toggle').textContent='전장 전체';
  kills=Array(5).fill(0);logs=[];beams=[];basicAttacks=[];frost=[];last=performance.now();for(const root of unitEmblems.splice(0))root.unmount();
  nodes.clear();unitLayer.replaceChildren();
  $('end').hidden=true;$('setup').hidden=false;$('pause').textContent='Ⅱ';$('myface').src=me.img;
  document.querySelector('.sl-me-name').textContent='기크 · '+roleNames[me.role];render();
}
function tick(dt){
  dt=Math.min(dt,battleSeconds-elapsed);elapsed+=dt;resolveBasicAttacks();frost=frost.filter(z=>z.until>elapsed);beams=beams.filter(b=>b.until>elapsed);
  for(const u of units){
    if(!alive(u)){
      if(elapsed>=u.respawnAt&&place(u,u.team===owner?id(centerX,northWall+1):homeCamp(u))){
        u.trailUntil=0;u.hp=u.max;u.mp=100;u.guard=elapsed+3;u.root=u.stun=u.shield=u.combo=0;u.attackAt=elapsed+2;
        if(u===me){goal=focus=null}
      }
      continue;
    }
    u.mp=Math.min(100,u.mp+dt*2);
    if(u.team!==owner&&insideCamp(u.k,homeCamp(u)))u.hp=Math.min(u.max,u.hp+dt*95);
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
    if(u===me&&goal===u.k&&!manual)goal=null;
    const range=attackRange(u);
    const enemy=manual||foes.find(v=>inAttackRange(u,v,range));
    if(enemy&&inAttackRange(u,enemy,range)&&!(u===me&&goal!==null&&!manual)){strike(u,enemy,foes);continue}
    if(u.root>elapsed||(u===me&&goal===null))continue;
    let dest=u===me?goal:foes[0]?.k;
    if(u!==me&&u.team!==owner){
      const approach=dist(homeCamp(u),sideGate)<dist(homeCamp(u),frontGate)?sideGate:frontGate;
      dest=!gateLog?approach:gates.get(innerGate)>0?innerGate:towerHp>0?tower:throne;
    }
    if(u!==me&&u.team===owner&&!gateLog)continue;
    if(dest==null)continue;
    if(dest===tower&&towerHp>0&&gates.get(innerGate)===0&&u.team!==owner&&dist(u.k,tower)===1){
      if(elapsed>=u.attackAt){
        towerHp=Math.max(0,towerHp-72);u.attackAt=elapsed+2.4;
        if(!towerHp){if(goal===tower)goal=null;note('수호탑 파괴 · 왕좌 점령 가능')}
      }
      continue;
    }
    if(gates.get(dest)>0&&(dest!==innerGate||gateLog)&&u.team!==owner&&dist(u.k,dest)===1){
      if(elapsed>=u.attackAt){
        u.attackAt=elapsed+2.4;gates.set(dest,Math.max(0,gates.get(dest)-72));
        const gateCell=cells[dest];
        if(!gateCell.getAnimations().length&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          gateCell.animate([{transform:'translateX(-1px)'},{transform:'translateX(1px)'},{transform:'none'}],{duration:140});
        if(!gates.get(dest)){if(goal===dest&&focus===null)goal=null;if(dest!==innerGate)gateLog=true;note(gateName(dest)+' 돌파')}
      }
      continue;
    }
    if(u.planAt>elapsed)continue;
    u.planAt=elapsed+.45;
    const targets=blocked(dest,u)||occupied.has(dest)?near(dest):[dest];
    travel(u,routes(u,targets));
  }
  const at=units.filter(v=>alive(v)&&!v.trip&&dist(v.k,throne)<=1);
  const present=new Set(at.map(u=>u.team));
  const contender=present.size===1?at[0].team:null;
  if(gateLog&&towerHp===0&&contender!==null&&contender!==owner){
    if(claimant!==contender){claimant=contender;hold=0}
    hold+=dt;
    if(hold>=10)captureCastle(contender);
  }else hold=Math.max(0,hold-dt*(present.size?2:.5));
  if(elapsed>=battleSeconds){
    ended=true;running=false;$('end').hidden=false;$('endtitle').textContent=guilds[owner].name+' 승리 · 최종 점령';
    $('enddesc').textContent='내 원정단 처치 '+kills[me.team];
  }
}
const board=document.querySelector('.sl-board');
const scenery=document.createElement('div');
scenery.className='sl-camp-scenery';
scenery.setAttribute('aria-hidden','true');
board.insertBefore(scenery,unitLayer);
function part(parent,css){
  const node=document.createElement('span');node.className=css;parent.append(node);return node;
}
function prop(css,k,dx=0,dy=0){
  const node=part(scenery,css),[x,y]=xy(k);
  node.style.left=(x+.5+dx)/W*100+'%';node.style.top=(y+.5+dy)/H*100+'%';
  return node;
}
function standard(k,dx,dy){
  const pole=prop('sl-camp-standard',k,dx,dy);
  const cloth=part(pole,'sl-camp-cloth');
  return {pole,root:createRoot(part(cloth,'sl-standard-emblem'))};
}
// Local camp coordinates use a south camp with the castle to its north.
const campAxes=[[1,0],[0,-1],[-1,0],[0,1]];
const campProps=camps.map((k,i)=>{
  const [a,b]=campAxes[i];
  function position(x,y){return [a*x-b*y,b*x+a*y]}
  prop('sl-camp-floor',k);
  for(const side of [-1,1]){
    for(const depth of [-3.1,3.15]){
      const tent=prop('sl-camp-tent',k,...position(side*3.1,depth));
      const frame=((side<0?1:3)-i+4)%4;
      tent.style.backgroundPosition=(frame*100/3)+'% center';
    }
  }
  if(i===0){
    prop('sl-wheel-ruts',k,-3.05,1.72);
    prop('sl-tent-entry',k,0,4.45);
  }
  for(const [name,x,y] of [
    ['command-tent',0,3.05],['supply-wagon',-3.05,0],
    ['equipment-rack',3.1,-.95],['supply-pile',3.1,1.05]
  ]){
    const facility=prop('sl-camp-prop '+name,k,...position(x,y));
    if(i===0&&(name==='command-tent'||name==='supply-wagon'))facility.classList.add('sl-grounded');
  }
  return {...standard(k,...position(-1.55,-2.45)),label:prop('sl-camp-caption',k,0,a?-2.75:-4.45)};
});
const castleStandard=standard(throne,1.25,.2);
function markStandard(item,team){
  const guild=guilds[team];
  item.pole.style.setProperty('--cloth-color',guild.emblem.base);
  renderGuildEmblem(item.root,guild,18);
}
function refreshCampLabels(){
  campProps.forEach((item,i)=>{
    const team=campByTeam.indexOf(i);
    markStandard(item,team);item.label.textContent=campNames[i]+' · '+guilds[team].name;
  });
  markStandard(castleStandard,owner);
}
const frame=board.closest('.sl-frame'), viewport=board.parentElement;
frame.insertAdjacentHTML('beforeend','<section id="setup" class="sl-overlay"><div><h2>출전 준비</h2><label>전장 <select id="front"></select></label> <label>직업 <select id="profession"><option>전사</option><option>궁수</option><option>마법사</option></select></label> <button id="start">전투 시작</button></div></section>');
frame.insertAdjacentHTML('beforeend','<section class="sl-overlay" id="halt" hidden><div><h2>일시정지</h2><button id="resume">계속하기</button> <button id="reset">출전 준비</button> <a href="./">게임으로</a></div></section>');
const svgNS='http://www.w3.org/2000/svg';
const fx=document.createElementNS(svgNS,'svg');
fx.setAttribute('viewBox',`0 0 ${W*10} ${H*10}`);fx.setAttribute('preserveAspectRatio','none');
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
  for(const {u,v,from,start,end} of basicAttacks){
    if(u.role===0)continue;
    const progress=Math.min(1,(elapsed-start+.035)/(end-start));
    const to=position(v),at=f=>from.map((n,i)=>n+(to[i]-n)*f);
    const tip=at(progress), important=u===me||v===me;
    if(u.role===1){
      line(at(Math.max(0,progress-.22)),tip,important?'#ffdc85':'#b9af8f',important?.55:.32,false,true);
    }else{
      const orb=document.createElementNS(svgNS,'circle');
      orb.setAttribute('cx',tip[0]*10+5);orb.setAttribute('cy',tip[1]*10+5);
      orb.setAttribute('r',important?1.05:.65);orb.setAttribute('fill',important?'#e8dbff':'#b8a0cb');
      orb.setAttribute('stroke','#9066bd');orb.setAttribute('stroke-width','.4');fx.append(orb);
    }
  }
  for(const b of beams){
    const duration=b.mine?.38:.16, age=elapsed-(b.until-.48);
    if(age>duration)continue;
    const progress=Math.min(1,(age+.08)/duration);
    const at=f=>b.from.map((n,i)=>n+(b.to[i]-n)*f);
    line(at(Math.max(0,progress-.45)),at(progress),b.mine?(b.team?'#ff6e59':'#ffdb75'):'#a9aa91',b.mine?.65:.25,false,true);
  }
  for(const u of units)if(u.cast?.type==='aim'&&(u===me||u.cast.v===me))line(position(u),position(u.cast.v),u.team?'#fc7966':'#eed37e',.45,true,false);
}
function arrangeTags(entries, bounds, now) {
  const overlaps=(a,b)=>a.x<b.x+b.w+1 && a.x+a.w+1>b.x && a.y<b.y+b.h+1 && a.y+a.h+1>b.y;
  const occupied=entries.map(e=>e.obstacle);
  for(const e of entries.sort((a,b)=>b.priority-a.priority||a.id-b.id)){
    const {x,y,w,h,tagWidth,tagHeight}=e;
    const center=x+(w-tagWidth)/2, above=y-tagHeight-2, below=e.obstacle.y+e.obstacle.h+2;
    const left=x-tagWidth-4, right=x+w+3, middle=y+(h-tagHeight)/2;
    const candidates=[[center,above],[e.priority===3?left:right,middle],[e.priority===3?right:left,middle],[center,below]];
    if(e.priority){
      for(let offset=5;offset<=Math.max(bounds.w,bounds.h);offset+=5){
        candidates.push([center,above-offset],[center,below+offset],[left-offset,middle],[right+offset,middle]);
      }
    }
    let found=null;
    for(const [cx,cy] of candidates){
      const box={x:Math.max(1,Math.min(bounds.w-tagWidth-1,cx)),y:cy,w:tagWidth,h:tagHeight};
      if(box.y<1||box.y+box.h>bounds.h-1||occupied.some(r=>overlaps(box,r)))continue;
      found=box;break;
    }
    if(!found){e.node._freeSince=null;e.node._folded=true}
    else if(e.node._folded&&!e.priority){
      e.node._freeSince??=now;
      if(now-e.node._freeSince>=350)e.node._folded=false;
    }else e.node._folded=false;
    if(!found||e.node._folded){e.tag.style.visibility='hidden';continue}
    occupied.push(found);
    e.tag.style.visibility='visible';
    e.tag.style.left=(found.x-x)+'px';e.tag.style.top=(found.y-y)+'px';
  }
}
function layoutNames(actual,inspected){
  const bounds=unitLayer.getBoundingClientRect();
  if(!bounds.width)return;
  const entries=[];
  for(const u of units.filter(alive)){
    const node=nodes.get(u.id),tag=node.querySelector('.sl-tag');
    const r=node.getBoundingClientRect(),x=r.left-bounds.left,y=r.top-bounds.top;
    const badge=node.querySelector('.sl-tag-emblem').getBoundingClientRect();
    const bar=node.querySelector('.sl-ring').getBoundingClientRect();
    const x1=Math.min(r.left-2,badge.left,bar.left)-bounds.left,y1=Math.min(r.top-2,badge.top)-bounds.top;
    entries.push({id:u.id,node,tag,x,y,w:r.width,h:r.height,tagWidth:tag.offsetWidth,tagHeight:tag.offsetHeight,
      obstacle:{x:x1,y:y1,w:Math.max(r.right+2,badge.right,bar.right)-bounds.left-x1,h:Math.max(r.bottom+2,bar.bottom)-bounds.top-y1},
      priority:u===me?3:u===actual?2:u===inspected?1:0});
  }
  arrangeTags(entries,{w:bounds.width,h:bounds.height},performance.now());
}
let lastMarkedCells=new Set();
function render(){
  const left=Math.max(0,Math.ceil(battleSeconds-elapsed));
  $('time').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const defenders=units.filter(u=>alive(u)&&u.team===owner).length;
  const attackers=units.filter(u=>alive(u)&&u.team!==owner).length;
  $('blue').textContent='공성 '+attackers+'명';$('red').textContent='수성 '+defenders+'명';
  $('balance').style.width=attackers/(attackers+defenders||1)*100+'%';
  $('owner-label').textContent='성주 '+guilds[owner].name;
  $('objective').textContent=hold?guilds[claimant].name+' '+hold.toFixed(1)+'초':gateLog?(gates.get(innerGate)>0?'내성문 돌파':towerHp?'수호탑 '+Math.ceil(towerHp/towerMaxHp*100)+'%':'왕좌 진입'):'외성문 돌파';
  $('hp').style.width=me.hp/me.max*100+'%';$('mp').style.width=me.mp+'%';$('hp').style.background=hpColor(me.hp/me.max);
  $('myhp').textContent='HP '+Math.ceil(me.hp).toLocaleString('ko-KR')+' / '+me.max.toLocaleString('ko-KR');
  const target=units.find(u=>alive(u)&&u.id===focus);
  const moving=alive(me)&&goal!==null;
  const nextSteps=me.trip?.path.slice(me.trip.times.filter(t=>t<=elapsed-me.trip.start).length)
    ??(moving?routes(me,blocked(goal,me)||occupied.has(goal)?near(goal):[goal]):null);
  const headings=new Map();
  if(moving&&nextSteps?.length){
    let prev=me.trip?me.trip.path[me.trip.path.length-nextSteps.length-1]??me.k:me.k;
    for(const step of nextSteps.slice(0,3)){
      const [x,y]=xy(prev),[nx,ny]=xy(step);
      if(step!==goal)headings.set(step,Math.atan2(ny-y,nx-x)*180/Math.PI);
      prev=step;
    }
  }
  const actual=target||units.find(u=>alive(u)&&u.id===me.lastTarget&&inAttackRange(me,u,attackRange(me))&&me.attackAt>elapsed&&goal===null);
  const inspected=units[inspectId]||me;
  if(infoTeam!==inspected.team){
    infoTeam=inspected.team;
    renderGuildEmblem(infoRoot,guilds[infoTeam],28);
  }
  infoText.textContent='살펴보는 '+(inspected===me?'나':inspected.team?'적군':'아군')+' · '+inspected.name+' · '+roleNames[inspected.role]+'　'+guilds[inspected.team].name+' 원정단 · 전투력 '+cp(inspected)+(alive(inspected)?'':' · 부활 대기');
  $('state').textContent=!alive(me)?'부활까지 '+Math.max(0,Math.ceil(me.respawnAt-elapsed))+'초':me.trip?.path.length>1?'아군 통과 중':actual?(actual.name+(inAttackRange(me,actual,attackRange(me))?' 공격 중':' 추적 중')):goal===tower&&towerHp>0?(dist(me.k,tower)===1?'수호탑 공격 중':'수호탑으로 이동 중'):gates.get(goal)>0?(dist(me.k,goal)===1?'성문 공격 중':'성문으로 이동 중'):goal!==null?'목적지로 이동 중':'현재 위치 방어 중';
  $('target').textContent=alive(me)&&actual?'HP '+Math.ceil(actual.hp/actual.max*100)+'%':gates.get(goal)>0?gateName(goal)+' '+Math.ceil(gates.get(goal)/gateMaxHp*100)+'%':'';
  const fire=units.filter(u=>u.cast?.type==='fire').map(u=>u.cast.k);
  const marked=new Set([...headings.keys(),...gates.keys(),tower,...frost.flatMap(z=>z.cells),...fire.flatMap(k=>[k,...near(k)])]);
  if(goal!==null)marked.add(goal);
  const dirty=new Set([...lastMarkedCells,...marked]);lastMarkedCells=marked;
  for(const k of dirty){
    const c=cells[k];c.classList.toggle('path-mark',headings.has(k));
    if(headings.has(k))c.style.setProperty('--heading',headings.get(k)+'deg');
    const destination=moving&&!target&&goal===k;
    c.classList.toggle('move-mark',destination&&!gates.get(k));
    c.classList.toggle('goal',destination&&!!gates.get(k));
    c.classList.toggle('ice',frost.some(z=>z.cells.includes(k)));
    c.classList.toggle('warn',fire.some(p=>dist(k,p)<=1));c.classList.toggle('center',fire.includes(k));
    
    if(gates.has(k)||k===tower){
      const isTower=k===tower,max=isTower?towerMaxHp:gateMaxHp;
      const hp=isTower?towerHp:gates.get(k);
      if(c.dataset.hp!==String(hp)){
        c.dataset.hp=String(hp);
        c.classList.toggle('broken',hp>0&&hp<=max/2);
        c.classList.toggle('open',hp===0);
        c.style.setProperty('--gate-hp',hp/max);
        if(isTower)c.firstChild.nodeValue=hp?'♜':'▧';
        c.setAttribute('aria-label',hp?(isTower?'수호탑 ':gateName(k)+' ')+Math.ceil(hp/max*100)+'%':isTower?'파괴된 수호탑':'열린 '+gateName(k));
      }
    }
  }
  for(const u of units){
    let n=nodes.get(u.id);
    if(!alive(u)){if(n)n.hidden=true;continue}
    if(!n){
      n=document.createElement('div');n.innerHTML='<div class="sl-token"><img alt=""></div><div class="sl-ring"><span class="damage-trail"></span><i></i></div><span class="sl-role"></span><span class="sl-tag-emblem"></span><span class="sl-tag"><small></small><span class="sl-name-row"><b></b><span class="sl-percent"></span></span><span class="sl-power"></span></span><span class="sl-condition"></span>';
      const tag=n.querySelector('.sl-tag');
      tag.style.display='flex';tag.style.alignItems='center';tag.style.gap='2px';
      tag.querySelector('b').style.display='block';
      const emblemRoot=createRoot(n.querySelector('.sl-tag-emblem'));
      unitEmblems.push(emblemRoot);
      renderGuildEmblem(emblemRoot,guilds[u.team],15);
      if(u===me){
        const arc=document.createElement('i');arc.className='sl-hit-direction';arc.hidden=true;arc.setAttribute('aria-hidden','true');n.append(arc);
      }
      n.querySelector('img').src=u.img;n.querySelector('.sl-role').textContent=roleIcon[u.role];
      n.querySelector('.sl-role').title=roleNames[u.role];unitLayer.append(n);nodes.set(u.id,n);
    }
    n.hidden=false;
    const [x,y]=position(u);
    n.className='sl-unit'+(u===me?' me':'')+(u.team?' red':'')+(u===actual?' focus':'')+(x<1?' left-edge':x>W-2?' right-edge':'')+(y<.7?' top-edge':y>H-1.7?' last-row':'');
    n.classList.toggle('passing',u===me&&!!u.trip&&u.trip.path.length>1);
    const token=n.querySelector('.sl-token');
    token.classList.toggle('red',!!u.team);
    token.style.borderColor=u===me?'':guilds[u.team].emblem.accent;
    token.classList.toggle('impact',elapsed-u.hitAt<.23);
    if(u.lunge){
      const {angle,start,end}=u.lunge;
      const offset=Math.max(0,Math.sin(Math.PI*Math.min(1,(elapsed-start)/(end-start))))*23;
      token.style.transform='translate('+Math.cos(angle)*offset+'%,'+Math.sin(angle)*offset+'%)';
      if(elapsed>=end){token.style.removeProperty('transform');u.lunge=null}
    }
    if(u===me){
      const arc=n.querySelector('.sl-hit-direction');
      arc.hidden=!(elapsed-u.hitAt<.6);
      if(!arc.hidden)arc.style.setProperty('--direction',u.hitDirection+'deg');
    }
    n.style.left=(x+.5)/W*100+'%';n.style.top=(y+.5)/H*100+'%';
    const ratio=u.hp/u.max;
    n.style.setProperty('--hp-color',hpColor(ratio));
    n.querySelector('.sl-ring i').style.width=ratio*100+'%';
    const showTrail=u===actual&&u.trailUntil>elapsed;
    n.querySelector('.damage-trail').style.width=showTrail?u.trailHp/u.max*100+'%':'0%';
    n.querySelector('.sl-percent').textContent=u===actual?Math.ceil(ratio*100)+'%':'';
    n.querySelector('small').textContent='';
    const name=n.querySelector('b');
    if(!name.hasChildNodes()){
      if(u===me){const marker=document.createElement('span');marker.textContent='나▼ ';name.append(marker)}
      name.append(u.name);
    }
    if(u===me)name.firstElementChild.classList.toggle('me-warning',ratio<=.3);
    n.querySelector('.sl-power').textContent='';
    n.querySelector('.sl-condition').textContent=u.stun>elapsed?'✸':u.root>elapsed?'⛓':u.guard>elapsed||u.shieldUntil>elapsed&&u.shield?'▣':'';
  }
  if(messageUntil>elapsed&&alive(me))$('state').textContent=message;

  layoutNames(actual,inspected);
  drawEffects();trackPlayer();
}
let following=true, drag=null, blockClick=false;
function trackPlayer(center=false){
  if(overview||!following||!me||!$('setup').hidden||ended)return;
  const [x,y]=position(me);
  const px=(x+.5)*board.clientWidth/W, py=(y+.5)*board.clientHeight/H;
  const shift=(p,scroll,size)=>center?p-size/2:p<scroll+size*.23?p-size*.23:p>scroll+size*.77?p-size*.77:scroll;
  viewport.scrollTo(shift(px,viewport.scrollLeft,viewport.clientWidth),shift(py,viewport.scrollTop,viewport.clientHeight));
}
function setView(full){
  overview=full;following=true;
  frame.classList.toggle('overview',full);
  $('view-toggle').textContent=full?'내 주변':'전장 전체';
  viewport.scrollTo(0,0);trackPlayer(true);render();
}
viewport.addEventListener('pointerdown',e=>{
  if(!e.isPrimary||e.button!==0)return;
  blockClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
});
viewport.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId||overview)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!blockClick&&Math.hypot(dx,dy)<7)return;
  blockClick=true;following=false;viewport.setPointerCapture(e.pointerId);
  viewport.scrollTo(drag.left-dx,drag.top-dy);
});
window.addEventListener('pointerup',()=>{drag=null});
window.addEventListener('pointercancel',()=>{drag=null});
viewport.addEventListener('click',e=>{if(blockClick&&e.detail){e.stopPropagation();blockClick=false}},true);
viewport.addEventListener('wheel',()=>{following=false},{passive:true});
$('view-toggle').onclick=()=>setView(!overview);
$('locate').onclick=()=>{inspectId=me.id;setView(false)};
fronts.forEach((_,i)=>$('front').add(new Option('제'+(i+1)+'전장',String(i))));
$('front').onchange=()=>{
  front=$('front').selectedIndex;layout=buildLayout(fronts[front]);
  for(let k=0;k<cells.length;k++){
    paintCell(cells[k],k);
  }
  reset();
};
$('profession').onchange=()=>{playerRole=$('profession').selectedIndex;reset()};
$('start').onclick=()=>{$('setup').hidden=true;running=true;trackPlayer(true);last=performance.now();note('점령전 시작 · 4방향 캠프')};

$('retreat').onclick=()=>{if(running&&!ended&&alive(me)&&$('setup').hidden){const camps=layout.flatMap((tile,k)=>(me.team===owner?insideCastle(k)&&xy(k)[1]===northWall+1:tile==='camp'&&insideCamp(k,homeCamp(me)))&&!blocked(k,me)&&(!occupied.has(k)||k===me.k)?[k]:[]);const path=routes(me,camps);if(path)issueOrder(path.at(-1)??me.k)}};
$('pause').onclick=()=>{if(!running||ended)return;running=false;$('halt').hidden=false;render()};
$('resume').onclick=()=>{$('halt').hidden=true;running=true;last=performance.now();render()};
$('close-info').onclick=()=>{$('inspect').hidden=true};
$('reset').onclick=$('restart').onclick=reset;
reset();
new ResizeObserver(()=>render()).observe(board);
setInterval(()=>{const now=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;if(running&&!ended){tick(dt);render()}},100);
