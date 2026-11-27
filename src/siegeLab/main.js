import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {GuildEmblem} from '../components/association/GuildEmblem';
import '../game-fonts.css';
import './siege.css';
import {APPEARANCES} from '../game/data/cosmetics';
const W=11,H=14,root=document.getElementById('siege');
const img=(i)=>new URL((APPEARANCES[i%APPEARANCES.length].imagePath||APPEARANCES[0].imagePath),location.href).href;
const names=['기크','아르칸','설화','루시안','카인','테오','아벨','녹스','레온','카론','라그나','벨리온','세라','이든','렌','모르','바엘','리안','회색늑대','카엘'];
const sideSize=30, battleSeconds=30*60;
const fronts=[
  {gates:[2,5,8],rock:[1,9,0,10,3,7],tree:[0,10,1,9,0,10]},
  {gates:[1,4,8],rock:[2,8,2,7,1,9],tree:[0,9,4,8,0,10]},
  {gates:[2,6,9],rock:[1,7,3,8,0,7],tree:[0,10,2,6,1,9]},
  {gates:[1,5,9],rock:[0,10,3,7,1,9],tree:[2,8,0,10,2,8]},
  {gates:[2,4,7],rock:[0,8,1,6,2,9],tree:[1,10,3,8,0,7]}
];
let front=0;
const extraNames=['아린','토르','레아','세인','유나','로한','베라','이안','달빛','나린','은별','로이','제나','하람','세온','니아','파란','미르','노을','연우','루카','자운','헤라','로잔','타린','엘렌','도안','제온','무영','화린','다온','라움','포르','리엘','테린','하온','유란','라온','레드','칼린'];
const roleNames=['전사','궁수','마법사'],roleIcon=['⚔','➶','⚕'];
const cells=[],gates=new Map(),nodes=new Map();
const id=(x,y)=>y*W+x,xy=k=>[k%W,Math.floor(k/W)],dist=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.abs(x-u)+Math.abs(y-v)};
const near=k=>{const[x,y]=xy(k);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<W&&b>=0&&b<H).map(([a,b])=>id(a,b))};
const throne=id(5,1),camp=id(5,13);
let units=[],me,goal=null,focus=null,path=[],running=true,ended=false,elapsed=0,hold=0,owner='',last=performance.now(),logs=[],kills=[0,0],lastUi=0,gateLog=false;
function buildLayout(field){
  const rocks=new Set(field.rock.map((x,i)=>id(x,[5,5,8,8,10,10][i])));
  const trees=new Set(field.tree.map((x,i)=>id(x,[5,5,9,9,11,11][i])));
  return Array.from({length:W*H},(_,k)=>{
    const [x,y]=xy(k);
    if(k===throne)return 'throne';
    if(y===3)return field.gates.includes(x)?'gate':'wall';
    if((x===0||x===W-1)&&y<4)return 'wall';
    if(y<=2)return 'stone';
    if(y===H-1)return 'camp';
    if(rocks.has(k))return 'rock';
    if(trees.has(k))return 'tree';
    return x===5||y===7?'road':'grass';
  });
}
let layout=buildLayout(fronts[front]);
root.innerHTML='<header class="sl-head"><div class="sl-top"><div><b>노바르 점령전</b></div><button id="pause" aria-label="일시정지">Ⅱ</button><span class="sl-time" id="time">30:00</span></div><div class="sl-meter"><span class="sl-blue" id="blue"></span><span id="objective">성문 돌파</span><span class="sl-red" id="red"></span></div><div class="sl-score"><i id="balance"></i></div></header><section class="sl-panel sl-me"><button id="locate" aria-label="내 위치 찾기"><img id="myface" alt=""></button><div><div class="sl-me-name">기크 · 전사 <small>Lv. 52</small></div><div class="sl-hp"><i id="hp"></i></div><div class="sl-hp sl-mp"><i id="mp"></i></div></div><small id="myhp"></small></section><div class="sl-caption"><span>공격군 ● <span class="sl-blue">아군</span> / <span class="sl-red">적군</span></span><button id="view-toggle">전장 전체</button></div><div class="sl-frame"><div class="sl-viewport"><section class="sl-board" aria-label="점령전 격자 전장"><div class="sl-cells" id="cells"></div><div class="sl-units" id="units"></div></section></div><div class="sl-overlay" id="end" hidden><div><h2 id="endtitle"></h2><p id="enddesc"></p><button id="restart">다시 시작</button></div></div><div class="skill-fan" id="fan"></div><button type="button" class="retreat-orb" id="retreat" aria-label="진영으로 후퇴" title="진영으로 후퇴">↶</button><section class="sl-status"><strong id="state"></strong><span id="target"></span></section><section class="sl-panel" id="inspect" hidden><button id="close-info" aria-label="정보 닫기">×</button></section></div>';
const $=s=>document.getElementById(s),unitLayer=$('units');
for(let k=0;k<W*H;k++){const b=document.createElement('button');b.className='sl-cell '+layout[k];b.type='button';b.setAttribute('aria-label',layout[k]+' '+xy(k).join(','));if(layout[k]==='throne')b.textContent='♛';b.addEventListener('click',()=>choose(k));$('cells').append(b);cells.push(b);}
let message='', messageUntil=0, aiming=null;
const equipped=Array.from({length:3},()=>[true,true,true]);
function note(t){message=t;messageUntil=elapsed+1.1}
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
let inspectId = 0, overview = false, frost = [], beams = [], playerRole = 0;
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
function issueOrder(k, enemy=null){
  cancelTravel(me);me.cast=null;me.lastTarget=null;me.planAt=0;
  focus=enemy?.id??null;goal=k;
  render();
}
const attackRange=u=>[1,u!==me&&ready(u,0)?4:3,3][u.role];
function choose(k){
  if(ended||!alive(me)||!$('setup').hidden)return;
  if(aiming!==null){activate(aiming,k);return}
  const unit=units.find(v=>alive(v)&&id(...position(v).map(Math.round))===k)||occupied.get(k);
  if(unit){
    inspectId=unit.id;$('inspect').hidden=false;
    if(unit.team===me.team){render();return}
    issueOrder(unit.k,unit);return;
  }
  if(!terrainBlocks(k,me)||gates.get(k)>0){$('inspect').hidden=true;issueOrder(k)}
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
function damage(u,v,n){
  if(!alive(v))return;
  let amount=Math.round(n*(v.guard>elapsed?.65:1));
  if(v.shieldUntil>elapsed){const absorbed=Math.min(amount,v.shield);v.shield-=absorbed;amount-=absorbed}
  if(amount>0){
    if(!(v.trailUntil>elapsed))v.trailHp=v.hp;
    v.trailUntil=elapsed+.4;
    v.hp=Math.max(0,v.hp-amount);v.hitAt=elapsed;
  }
  if(v.hp===0){
    if(v===me)aiming=null;
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
const arrow='<path d="M9 39 35 13m-3-2 9-4-4 10-2-4zM9 33l-4 5 5-1-1 5 6-6"/>';
const shield='<path d="M24 5 39 11v11c0 9-6 15-15 21C15 37 9 31 9 22V11z"/>';
const iconShapes=[
  ['<path d="m10 39 22-24 9-8-4 13-23 23m-5-15 12 11"/>','<path d="m5 13 8 2m-9 8 10-1m-7 11 8-5"/>'+shield,shield+'<path d="M24 12v22m-8-14 8-8 8 8"/>'],
  ['<circle cx="24" cy="24" r="15"/><path d="M24 3v9m0 25v8M3 24h9m25 0h8"/>'+arrow,
   arrow+'<g stroke="#cbd6d0" stroke-width="3" fill="none" transform="rotate(-40 24 24)"><rect x="9" y="14" width="11" height="19" rx="5"/><rect x="17" y="21" width="15" height="9" rx="4"/><rect x="28" y="14" width="11" height="19" rx="5"/></g>',
   '<g transform="translate(-3 5) scale(.7)">'+arrow+'</g><g transform="translate(6 8) scale(.7)">'+arrow+'</g><g transform="translate(15 11) scale(.7)">'+arrow+'</g>'],
  ['<path fill="#d77a36" d="M25 3c4 12 14 12 14 25a15 15 0 0 1-30 0c0-6 4-11 8-16l1 9c5-4 8-11 7-18Z"/><path d="m20 35 4-11 6 7"/>','<path stroke="#bbe6ff" d="M24 4v40M7 14l34 20M7 34l34-20M18 8l6 6 6-6m-12 32 6-6 6 6M8 21l8-2-2-8m20 26-2-8 8-2"/>',shield+'<path fill="#9dd2f0" d="m24 13 7 10-7 10-7-10z"/>']
];
const slotButtons=[];
function buildSlots(){
  $('loadout').replaceChildren();$('fan').replaceChildren();slotButtons.length=0;
  skills[playerRole].forEach((skill,i)=>{
    const label=document.createElement('label'), input=document.createElement('input');
    input.type='checkbox';input.checked=equipped[playerRole][i];
    input.onchange=()=>{equipped[playerRole][i]=input.checked;slotButtons[i].hidden=!input.checked;$('start').disabled=!equipped[playerRole].some(Boolean)};
    label.append(input,skill);$('loadout').append(label);
    const b=document.createElement('button');b.type='button';b.className='skill-orb slot-'+i;b.hidden=!input.checked;
    b.setAttribute('aria-label',skill);b.title=skill;
    b.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconShapes[playerRole][i]+'</svg><i></i><b></b>';
    b.onclick=()=>activate(i);$('fan').append(b);slotButtons.push(b);
  });
  $('start').disabled=!equipped[playerRole].some(Boolean);
}
function updateSkills(){
  const fighting=running&&!ended&&alive(me);
  for(let i=0;i<slotButtons.length;i++){
    const button=slotButtons[i], left=Math.max(0,me.cd[i]-elapsed);
    button.disabled=!fighting||left>0||me.mp<14||me.stun>elapsed||!!me.cast;
    button.classList.toggle('aiming',aiming===i);
    button.style.setProperty('--cooldown',(360*left/cooldowns[me.role][i])+'deg');
    button.querySelector('b').textContent=left?Math.ceil(left):'';
    if(button.dataset.cooling==='yes'&&!left&&fighting)button.animate([{filter:'brightness(1.8)'},{filter:'brightness(1)'}],{duration:320});
    button.dataset.cooling=left?'yes':'no';
  }
  if(aiming!==null)$('state').textContent=skills[me.role][aiming]+' · 칸 선택';
  else if(message&&messageUntil>elapsed)$('state').textContent=message;
}
function validGround(k){
  return !terrainBlocks(k,me)&&visible(me,{k},3);
}
function activate(i,k=null){
  if(!running||ended||!alive(me)||!equipped[me.role][i])return;
  const reject=t=>{note(t);render()};
  if(!ready(me,i)||me.stun>elapsed||me.cast){reject(me.mp<14?'MP 부족':'아직 사용할 수 없습니다');return}
  const role=me.role, area=role===2&&i<2, self=role!==1&&i===2;
  if(area&&k===null){aiming=aiming===i?null:i;message='';render();return}
  if(area&&!validGround(k)){reject('사거리 안의 칸을 선택하세요');return}
  const range=role===0?1:[4,2,3][i];
  const nearby=units.filter(v=>alive(v)&&v.team!==me.team&&visible(me,v,range)).sort((a,b)=>dist(me.k,a.k)-dist(me.k,b.k));
  const enemy=focus!==null?units.find(v=>v.id===focus&&alive(v)):nearby.find(v=>v.id===me.lastTarget)||nearby[0];
  if(!area&&!self&&(!enemy||!visible(me,enemy,range))){reject('사거리 안에 대상이 없습니다');return}
  aiming=null;use(me,i);
  if(self){
    if(role===0)me.guard=elapsed+3;
    else{me.shield=me.max*.2;me.shieldUntil=elapsed+3}
  }else if(area){
    cancelTravel(me);
    if(i===0)me.cast={type:'fire',k,end:elapsed+.7};
    else frost.push({team:me.team,cells:[k,...near(k)].filter(n=>!terrainBlocks(n,me)),until:elapsed+2});
  }else{
    me.lastTarget=enemy.id;
    if(role===0){
      if(i===1){enemy.cast=null;cancelTravel(enemy);enemy.stun=elapsed+.6}
      beam(me,enemy);damage(me,enemy,power[0]*(i===0?1.6:1));
    }else if(i===0){cancelTravel(me);me.cast={type:'aim',v:enemy,end:elapsed+.8}}
    else if(i===1){cancelTravel(enemy);enemy.root=elapsed+1.2;beam(me,enemy,'arrow')}
    else{beam(me,enemy,'arrow');damage(me,enemy,power[1]*.7);damage(me,enemy,power[1]*.7)}
  }
  render();
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
  if(u===me){beam(u,v,['hit','arrow','magic'][r]);damage(u,v,power[r]);return}
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
  const team=Number(i>=sideSize), index=i%sideSize;
  const sample=team*10+(index%10),role=i===0?playerRole:sample%3;
  const name=index<10?names[sample]:extraNames[team*20+index-10];
  const max=role===0?1250:850;
  return {id:i,name,team,role,max,hp:max,mp:100,img:img(i),cp:[86210,79340,72640,77420,81210,80400,71200,76480,81670,79560,84520,80130,81250,76180,75240,84310,72690,81750,79300,78510][sample]+Math.floor(index/10)*733,cd:[0,0,0],stun:0,root:0,guard:0,shield:0,shieldUntil:0,attackAt:0,combo:0,lastTarget:null};
}
function reset(){
  document.querySelector('.sl-top b').textContent='노바르 · 제'+(front+1)+'전장';
  aiming=null;message='';messageUntil=0;$('inspect').hidden=true;$('halt').hidden=true;
  occupied.clear();reserved.clear();gates.clear();fronts[front].gates.forEach(x=>gates.set(id(x,3),2200));
  units=Array.from({length:sideSize*2},(_,i)=>createUnit(i));me=units[0];
  for(const u of units){
    const slot=u.id%sideSize, x=(slot+5)%10;
    place(u,id(x,u.team?4+Math.floor(slot/10):12-Math.floor(slot/10)));
  }
  elapsed=hold=0;goal=focus=null;gateLog=ended=false;running=false;owner='';inspectId=0;following=true;overview=false;frame.classList.remove('overview');$('view-toggle').textContent='전장 전체';
  kills=[0,0];logs=[];beams=[];frost=[];last=performance.now();for(const root of unitEmblems.splice(0))root.unmount();
  nodes.clear();unitLayer.replaceChildren();
  $('end').hidden=true;$('setup').hidden=false;$('pause').textContent='Ⅱ';$('myface').src=me.img;
  document.querySelector('.sl-me-name').textContent='기크 · '+roleNames[me.role];render();
}
function tick(dt){
  elapsed+=dt;frost=frost.filter(z=>z.until>elapsed);beams=beams.filter(b=>b.until>elapsed);
  for(const u of units){
    if(!alive(u)){
      if(elapsed>=u.respawnAt&&place(u,u.team?id(5,0):camp)){
        u.trailUntil=0;u.hp=u.max;u.mp=100;u.guard=elapsed+3;u.root=u.stun=u.shield=u.combo=0;u.attackAt=elapsed+2;
        if(u===me){goal=focus=null}
      }
      continue;
    }
    u.mp=Math.min(100,u.mp+dt*2);
    if(u.team===0&&xy(u.k)[1]===13)u.hp=Math.min(u.max,u.hp+dt*95);
    if(u.stun>elapsed)continue;
    if(u!==me)defend(u);
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
    const enemy=manual||foes.find(v=>visible(u,v,range));
    if(enemy&&visible(u,enemy,range)&&!(u===me&&goal!==null&&!manual)){strike(u,enemy,foes);continue}
    if(u.root>elapsed||(u===me&&goal===null))continue;
    let dest=u===me?goal:foes[0]?.k;
    if(u!==me&&u.team===0){
      const gate=id(fronts[front].gates[u.id%3],3);
      dest=gates.get(gate)>0?gate:throne;
    }
    if(dest==null)continue;
    if(gates.get(dest)>0&&u.team===0&&dist(u.k,dest)===1){
      if(elapsed>=u.attackAt){
        u.attackAt=elapsed+2.4;gates.set(dest,Math.max(0,gates.get(dest)-72));
        if(!gates.get(dest)){if(goal===dest&&focus===null)goal=null;gateLog=true;note('성문 돌파')}
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
  if(hold>=10||elapsed>=battleSeconds){
    ended=true;running=false;$('end').hidden=false;$('endtitle').textContent=hold>=10?'왕좌 점령 성공':'수비군 승리 · 시간 종료';
    $('enddesc').textContent='아군 처치 '+kills[0]+' · 적군 처치 '+kills[1];
  }
}
const board=document.querySelector('.sl-board');
const frame=board.closest('.sl-frame'), viewport=board.parentElement;
frame.insertAdjacentHTML('beforeend','<section id="setup" class="sl-overlay"><div><h2>출전 준비</h2><label>전장 <select id="front"></select></label> <label>직업 <select id="profession"><option>전사</option><option>궁수</option><option>마법사</option></select></label><p id="loadout"></p><button id="start">스킬 등록 · 전투 시작</button></div></section>');
frame.insertAdjacentHTML('beforeend','<section class="sl-overlay" id="halt" hidden><div><h2>일시정지</h2><p id="registered"></p><button id="resume">계속하기</button> <button id="reset">출전 준비</button> <a href="./">게임으로</a></div></section>');
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
function render(){
  const left=Math.max(0,Math.ceil(battleSeconds-elapsed));
  $('time').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const counts=[0,1].map(t=>units.filter(u=>alive(u)&&u.team===t).length);
  $('blue').textContent='공격군 '+counts[0]+'명';$('red').textContent='수비군 '+counts[1]+'명';
  $('balance').style.width=counts[0]/(counts[0]+counts[1]||1)*100+'%';
  $('objective').textContent=hold?'왕좌 각인 '+hold.toFixed(1)+'초':gateLog?'왕좌 진입':'성문 돌파';
  $('hp').style.width=me.hp/me.max*100+'%';$('mp').style.width=me.mp+'%';$('hp').style.background=hpColor(me.hp/me.max);
  $('myhp').textContent='HP '+Math.ceil(me.hp).toLocaleString('ko-KR')+' / '+me.max.toLocaleString('ko-KR');
  const target=units.find(u=>alive(u)&&u.id===focus);
  const routePreview=me.trip?.path??(goal!==null&&alive(me)?routes(me,blocked(goal,me)||occupied.has(goal)?near(goal):[goal]):null);
  const actual=target||units.find(u=>alive(u)&&u.id===me.lastTarget&&visible(me,u,attackRange(me))&&me.attackAt>elapsed&&goal===null);
  const inspected=units[inspectId]||me;
  if(infoTeam!==inspected.team){
    infoTeam=inspected.team;
    renderGuildEmblem(infoRoot,guilds[infoTeam],28);
  }
  infoText.textContent='살펴보는 '+(inspected===me?'나':inspected.team?'적군':'아군')+' · '+inspected.name+' · '+roleNames[inspected.role]+'　'+guilds[inspected.team].name+' 원정단 · 전투력 '+cp(inspected)+(alive(inspected)?'':' · 부활 대기');
  $('state').textContent=!alive(me)?'부활까지 '+Math.max(0,Math.ceil(me.respawnAt-elapsed))+'초':me.trip?.path.length>1?'아군 통과 중':actual?(actual.name+(visible(me,actual,attackRange(me))?' 공격 중':' 추적 중')):gates.get(goal)>0?(dist(me.k,goal)===1?'성문 공격 중':'성문으로 이동 중'):goal!==null?'목적지로 이동 중':'현재 위치 방어 중';
  $('target').textContent=alive(me)&&actual?'HP '+Math.ceil(actual.hp/actual.max*100)+'%':gates.get(goal)>0?'성문 '+Math.ceil(gates.get(goal)/2200*100)+'%':'';
  const fire=units.filter(u=>u.cast?.type==='fire').map(u=>u.cast.k);
  for(let k=0;k<cells.length;k++){
    const c=cells[k];c.classList.toggle('spell-range',aiming!==null&&validGround(k));c.classList.toggle('route',!!routePreview?.includes(k));c.classList.toggle('goal',!target&&goal===k);
    c.classList.toggle('ice',frost.some(z=>z.cells.includes(k)));
    c.classList.toggle('warn',fire.some(p=>dist(k,p)<=1));c.classList.toggle('center',fire.includes(k));
    if(!gates.has(k)&&layout[k]!=='throne')c.textContent=goal===k&&!target?'⚑':'';
    if(gates.has(k)){const h=gates.get(k);c.classList.toggle('open',!h);c.textContent=h?Math.ceil(h/2200*100)+'%':'개방'}
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
      n.querySelector('img').src=u.img;n.querySelector('.sl-role').textContent=roleIcon[u.role];
      n.querySelector('.sl-role').title=roleNames[u.role];unitLayer.append(n);nodes.set(u.id,n);
    }
    n.hidden=false;
    const [x,y]=position(u);
    n.className='sl-unit'+(u===me?' me':'')+(u.team?' red':'')+(u===actual?' focus':'')+(x<1?' left-edge':x>W-2?' right-edge':'')+(y<.7?' top-edge':y>H-1.7?' last-row':'');
    n.querySelector('.sl-token').classList.toggle('red',!!u.team);
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
  updateSkills();

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
    cells[k].className='sl-cell '+layout[k];
    cells[k].textContent=k===throne?'♛':'';
    cells[k].setAttribute('aria-label',layout[k]+' '+xy(k).join(','));
  }
  reset();
};
$('profession').onchange=()=>{playerRole=$('profession').selectedIndex;reset();buildSlots()};
$('start').onclick=()=>{$('setup').hidden=true;running=true;trackPlayer(true);last=performance.now();note('점령전 시작 · 아군 30명 / 적군 30명')};

$('retreat').onclick=()=>{if(running&&!ended&&alive(me)&&$('setup').hidden){aiming=null;const camps=layout.flatMap((tile,k)=>tile==='camp'&&!blocked(k,me)&&(!occupied.has(k)||k===me.k)?[k]:[]);const path=routes(me,camps);if(path)issueOrder(path.at(-1)??me.k)}};
$('pause').onclick=()=>{if(!running||ended)return;running=false;aiming=null;$('halt').hidden=false;$('registered').textContent=skills[me.role].filter((_,i)=>equipped[me.role][i]).join(' · ');render()};
$('resume').onclick=()=>{$('halt').hidden=true;running=true;last=performance.now();render()};
$('close-info').onclick=()=>{$('inspect').hidden=true};
$('reset').onclick=$('restart').onclick=reset;
buildSlots();
reset();
new ResizeObserver(()=>render()).observe(board);
setInterval(()=>{const now=performance.now(),dt=Math.min(.25,(now-last)/1000);last=now;if(running&&!ended){tick(dt);render()}},100);
