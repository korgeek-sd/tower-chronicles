import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{GuildEmblem,GuildEmblemEditor,DEFAULT_GUILD_EMBLEM,type GuildEmblemData}from'../components/association/GuildEmblem';
import'../components/association/guildCreationPage.css';
import'./lab.css';

type Role='leader'|'member'|'none';
type View='directory'|'create'|'hq'|'growth'|'boss'|'auction'|'shop'|'warehouse'|'territory'|'occupation'|'rankings'|'members'|'applications'|'activity'|'manage'|'chat';
type Group='base'|'combat'|'land'|'assets'|'people';
type Material='herb'|'pepper'|'potato'|'wheat';
type Person={id:number;name:string;className:'warrior'|'mage'|'archer';role:'LEADER'|'MEMBER'};
type Auction={id:number;name:string;type:'equipment'|'material';bid:number;owner:string;highest:string;status:'active'|'complete'};
type ChatLine={id:number;name:string;guild:string;job:'warrior'|'mage'|'archer';text:string;channel:'world'|'guild';time:string};
type Data={
 name:string;description:string;notice:string;emblem:GuildEmblemData;
 policy:'APPROVAL'|'OPEN'|'CLOSED';share:number;level:number;xp:number;
 silver:number;gold:number;contribution:number;treasurySilver:number;treasuryGold:number;tickets:number;
 members:Person[];applications:Person[];activity:string[];
 materials:Record<Material,number>;personalMaterials:Record<Material,number>;
 purchased:Record<string,number>;bossHp:number;weeklyHp:number;attacks:number;
 owned:string[];taxes:Record<string,number>;deployments:number[];
 auctions:Auction[];chat:ChatLine[];
};
const gold=(n:number)=>Math.max(0,Math.trunc(n)).toLocaleString('ko-KR');
const classLabel={warrior:'전사',mage:'마법사',archer:'궁수'} as const;
const materialNames:Record<Material,string>={herb:'약초',pepper:'고추',potato:'감자',wheat:'밀'};
const materials:Material[]=['herb','pepper','potato','wheat'];
const towns=[
 {id:'herb-1',name:'달그늘',kind:'약초 마을',owner:'검은 새벽'},
 {id:'farm-1',name:'황금들',kind:'농경 마을',owner:'푸른 기사단'},
 {id:'farm-2',name:'보리뜰',kind:'농경 마을',owner:'붉은 달'},
 {id:'herb-2',name:'이슬숲',kind:'약초 마을',owner:'검은 새벽'},
 {id:'city',name:'노바르',kind:'중앙 도시',owner:'철의 맹세'}
];
const groups:{id:Group;label:string;items:{id:View;name:string}[]}[]=[
 {id:'base',label:'본부',items:[{id:'hq',name:'본부'},{id:'growth',name:'성장·기부'},{id:'rankings',name:'랭킹'},{id:'activity',name:'활동 기록'}]},
 {id:'combat',label:'전투',items:[{id:'boss',name:'원정단 보스'},{id:'occupation',name:'점령전'}]},
 {id:'land',label:'영지',items:[{id:'territory',name:'영지 관리'}]},
 {id:'assets',label:'자산',items:[{id:'warehouse',name:'금고·재료'},{id:'shop',name:'공헌도 상점'},{id:'auction',name:'경매'}]},
 {id:'people',label:'단원',items:[{id:'members',name:'단원 명단'},{id:'applications',name:'가입 신청'},{id:'manage',name:'원정단 관리'},{id:'chat',name:'원정단 채팅'}]}
];
const products=[
 {id:'vitality',name:'활력 회복 물약',cost:100,limit:3,level:1,reset:'일일 보급',icon:'✧'},
 {id:'stone',name:'강화석 꾸러미',cost:180,limit:2,level:1,reset:'일일 보급',icon:'◈'},
 {id:'silverbox',name:'실버 보급 상자',cost:250,limit:1,level:2,reset:'일일 보급',icon:'▣'},
 {id:'goldbox',name:'골드 보급 상자',cost:600,limit:1,level:3,reset:'주간 보급',icon:'◆'},
 {id:'ticket',name:'원정 도전권',cost:400,limit:2,level:2,reset:'주간 보급',icon:'▤'},
 {id:'summon',name:'직능 소환권',cost:750,limit:1,level:4,reset:'주간 보급',icon:'✦'}
];
function fresh():Data{return{
 name:'검은 새벽',description:'탑의 끝을 향해 함께 나아가는 원정단입니다.',notice:'점령전 준비는 매주 토요일 20:30까지 부탁드립니다.',
 emblem:{...DEFAULT_GUILD_EMBLEM,symbol:'knight',base:'#942f3c',accent:'#d7b878'},
 policy:'APPROVAL',share:10,level:4,xp:640,silver:5400000,gold:320,contribution:1250,
 treasurySilver:318400,treasuryGold:40,tickets:12,
 members:[{id:1,name:'기크',className:'warrior',role:'LEADER'},{id:2,name:'루시안',className:'mage',role:'MEMBER'},{id:3,name:'설화',className:'archer',role:'MEMBER'},{id:4,name:'회색늑대',className:'warrior',role:'MEMBER'}],
 applications:[{id:5,name:'떠돌이검객',className:'archer',role:'MEMBER'},{id:6,name:'별빛',className:'mage',role:'MEMBER'}],
 activity:['원정단이 달그늘 점령에 성공했습니다.','루시안이 공헌도 200을 획득했습니다.','길드 공지사항이 수정되었습니다.','원정단이 이슬숲 점령에 성공했습니다.'],
 materials:{herb:85,pepper:42,potato:120,wheat:68},
 personalMaterials:{herb:36,pepper:15,potato:24,wheat:12},
 purchased:{},bossHp:7600,weeklyHp:60000,attacks:5,owned:['herb-1','herb-2'],taxes:{'herb-1':10,'herb-2':10},deployments:[],
 auctions:[{id:1,name:'전설 장검',type:'equipment',bid:145000,owner:'원정단 금고',highest:'루시안',status:'active'},{id:2,name:'밀 50개',type:'material',bid:14000,owner:'검은 새벽',highest:'설화',status:'active'}],
 chat:[{id:1,name:'루시안',guild:'검은 새벽',job:'mage',text:'이번 주 점령전 참여하실 분?',channel:'guild',time:'21:42'},{id:2,name:'기크',guild:'검은 새벽',job:'warrior',text:'저 참여합니다.',channel:'guild',time:'21:43'},{id:3,name:'설화',guild:'검은 새벽',job:'archer',text:'영지 세금 비율은 몇 퍼센트인가요?',channel:'guild',time:'21:44'},{id:4,name:'붉은기사',guild:'붉은 달',job:'warrior',text:'황금들에서 만나요.',channel:'world',time:'21:45'}]
};}
const key='tower-guild-lab-2026-v1';
function initial():{data:Data;role:Role}{
 try{const raw=localStorage.getItem(key);if(raw){const x=JSON.parse(raw);if(x?.data?.members&&x?.data?.emblem&&['leader','member','none'].includes(x.role))return x;}}catch{}
 return{data:fresh(),role:'leader'};
}
function JobTag({job}:{job:ChatLine['job']}){return <small className={'gl-job '+job}>{classLabel[job]}</small>;}
function Crest({value,size=42}:{value:GuildEmblemData;size?:number}){return <GuildEmblem value={value} size={size}/>}
function App(){
 const[initialData]=useState(initial);
 const[data,setData]=useState<Data>(initialData.data);
 const[role,setRole]=useState<Role>(initialData.role);
 const[view,setView]=useState<View>(initialData.role==='none'?'directory':'hq');
 const[toast,setToast]=useState('');
 const[query,setQuery]=useState('');
 const[createName,setCreateName]=useState('');
 const[createDesc,setCreateDesc]=useState('');
 const[createPolicy,setCreatePolicy]=useState<'APPROVAL'|'OPEN'>('APPROVAL');
 const[createEmblem,setCreateEmblem]=useState<GuildEmblemData>({...DEFAULT_GUILD_EMBLEM});
 const[donation,setDonation]=useState(10000);
 const[resource,setResource]=useState<'SILVER'|'GOLD'>('SILVER');
 const[walletMode,setWalletMode]=useState<'deposit'|'withdraw'>('deposit');
 const[walletAmount,setWalletAmount]=useState(1000);
 const[mat,setMat]=useState<Material>('herb');
 const[matDirection,setMatDirection]=useState<'deposit'|'withdraw'>('deposit');
 const[matAmount,setMatAmount]=useState(10);
 const[shopTab,setShopTab]=useState<'all'|'daily'|'weekly'>('all');
 const[chosenTown,setChosenTown]=useState('herb-1');
 const[chosenBoss,setChosenBoss]=useState<'daily'|'weekly'>('daily');
 const[rankMode,setRankMode]=useState<'종합'|'영지'|'공성전'|'성장'>('종합');
 const[bid,setBid]=useState<Record<number,number>>({});
 const[noticeDraft,setNoticeDraft]=useState(data.notice);
 const[descriptionDraft,setDescriptionDraft]=useState(data.description);
 const[policyDraft,setPolicyDraft]=useState<Data['policy']>(data.policy);
 const[shareDraft,setShareDraft]=useState(data.share);
 const[chatMode,setChatMode]=useState<'guild'|'world'>('guild');
 const[chatDraft,setChatDraft]=useState('');
 const[warTown,setWarTown]=useState('farm-1');
 const[warSelected,setWarSelected]=useState<number|null>(null);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({data,role}));}catch{}},[data,role]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3800);return()=>clearTimeout(timer);},[toast]);
 const set=(patch:Partial<Data>)=>setData(old=>({...old,...patch}));
 const notify=(message:string)=>setToast(message);
 const event=(message:string)=>{setData(old=>({...old,activity:[message,...old.activity].slice(0,30)}));notify(message);};
 const go=(page:View)=>{setView(page);window.scrollTo({top:0,behavior:'instant'});};
 const selectedGroup=groups.find(g=>g.items.some(i=>i.id===view))??groups[0];
 const isLeader=role==='leader',hasGuild=role!=='none';
 const owned=data.owned.length;
 const rankList=[
  {name:data.name,score:936,land:owned,wins:8,level:data.level,emblem:data.emblem},
  {name:'철의 맹세',score:920,land:1,wins:11,level:5,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#2f4f80',symbol:'crown'}},
  {name:'붉은 달',score:836,land:1,wins:6,level:4,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#624075',symbol:'moon'}},
  {name:'푸른 기사단',score:790,land:0,wins:9,level:3,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#386148',symbol:'shield'}}
 ];
 const sortedRank=[...rankList].sort((a,b)=>rankMode==='영지'?b.land-a.land:rankMode==='공성전'?b.wins-a.wins:rankMode==='성장'?b.level-a.level:b.score-a.score);
 const updateRole=(next:Role)=>{setRole(next);go(next==='none'?'directory':'hq');notify(next==='leader'?'단장 시점으로 전환했습니다.':next==='member'?'단원 시점으로 전환했습니다.':'미가입 시점으로 전환했습니다.');};
 function createGuild(){
  const name=createName.trim();
  if(name.length<2||name.length>20){notify('원정단명은 2~20자로 입력해 주세요.');return;}
  if(data.silver<1000){notify('창설 비용이 부족합니다.');return;}
  setData(old=>({...old,name,description:createDesc.trim(),notice:'새 원정단에 오신 것을 환영합니다.',emblem:createEmblem,policy:createPolicy,share:0,level:1,xp:0,silver:old.silver-1000,treasurySilver:0,treasuryGold:0,contribution:0,members:[{id:1,name:'기크',className:'warrior',role:'LEADER'}],applications:[],activity:['원정단 '+name+'이 창설되었습니다.'],owned:[],bossHp:10000,weeklyHp:80000}));
  setNoticeDraft('새 원정단에 오신 것을 환영합니다.');setDescriptionDraft(createDesc.trim());setRole('leader');go('hq');notify(name+' 창설 완료 (모의 데이터)');
 }
 function joinDemo(name:string,policy:Data['policy']){
  if(policy==='CLOSED'){notify('현재 모집을 중지한 원정단입니다.');return;}
  if(policy==='APPROVAL'){notify(name+' 가입 신청을 보냈습니다. (모의)');return;}
  setData(old=>({...old,name,emblem:{...old.emblem,base:'#2f4f80',symbol:'shield'},members:[...old.members.filter(x=>x.id!==1),{id:1,name:'기크',role:'MEMBER',className:'warrior'}]}));
  setRole('member');go('hq');notify(name+' 원정단에 가입했습니다. (모의)');
 }
 function donate(){
  if(!hasGuild)return;
  if(donation<=0){notify('기부 금액을 확인해 주세요.');return;}
  if(resource==='SILVER'){
   if(data.silver<donation){notify('보유 실버가 부족합니다.');return;}
   setData(old=>({...old,silver:old.silver-donation,treasurySilver:old.treasurySilver+donation,contribution:old.contribution+Math.floor(donation/100),xp:old.xp+Math.floor(donation/100),level:old.xp+Math.floor(donation/100)>=1000?old.level+1:old.level,activity:['실버 '+gold(donation)+' 기부',...old.activity]}));
  }else{
   if(data.gold<donation){notify('보유 골드가 부족합니다.');return;}
   setData(old=>({...old,gold:old.gold-donation,treasuryGold:old.treasuryGold+donation,contribution:old.contribution+donation*2,xp:old.xp+donation*2,activity:['골드 '+gold(donation)+' 기부',...old.activity]}));
  }
  notify('기부 및 공헌도 획득 처리 완료 (모의)');
 }
 function transfer(){
  const n=Math.floor(walletAmount);if(n<=0){notify('수량을 입력해 주세요.');return;}
  if(walletMode==='withdraw'&&!isLeader){notify('단장만 금고에서 출금할 수 있습니다.');return;}
  if(resource==='SILVER'){
   if(walletMode==='deposit'&&data.silver<n||walletMode==='withdraw'&&data.treasurySilver<n){notify('잔액이 부족합니다.');return;}
   setData(old=>({...old,silver:old.silver+(walletMode==='deposit'?-n:n),treasurySilver:old.treasurySilver+(walletMode==='deposit'?n:-n)}));
  }else{
   if(walletMode==='deposit'&&data.gold<n||walletMode==='withdraw'&&data.treasuryGold<n){notify('잔액이 부족합니다.');return;}
   setData(old=>({...old,gold:old.gold+(walletMode==='deposit'?-n:n),treasuryGold:old.treasuryGold+(walletMode==='deposit'?n:-n)}));
  }
  event((walletMode==='deposit'?'입금':'출금')+' '+gold(n)+(resource==='SILVER'?' S':' G'));
 }
 function transferMaterial(){
  const n=Math.floor(matAmount);
  if(n<=0){notify('수량을 확인해 주세요.');return;}
  if(matDirection==='withdraw'&&!isLeader){notify('단장만 재료를 출고할 수 있습니다.');return;}
  const available=matDirection==='deposit'?data.personalMaterials[mat]:data.materials[mat];
  if(n>available){notify('재료 보유량이 부족합니다.');return;}
  setData(old=>({...old,materials:{...old.materials,[mat]:old.materials[mat]+(matDirection==='deposit'?n:-n)},personalMaterials:{...old.personalMaterials,[mat]:old.personalMaterials[mat]+(matDirection==='deposit'?-n:n)}}));
  event(materialNames[mat]+' '+n+'개 '+(matDirection==='deposit'?'입고':'출고'));
 }
 function buy(id:string){
  const item=products.find(x=>x.id===id);if(!item)return;
  if(data.level<item.level){notify('원정단 레벨이 부족합니다.');return;}
  if((data.purchased[id]??0)>=item.limit){notify('구매 횟수 제한입니다.');return;}
  if(data.contribution<item.cost){notify('공헌도가 부족합니다.');return;}
  setData(old=>({...old,contribution:old.contribution-item.cost,purchased:{...old.purchased,[id]:(old.purchased[id]??0)+1},activity:[item.name+' 구매',...old.activity]}));
  notify(item.name+' 구매 완료 (모의)');
 }
 function attack(){
  if(data.attacks===0){notify('오늘의 보스 공격 횟수를 모두 사용했습니다.');return;}
  const damage=chosenBoss==='daily'?1200:5300;
  const oldHp=chosenBoss==='daily'?data.bossHp:data.weeklyHp;
  if(oldHp<=0){notify('이미 토벌 완료한 보스입니다.');return;}
  setData(old=>({...old,attacks:old.attacks-1,...(chosenBoss==='daily'?{bossHp:Math.max(0,old.bossHp-damage)}:{weeklyHp:Math.max(0,old.weeklyHp-damage)}),activity:['원정단 보스 '+gold(damage)+' 피해',...old.activity]}));
  notify('보스에게 '+gold(damage)+' 피해를 주었습니다.');
 }
 function bidOn(a:Auction){
  const amount=bid[a.id]??a.bid+1000;
  if(amount<=a.bid){notify('현재 입찰가보다 높게 입력해 주세요.');return;}
  if(data.silver<amount){notify('입찰 실버가 부족합니다.');return;}
  setData(old=>({...old,auctions:old.auctions.map(x=>x.id===a.id?{...x,bid:amount,highest:'기크'}:x)}));event(a.name+'에 '+gold(amount)+' S 입찰');
 }
 function settleWar(){
  if(warSelected===null){notify('전선을 먼저 선택해 주세요.');return;}
  if(data.deployments.includes(warSelected)){notify('이미 병력을 배치한 전선입니다.');return;}
  setData(old=>({...old,deployments:[...old.deployments,warSelected]}));notify((warSelected+1)+'번 전선 배치 완료 (모의)');
 }
 function winWar(){
  const t=towns.find(x=>x.id===warTown);if(!t)return;
  if(!data.owned.includes(warTown)){setData(old=>({...old,owned:[...old.owned,warTown],taxes:{...old.taxes,[warTown]:10},activity:[t.name+' 점령 성공 (모의)',...old.activity]}));notify(t.name+' 점령 성공 (모의)');}
  else notify('이미 보유한 영지입니다.');
 }
 function reset(){
  if(!window.confirm('모의 데이터를 처음 상태로 되돌리시겠습니까? 실제 게임 데이터에는 영향이 없습니다.'))return;
  setData(fresh());setRole('leader');setView('hq');setNoticeDraft(fresh().notice);setDescriptionDraft(fresh().description);setWarSelected(null);setToast('실험 상태를 초기화했습니다.');
 }
 const directory=[
 {name:'철의 맹세',count:24,policy:'APPROVAL' as const,desc:'탑의 가장 높은 곳을 향한 원정단',emblem:{...DEFAULT_GUILD_EMBLEM,base:'#2f4f80',symbol:'crown'}},
 {name:'푸른 기사단',count:12,policy:'OPEN' as const,desc:'초보자 환영, 함께 성장하는 원정단',emblem:{...DEFAULT_GUILD_EMBLEM,base:'#386148',symbol:'shield'}},
 {name:'붉은 달',count:18,policy:'CLOSED' as const,desc:'보스전과 점령전을 함께합니다.',emblem:{...DEFAULT_GUILD_EMBLEM,base:'#624075',symbol:'moon'}}
 ];
 return <div className="gl-app">
  <div className="gl-phone">
   <div className="gl-top">
    <div className="gl-brand"><span>탑의 기록</span><small>THE TOWER CHRONICLES</small></div>
    <div className="gl-top-note">독립 UI 실험실 <em>DEMO</em></div>
   </div>
   <div className="gl-sandbox">
    <span>실제 게임과 분리된 모의 환경</span>
    <div className="gl-scenario" role="group" aria-label="실험할 사용자 상태">
     {([['leader','단장'],['member','단원'],['none','미가입']] as [Role,string][]).map(([r,label])=><button type="button" key={r} className={role===r?'active':''} aria-pressed={role===r} onClick={()=>updateRole(r)}>{label}</button>)}
     <button type="button" className="gl-reset" onClick={reset} title="실험 데이터 초기화">초기화</button>
    </div>
   </div>
   {hasGuild&&view!=='create'&&view!=='directory'?<header className="gl-header">
    <div className="gl-identity"><Crest value={data.emblem} size={50}/><div><small>원정단 · No. 027</small><strong>{data.name}</strong><div className="gl-level">Lv.{data.level} <span><i style={{width:Math.min(100,data.xp%1000/10)+'%'}}/></span><small>{data.xp%1000}/1000</small></div></div></div>
    <button onClick={()=>go('chat')} aria-label="원정단 채팅으로 이동">채팅</button>
   </header>:null}
   {hasGuild&&view!=='create'&&view!=='directory'?<><nav className="gl-groups" aria-label="원정단 대분류">{groups.map(g=><button type="button" className={selectedGroup.id===g.id?'active':''} aria-pressed={selectedGroup.id===g.id} onClick={()=>go(g.items[0].id)} key={g.id}>{g.label}</button>)}</nav><nav className="gl-subnav" aria-label="원정단 세부 메뉴">{selectedGroup.items.map(item=><button type="button" key={item.id} className={view===item.id?'active':''} aria-current={view===item.id?'page':undefined} onClick={()=>go(item.id)}>{item.name}{item.id==='applications'&&data.applications.length>0?' ('+data.applications.length+')':''}</button>)}</nav></>:null}
   <main className={'gl-main '+(view==='create'?'gl-main-create':'')} key={view}>
    {view==='directory'&&<><div className="gl-pagehead"><div><small>NOVAR COMPANY REGISTRY</small><h1>원정단 찾기</h1></div><button onClick={()=>go('create')} className="gl-button gold">새 원정단 창설</button></div><p className="gl-muted">원정단을 선택해 가입하거나 직접 창설할 수 있습니다.</p><input className="gl-input" aria-label="원정단 검색" placeholder="원정단 이름 검색" value={query} onChange={e=>setQuery(e.target.value)}/>{directory.filter(x=>x.name.includes(query)).map(x=><article className="gl-card gl-directory-item" key={x.name}><Crest value={x.emblem} size={58}/><div><strong>{x.name}</strong><small>{x.count}/30명 · {x.policy==='OPEN'?'자유 가입':x.policy==='APPROVAL'?'승인 가입':'모집 중지'}</small><p>{x.desc}</p></div><button onClick={()=>joinDemo(x.name,x.policy)} disabled={x.policy==='CLOSED'}>{x.policy==='OPEN'?'가입':x.policy==='APPROVAL'?'신청':'마감'}</button></article>)}</>}
    {view==='create'&&<><div className="gl-pagehead"><div><small>ASSOCIATION CHARTER</small><h1>원정단 창설</h1></div><button onClick={()=>go('directory')} className="gl-button">목록으로</button></div>
     <div className="gl-create-preview gl-card"><Crest value={createEmblem} size={89}/><div><small>창설 문장 · 미리보기</small><strong>{createName||'새 원정단'}</strong><p>{createDesc||'원정단을 소개해 주세요.'}</p></div></div>
     <section className="gl-card gl-form"><h2>원정단 정보</h2><label>원정단명 <input className="gl-input" maxLength={20} value={createName} onChange={e=>setCreateName(e.target.value)} placeholder="2~20자"/></label><label>소개 <textarea maxLength={120} value={createDesc} onChange={e=>setCreateDesc(e.target.value)} placeholder="원정단 소개"/></label><label>가입 방식 <select className="gl-input" value={createPolicy} onChange={e=>setCreatePolicy(e.target.value as 'OPEN'|'APPROVAL')}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option></select></label></section>
     <div className="tc-guild-create-screen gl-crest-editor"><GuildEmblemEditor value={createEmblem} onChange={setCreateEmblem} layout="charter"/></div>
     <div className="gl-create-pay"><span>창설 비용</span><strong>1,000 S</strong></div><button className="gl-button gold gl-wide" onClick={createGuild} disabled={createName.trim().length<2||data.silver<1000}>원정단 창설하기</button>
    </>}
    {view==='hq'&&<><section className="gl-home-banner" style={{backgroundImage:'linear-gradient(#11171935,#151214e6),url('+import.meta.env.BASE_URL+'assets/backgrounds/association/guild-courtyard-v3.webp)'}}><div className="gl-scene-top"><small>EXPEDITION COMPANY HEADQUARTERS</small><h1>원정단 본부</h1><p>{data.notice}</p></div><div className="gl-scene-links">{([{id:'boss',name:'보스전'},{id:'occupation',name:'점령전'},{id:'territory',name:'영지 관리'},{id:'shop',name:'원정단 상점'},{id:'warehouse',name:'원정단 금고'},{id:'auction',name:'원정단 경매'}] as {id:View;name:string}[]).map(item=><button onClick={()=>go(item.id)} key={item.id}>{item.name}<span>›</span></button>)}</div></section>
     <div className="gl-statgrid"><div><small>단원</small><strong>{data.members.length} / 30</strong></div><div><small>보유 영지</small><strong>{owned} / 5</strong></div><div><small>금고 실버</small><strong>{gold(data.treasurySilver)}</strong></div></div>
     <div className="gl-card gl-quick"><div><strong>원정단 성장</strong><small>공헌도를 얻고 원정단 레벨을 높이세요.</small></div><button onClick={()=>go('growth')}>기부하기</button></div>
     <div className="gl-card gl-quick"><div><strong>원정단 공지</strong><small>{data.notice}</small></div>{isLeader&&<button onClick={()=>go('manage')}>수정</button>}</div>
     <div className="gl-card gl-quick"><div><strong>원정단 채팅</strong><small>단원들과 대화를 나누세요.</small></div><button onClick={()=>go('chat')}>열기</button></div>
    </>}
    {view==='growth'&&<><div className="gl-pagehead"><div><small>GUILD PROGRESSION</small><h1>원정단 성장 · 기부</h1></div></div>
     <section className="gl-card"><div className="gl-statgrid"><div><small>원정단 레벨</small><strong>Lv.{data.level}</strong></div><div><small>내 공헌도</small><strong>{gold(data.contribution)}</strong></div></div><div className="gl-meter"><i style={{width:Math.min(100,data.xp%1000/10)+'%'}}/></div><p className="gl-muted">{data.xp%1000} / 1,000 경험치 (모의 성장 수치)</p></section>
     <section className="gl-card gl-form"><h2>재화 기부</h2><div className="gl-switch">{(['SILVER','GOLD'] as const).map(x=><button key={x} className={resource===x?'active':''} onClick={()=>{setResource(x);setDonation(x==='GOLD'?100:10000);}}>{x==='SILVER'?'실버':'골드'}</button>)}</div><p className="gl-muted">보유 {resource==='SILVER'?'실버 '+gold(data.silver):'골드 '+gold(data.gold)}</p><input className="gl-input" type="number" min="1" value={donation} onChange={e=>setDonation(Math.max(0,Number(e.target.value)||0))}/><button className="gl-button gold gl-wide" onClick={donate}>기부하고 공헌도 받기</button></section>
    </>}
    {view==='boss'&&<><div className="gl-pagehead"><div><small>GUILD RAID</small><h1>원정단 보스전</h1></div><span className="gl-pill">남은 공격 {data.attacks}/5</span></div>
     <div className="gl-switch">{(['daily','weekly'] as const).map(x=><button key={x} className={chosenBoss===x?'active':''} onClick={()=>setChosenBoss(x)}>{x==='daily'?'일일 보스':'주간 보스'}</button>)}</div>
     <section className="gl-boss-stage"><small>{chosenBoss==='daily'?'DAILY RAID':'WEEKLY RAID'}</small><h2>{chosenBoss==='daily'?'굶주린 성자':'성당을 짊어진 거인'}</h2><div className="gl-boss-figure" style={{backgroundImage:'url(./assets/monsters/guild-bosses/'+(chosenBoss==='daily'?'famished_saint':'cathedral_bearer')+'-left.webp)'}}/><div className="gl-meter"><i style={{width:Math.max(0,(chosenBoss==='daily'?data.bossHp/10000:data.weeklyHp/80000)*100)+'%'}}/></div><p>HP {gold(chosenBoss==='daily'?data.bossHp:data.weeklyHp)} / {gold(chosenBoss==='daily'?10000:80000)}</p><button className="gl-button gold gl-wide" disabled={data.attacks===0||(chosenBoss==='daily'?data.bossHp:data.weeklyHp)<=0} onClick={attack}>보스 공격</button></section><p className="gl-muted">모의 전투입니다. 공격 횟수와 체력이 변경되고 기록에 반영됩니다.</p>
    </>}
    {view==='occupation'&&<><div className="gl-pagehead"><div><small>OCCUPATION WAR</small><h1>점령전 실험</h1></div><span className="gl-pill">5개 영지</span></div><section className="gl-card gl-form"><h2>공격 대상 영지</h2><select className="gl-input" value={warTown} onChange={e=>{setWarTown(e.target.value);setWarSelected(null);}}>{towns.map(t=><option value={t.id} key={t.id}>{t.name} · {t.kind}</option>)}</select><p className="gl-muted">5개 전선 중 하나를 선택해 병력을 배치해 보세요.</p><div className="gl-front-grid">{Array.from({length:5},(_,i)=><button className={warSelected===i?'active':''} onClick={()=>setWarSelected(i)} key={i}><b>{i+1}번 전선</b><span>{data.deployments.includes(i)?'병력 배치됨':'미배치'}</span></button>)}</div><button className="gl-button gold gl-wide" onClick={settleWar}>선택 전선 병력 배치</button></section>
     <section className="gl-card"><h2>전투 결과 시뮬레이션</h2><p className="gl-muted">서버의 승패 판정을 실행하지 않고, 선택 영지의 점령 성공 화면과 영지 상태를 체험합니다.</p><button className="gl-button gl-wide" onClick={winWar}>선택 영지 점령 성공 처리 (모의)</button></section></>}
    {view==='territory'&&<><div className="gl-pagehead"><div><small>GUILD TERRITORY</small><h1>영지 관리</h1></div><span className="gl-pill">보유 {owned}/5</span></div><div className="gl-territory-list">{towns.map(t=><button className={chosenTown===t.id?'selected':''} key={t.id} onClick={()=>setChosenTown(t.id)}><strong>{t.name}</strong><small>{t.kind}</small><span>{data.owned.includes(t.id)?'우리 원정단':'타 원정단'}</span></button>)}</div>
     {towns.filter(t=>t.id===chosenTown).map(t=><section className="gl-card gl-form" key={t.id}><h2>{t.name} 영지 정보</h2><div className="gl-data-row"><span>영지 종류</span><strong>{t.kind}</strong></div><div className="gl-data-row"><span>점령 상태</span><strong>{data.owned.includes(t.id)?data.name:t.owner}</strong></div><div className="gl-data-row"><span>원정단 재료 세율</span><strong>{data.owned.includes(t.id)?data.taxes[t.id]??10:0}%</strong></div>{data.owned.includes(t.id)?<><label>세율 조정 <input type="range" min="0" max="50" step="5" disabled={!isLeader} value={data.taxes[t.id]??10} onChange={e=>set({taxes:{...data.taxes,[t.id]:Number(e.target.value)}})}/></label>{isLeader&&<button className="gl-button gold gl-wide" onClick={()=>event(t.name+' 영지 세율 '+(data.taxes[t.id]??10)+'% 적용')}>세율 저장</button>}</>:<button className="gl-button gl-wide" onClick={()=>{setWarTown(t.id);go('occupation');}}>점령전으로 이동</button>}</section>)}
    </>}
    {view==='warehouse'&&<><div className="gl-pagehead"><div><small>GUILD TREASURY</small><h1>원정단 금고</h1></div></div><div className="gl-statgrid"><div><small>공용 실버</small><strong>{gold(data.treasurySilver)}</strong></div><div><small>공용 골드</small><strong>{gold(data.treasuryGold)}</strong></div><div><small>도전권</small><strong>{data.tickets}</strong></div></div>
     <section className="gl-card gl-form"><h2>재화 입출금</h2><div className="gl-switch">{(['deposit','withdraw'] as const).map(x=><button key={x} className={walletMode===x?'active':''} onClick={()=>setWalletMode(x)}>{x==='deposit'?'입금':'출금'}</button>)}</div><div className="gl-switch">{(['SILVER','GOLD'] as const).map(x=><button key={x} className={resource===x?'active':''} onClick={()=>setResource(x)}>{x==='SILVER'?'실버':'골드'}</button>)}</div><input className="gl-input" type="number" min="1" value={walletAmount} onChange={e=>setWalletAmount(Number(e.target.value))}/><button className="gl-button gold gl-wide" onClick={transfer}>{walletMode==='deposit'?'금고에 입금':'금고에서 출금'}</button></section>
     <section className="gl-card gl-form"><h2>원정단 재료 창고</h2><div className="gl-materials">{materials.map(m=><div key={m}><small>{materialNames[m]}</small><strong>{gold(data.materials[m])}개</strong></div>)}</div><label>재료 선택<select className="gl-input" value={mat} onChange={e=>setMat(e.target.value as Material)}>{materials.map(m=><option value={m} key={m}>{materialNames[m]} (개인 {data.personalMaterials[m]})</option>)}</select></label><div className="gl-switch">{(['deposit','withdraw'] as const).map(x=><button key={x} className={matDirection===x?'active':''} onClick={()=>setMatDirection(x)}>{x==='deposit'?'재료 입고':'재료 출고'}</button>)}</div><input className="gl-input" type="number" min="1" value={matAmount} onChange={e=>setMatAmount(Number(e.target.value))}/><button className="gl-button gold gl-wide" onClick={transferMaterial}>재료 {matDirection==='deposit'?'입고':'출고'} 실행</button></section>
    </>}
    {view==='shop'&&<><div className="gl-pagehead"><div><small>CONTRIBUTION SHOP</small><h1>원정단 상점</h1></div><span className="gl-pill">공헌도 {gold(data.contribution)}</span></div><div className="gl-switch">{([['all','전체'],['daily','일일 보급'],['weekly','주간 보급']] as const).map(([id,label])=><button key={id} className={shopTab===id?'active':''} onClick={()=>setShopTab(id)}>{label}</button>)}</div><div className="gl-shop-list">{products.filter(x=>shopTab==='all'||(shopTab==='daily'?'일일 보급':'주간 보급')===x.reset).map(p=><article className="gl-card gl-product" key={p.id}><div className="gl-prod-icon">{p.icon}</div><div><strong>{p.name}</strong><small>{p.reset} · Lv.{p.level} 이상</small><span>◇ {p.cost} 공헌도 · {data.purchased[p.id]??0}/{p.limit}회</span></div><button disabled={data.level<p.level||(data.purchased[p.id]??0)>=p.limit||data.contribution<p.cost} onClick={()=>buy(p.id)}>{(data.purchased[p.id]??0)>=p.limit?'완료':data.level<p.level?'잠김':'구매'}</button></article>)}</div></>}
    {view==='auction'&&<><div className="gl-pagehead"><div><small>GUILD AUCTION</small><h1>원정단 경매</h1></div></div><p className="gl-muted">경매 입찰을 시험해 볼 수 있습니다. 실버가 실제 차감되지 않습니다.</p>{data.auctions.map(a=><section className="gl-card gl-auction" key={a.id}><div><span className="gl-prod-icon">{a.type==='equipment'?'⚔':'◆'}</span><div><strong>{a.name}</strong><small>등록자: {a.owner} · 현재 최고 입찰자: {a.highest}</small></div></div><div className="gl-data-row"><span>현재 입찰</span><strong>{gold(a.bid)} S</strong></div><div className="gl-auction-action"><input className="gl-input" type="number" aria-label={a.name+' 입찰가'} min={a.bid+1} value={bid[a.id]??a.bid+1000} onChange={e=>setBid(old=>({...old,[a.id]:Number(e.target.value)}))}/><button onClick={()=>bidOn(a)}>입찰</button></div></section>)}<button className="gl-button gl-wide" onClick={()=>{const id=Math.max(0,...data.auctions.map(x=>x.id))+1;set({auctions:[...data.auctions,{id,name:'약초 20개',type:'material',bid:1500,owner:'기크',highest:'—',status:'active'}]});event('약초 20개 경매 등록');}}>재료 경매 등록 (모의)</button></>}
    {view==='members'&&<><div className="gl-pagehead"><div><small>MEMBER REGISTRY</small><h1>단원 관리</h1></div><span className="gl-pill">{data.members.length} / 30명</span></div>{data.members.map(m=><article className="gl-card gl-member" key={m.id}><div className="gl-member-avatar">{m.name.slice(0,1)}</div><div><strong>{m.name}</strong><JobTag job={m.className}/><small>{m.role==='LEADER'?'원정단장':'원정단원'}</small></div>{isLeader&&m.id!==1&&<div className="gl-member-actions"><button onClick={()=>{setData(old=>({...old,members:old.members.filter(x=>x.id!==m.id)}));event(m.name+' 내보내기');}}>내보내기</button><button onClick={()=>{setRole('member');event(m.name+'에게 단장 위임 (모의)');}}>단장 위임</button></div>}</article>)}</>}
    {view==='applications'&&<><div className="gl-pagehead"><div><small>JOIN REQUESTS</small><h1>가입 신청</h1></div><span className="gl-pill">{data.applications.length}건</span></div>{!data.applications.length&&<p className="gl-muted">대기 중인 가입 신청이 없습니다.</p>}{data.applications.map(m=><article className="gl-card gl-member" key={m.id}><div className="gl-member-avatar">{m.name.slice(0,1)}</div><div><strong>{m.name}</strong><JobTag job={m.className}/><small>가입 승인 대기</small></div>{isLeader&&<div className="gl-member-actions"><button onClick={()=>{setData(old=>({...old,applications:old.applications.filter(x=>x.id!==m.id),members:[...old.members,m]}));event(m.name+' 가입 승인');}}>승인</button><button onClick={()=>{set({applications:data.applications.filter(x=>x.id!==m.id)});event(m.name+' 가입 거절');}}>거절</button></div>}</article>)}</>}
    {view==='rankings'&&<><div className="gl-pagehead"><div><small>GUILD LEADERBOARD</small><h1>원정단 랭킹</h1></div></div><div className="gl-switch">{(['종합','영지','공성전','성장'] as const).map(x=><button key={x} className={rankMode===x?'active':''} onClick={()=>setRankMode(x)}>{x}</button>)}</div>{sortedRank.map((x,i)=><article className="gl-card gl-rank" key={x.name}><span className="gl-rank-num">{i+1<10?'0'+(i+1):i+1}</span><Crest value={x.emblem} size={43}/><div><strong>{x.name}</strong><small>Lv.{x.level} · 영지 {x.land}개 · 승리 {x.wins}회</small></div><b>{gold(rankMode==='영지'?x.land:rankMode==='공성전'?x.wins:rankMode==='성장'?x.level:x.score)}</b></article>)}</>}
    {view==='activity'&&<><div className="gl-pagehead"><div><small>EXPEDITION RECORDS</small><h1>원정단 기록</h1></div></div>{data.activity.map((a,i)=><div className="gl-activity" key={i}><span className="gl-activity-dot"/><div><small>기록 {data.activity.length-i}</small><p>{a}</p></div></div>)}</>}
    {view==='manage'&&<><div className="gl-pagehead"><div><small>GUILD SETTINGS</small><h1>원정단 관리</h1></div><span className="gl-pill">{isLeader?'단장 권한':'읽기 전용'}</span></div><section className="gl-card gl-form"><h2>소개 및 공지사항</h2><label>원정단 소개<textarea disabled={!isLeader} maxLength={120} value={descriptionDraft} onChange={e=>setDescriptionDraft(e.target.value)}/></label><label>공지<textarea disabled={!isLeader} maxLength={180} value={noticeDraft} onChange={e=>setNoticeDraft(e.target.value)}/></label><label>가입 정책<select disabled={!isLeader} value={policyDraft} className="gl-input" onChange={e=>setPolicyDraft(e.target.value as Data['policy'])}><option value="APPROVAL">승인 가입</option><option value="OPEN">자유 가입</option><option value="CLOSED">모집 중지</option></select></label><label>원정 수익 분담 {shareDraft}%<input disabled={!isLeader} type="range" min="0" max="30" value={shareDraft} onChange={e=>setShareDraft(Number(e.target.value))}/></label><button disabled={!isLeader} className="gl-button gold gl-wide" onClick={()=>{set({description:descriptionDraft,notice:noticeDraft,policy:policyDraft,share:shareDraft});event('원정단 관리 설정 저장');}}>설정 저장</button></section><section className="gl-card"><h2>원정단 탈퇴 · 해산</h2><p className="gl-muted">아래 버튼은 모의 실험 상태만 변경합니다. 실제 게임 데이터는 변경되지 않습니다.</p><button className="gl-button danger gl-wide" onClick={()=>{if(window.confirm('모의 원정단을 떠나시겠습니까?')){setRole('none');go('directory');notify('원정단을 떠났습니다. (모의)');}}}>{isLeader?'원정단 해산 시뮬레이션':'원정단 탈퇴 시뮬레이션'}</button></section></>}
    {view==='chat'&&<><div className="gl-pagehead"><div><small>EXPEDITION CHAT</small><h1>노바르 채팅</h1></div></div><div className="gl-switch"><button className={chatMode==='guild'?'active':''} onClick={()=>setChatMode('guild')}>원정단 채팅</button><button className={chatMode==='world'?'active':''} onClick={()=>setChatMode('world')}>전체 채팅</button></div><div className="gl-chat-log">{data.chat.filter(m=>m.channel===chatMode).map(m=><article key={m.id}><div className="gl-chat-author">{chatMode==='world'&&<span className="gl-chat-guild">{m.guild} ·</span>}<b>{m.name}</b><JobTag job={m.job}/><small>{m.time}</small></div><p>{m.text}</p></article>)}</div><form className="gl-chat-form" onSubmit={e=>{e.preventDefault();if(!chatDraft.trim())return;const m:ChatLine={id:Date.now(),name:'기크',guild:data.name,job:'warrior',text:chatDraft.trim(),channel:chatMode,time:new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})};set({chat:[...data.chat,m]});setChatDraft('');}}><input className="gl-input" maxLength={200} value={chatDraft} onChange={e=>setChatDraft(e.target.value)} placeholder="메시지 입력 (모의)"/><button disabled={!chatDraft.trim()}>전송</button></form></>}
   </main>
   <footer className="gl-footer"><span>원정단 UI 모의 실험 · 서버 비연결</span><a href="./" title="실제 게임 실행">실제 게임 ↗</a></footer>
   {toast&&<div className="gl-toast" role="status">{toast}</div>}
  </div>
 </div>;
}
createRoot(document.getElementById('guild-lab-root')!).render(<React.StrictMode><App/></React.StrictMode>);
