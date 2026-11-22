import {initialState} from '../game/engine/state';
import {DEFAULT_GUILD_EMBLEM,type GuildEmblemData} from '../components/association/GuildEmblem';
import type{GameState}from'../game/types';
import {supabaseConfig} from '../online/config';

export const LAB_USER='00000000-0000-4000-8000-000000000001';
export const LAB_GUILD='11111111-1111-4111-8111-111111111111';
export const LAB_LEASE={leaseId:'22222222-2222-4222-8222-222222222222',generation:1,clientInstanceId:'guild-lab-only',expiresAt:new Date(Date.now()+86400000).toISOString()};
type Role='LEADER'|'MEMBER'|'NONE';
type Guild={name:string;description:string;notice:string;policy:'OPEN'|'APPROVAL'|'CLOSED';share:number;emblem:GuildEmblemData;role:Role;members:{userId:string;playerLabel:string;role:'LEADER'|'MEMBER';joinedAt:string}[];applications:{applicationId:string;applicantUserId:string;playerLabel:string;createdAt:string;status:'PENDING'}[];activity:{activityId:number;createdAt:string;text:string}[];silver:number;gold:number;tickets:number;materials:Record<string,number>;personalMaterials:Record<string,number>;level:number;exp:number;points:number;owned:string[];bossHp:{DAILY:number;WEEKLY:number};attacks:number;lotBid:number;purchased:Record<string,number>};
const now=()=>new Date().toISOString();
const created='2026-11-01T09:00:00.000Z';
const uid=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const defaultPeople=()=>[
 {userId:LAB_USER,playerLabel:'기크',role:'LEADER' as const,joinedAt:created},
 {userId:uid(2),playerLabel:'루시안',role:'MEMBER' as const,joinedAt:created},
 {userId:uid(3),playerLabel:'설화',role:'MEMBER' as const,joinedAt:created},
 {userId:uid(4),playerLabel:'회색늑대',role:'MEMBER' as const,joinedAt:created}
];
const defaultApplications=()=>[
 {applicationId:uid(15),applicantUserId:uid(5),playerLabel:'떠돌이검객',createdAt:created,status:'PENDING' as const},
 {applicationId:uid(16),applicantUserId:uid(6),playerLabel:'별빛',createdAt:created,status:'PENDING' as const}
];
const sampleGuild=():Guild=>({
 name:'검은 새벽',description:'탑의 끝을 향해 함께 나아가는 원정단입니다.',notice:'점령전 준비는 토요일 20:30까지 부탁드립니다.',
 policy:'APPROVAL',share:10,emblem:{...DEFAULT_GUILD_EMBLEM,symbol:'knight',accent:'#d7b878'},
 role:'LEADER',members:defaultPeople(),applications:defaultApplications(),
 activity:[{activityId:4,createdAt:created,text:'달그늘 점령에 성공했습니다.'},{activityId:3,createdAt:created,text:'루시안이 원정단에 기부했습니다.'},{activityId:2,createdAt:created,text:'이슬숲 점령에 성공했습니다.'}],
 silver:318400,gold:42,tickets:120,materials:{herb:85,pepper:42,potato:120,wheat:68},
 personalMaterials:{herb:36,pepper:15,potato:24,wheat:12},
 level:4,exp:6500,points:2200,owned:['herb-1','herb-2'],bossHp:{DAILY:7600,WEEKLY:60000},
 attacks:1,lotBid:240,purchased:{}
});
let guild:Guild=sampleGuild();
let game:GameState=Object.assign(initialState(),{silver:54963809,currentJobId:'contract_mercenary',
 market:{...initialState().market,gold:100},tickets:Object.fromEntries(['ore','leather','gem','kaleon'].map(t=>[t,Array.from({length:100},()=>50)]))}) as GameState;
let observer:(()=>void)|null=null;
const storeKey='tower-guild-real-ui-lab-v1';
function persist(){try{sessionStorage.setItem(storeKey,JSON.stringify({guild,game}));}catch{}}
export function restoreLab(){
 try{const raw=sessionStorage.getItem(storeKey);if(raw){const s=JSON.parse(raw);if(s?.guild?.emblem&&Array.isArray(s.guild.members)&&s.game?.market){guild=s.guild;game=s.game;}}}catch{}
}
export function gameSnapshot():GameState{return structuredClone(game);}
export function setGameSnapshot(next:GameState){game=next;persist();}
export function labRole():Role{return guild.role;}
export function updateLabRole(role:Role){guild.role=role;persist();observer?.();}
export function resetLab(){guild=sampleGuild();game=Object.assign(initialState(),{silver:54963809,currentJobId:'contract_mercenary',market:{...initialState().market,gold:100}}) as GameState;persist();observer?.();}
export function listenLabChanges(cb:()=>void){observer=cb;return()=>{if(observer===cb)observer=null;};}
const directory=()=>[
 {associationId:'33333333-3333-4333-8333-333333333333',recordNumber:'00021',name:'철의 맹세',description:'함께 전진하는 원정단',joinPolicy:'APPROVAL',memberCount:20,memberLimit:30,revenueShareRatePercent:5,createdAt:created,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#2f4f80',symbol:'crown'}},
 {associationId:'44444444-4444-4444-8444-444444444444',recordNumber:'00024',name:'푸른 기사단',description:'초보자 환영',joinPolicy:'OPEN',memberCount:12,memberLimit:30,revenueShareRatePercent:0,createdAt:created,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#386148',symbol:'shield'}},
 {associationId:'55555555-5555-4555-8555-555555555555',recordNumber:'00025',name:'붉은 달',description:'보스전과 점령전을 함께합니다.',joinPolicy:'APPROVAL',memberCount:16,memberLimit:30,revenueShareRatePercent:10,createdAt:created,emblem:{...DEFAULT_GUILD_EMBLEM,base:'#624075',symbol:'moon'}}
];
const current=()=>guild.role==='NONE'?null:({
 associationId:LAB_GUILD,recordNumber:'00027',name:guild.name,description:guild.description,
 leaderUserId:uid(1),createdAt:created,notice:guild.notice,noticeUpdatedAt:created,
 joinPolicy:guild.policy,status:'ACTIVE',memberLimit:30,revenueShareRatePercent:guild.share,
 treasurySilver:guild.silver,myRole:guild.role,members:guild.members,applications:guild.applications,
 activity:guild.activity,emblem:guild.emblem
});
const associationState=()=>({
 userId:LAB_USER,qualified:true,rejoinAt:null,serverNow:Date.now(),current:current(),
 directory:[...directory(),{associationId:LAB_GUILD,recordNumber:'00027',name:guild.name,description:guild.description,joinPolicy:guild.policy,memberCount:guild.members.length,memberLimit:30,createdAt:created,revenueShareRatePercent:guild.share,emblem:guild.emblem}],
 myApplications:[]
});
const record=()=>({revision:2,createdAt:created,updatedAt:now(),payload:gameSnapshot()});
const changed=(message:string)=>{guild.activity.unshift({activityId:Date.now(),createdAt:now(),text:message});persist();observer?.();};
const growth=()=>({associationLevel:guild.level,associationExp:guild.exp,associationExpNext:guild.exp+1000,contributionPoint:guild.points,
 totalSilverDonation:100000,totalGoldDonation:100,dailySilverDonation:0,dailyGoldDonation:0,dailyTicketDonation:0,
 personalTickets:200,dailySilverLimit:50000,dailyGoldLimit:1000,dailyTicketLimit:100,dailyResetAt:new Date(Date.now()+86400000).toISOString()});
const townData=[
 {townId:'herb-1',name:'달그늘',kind:'herb',owner:'검은 새벽'},
 {townId:'farm-1',name:'황금들',kind:'farm',owner:'철의 맹세'},
 {townId:'farm-2',name:'보리뜰',kind:'farm',owner:'붉은 달'},
 {townId:'herb-2',name:'이슬숲',kind:'herb',owner:'검은 새벽'},
 {townId:'city',name:'노바르',kind:'city',owner:'철의 맹세'}
] as const;
const territory=()=>({associationId:LAB_GUILD,isLeader:guild.role==='LEADER',ownedCount:guild.owned.length,totalCount:5,
 todayTax:280,weekTax:1300,stockTotal:Object.values(guild.materials).reduce((a,b)=>a+b,0),
 todayStart:created,serverNow:Date.now(),
 towns:townData.map(t=>({townId:t.townId,name:t.name,kind:t.kind,ownerAssociationId:guild.owned.includes(t.townId)?LAB_GUILD:uid(10),
 ownerName:guild.owned.includes(t.townId)?guild.name:t.owner,owned:guild.owned.includes(t.townId),occupiedAt:created,rate:10,changedAt:created,todayTax:70,weekTax:220,
 todayMaterials:{herb:14,pepper:7,potato:22,wheat:11},weekMaterials:{herb:30,pepper:15,potato:60,wheat:20}})),
 history:[{eventId:'war-a',townId:'herb-1',townName:'달그늘',settledAt:created,previousOwner:'철의 맹세',winner:guild.name,outcome:'CAPTURED',ourWar:true}]
});
const bosses=()=>({associationId:LAB_GUILD,serverNow:Date.now(),bosses:(['DAILY','WEEKLY'] as const).map(kind=>({
 encounterId:kind==='DAILY'?'daily-raid-demo':'weekly-raid-demo',kind,name:kind==='DAILY'?'굶주린 성자':'성당을 짊어진 거인',
 maxHp:kind==='DAILY'?10000:80000,remainingHp:guild.bossHp[kind],bossAttack:60,bossDefense:20,cycleStart:created,
 cycleEnd:new Date(Date.now()+(kind==='DAILY'?12:72)*3600000).toISOString(),defeatedAt:guild.bossHp[kind]<=0?now():null,
 attacksUsed:guild.attacks,attacksLeft:Math.max(0,5-guild.attacks),myDamage:2400,participants:3,totalAttacks:12,
 leaderboard:[{userId:LAB_USER,name:'기크',damage:2400,attacks:guild.attacks},{userId:uid(2),name:'루시안',damage:1600,attacks:2}],
 nextAttackResetAt:new Date(Date.now()+86400000).toISOString()
 }))});
const shopItems=[
 {itemId:'vitality_potion_daily',name:'활력 회복 물약',description:'활력 보충',reset:'DAILY',contributionCost:100,purchaseLimit:3,requiredLevel:1},
 {itemId:'greater_potion_daily',name:'상급 회복 물약',description:'HP 회복',reset:'DAILY',contributionCost:150,purchaseLimit:3,requiredLevel:1},
 {itemId:'silver_box_daily',name:'실버 보급 상자',description:'보급품',reset:'DAILY',contributionCost:350,purchaseLimit:1,requiredLevel:2},
 {itemId:'rare_equipment_weekly',name:'희귀 장비 상자',description:'보급 장비',reset:'WEEKLY',contributionCost:650,purchaseLimit:1,requiredLevel:3},
 {itemId:'gold_box_weekly',name:'골드 보급 상자',description:'보급품',reset:'WEEKLY',contributionCost:800,purchaseLimit:1,requiredLevel:3}
];
const shop=()=>({contribution:guild.points,level:guild.level,daily:shopItems.filter(x=>x.reset==='DAILY').map(x=>({...x,purchased:guild.purchased[x.itemId]||0})),
 weekly:shopItems.filter(x=>x.reset==='WEEKLY').map(x=>({...x,purchased:guild.purchased[x.itemId]||0})),
 dailyResetAt:new Date(Date.now()+86400000).toISOString(),weeklyResetAt:new Date(Date.now()+604800000).toISOString()});
const warehouse=()=>({associationId:LAB_GUILD,associationName:guild.name,myRole:guild.role,silver:guild.silver,gold:guild.gold,tickets:guild.tickets,personalSilver:game.silver,personalGold:game.market.gold,personalTickets:100,
 ledger:[{entryId:4,operation:'LEADER_DEPOSIT',currency:'SILVER',amount:100000,balanceAfter:guild.silver,detail:'금고 입금',actorName:'기크',createdAt:created},{entryId:3,operation:'HUNT_TAX',currency:'SILVER',amount:18000,balanceAfter:200000,detail:'사냥 수익',actorName:'루시안',createdAt:created}]});
const materials=()=>({associationId:LAB_GUILD,isLeader:guild.role==='LEADER',materials:guild.materials,personal:guild.personalMaterials,
 towns:townData.map(t=>({townId:t.townId,name:t.name,owned:guild.owned.includes(t.townId),owner:guild.owned.includes(t.townId)?guild.name:t.owner,rate:10,changedAt:created})),
 ledger:[{entryId:1,operation:'GATHER_TAX',material:'herb',amount:14,balanceAfter:85,townId:'herb-1',detail:'세금 징수',actorName:'시스템',createdAt:created}]});
const auction=()=>({associationId:LAB_GUILD,points:guild.points,isLeader:guild.role==='LEADER',availableEquipment:[],claimableRewards:[],
 listings:[{listingId:'lot-a',source:'MATERIAL',gear:{id:'unused',kind:'sword',grade:'rare',enhancement:0},materialId:'herb',materialQuantity:20,canReturnMaterial:false,
 sellerId:uid(2),isMyListing:false,cancelledAt:null,returnedAt:null,canCancel:false,canReturn:false,canRelist:false,
 startingBid:100,topBid:guild.lotBid,nextBid:guild.lotBid+20,topUserId:uid(3),startedAt:created,endsAt:new Date(Date.now()+86400000).toISOString(),
 claimedAt:null,status:'OPEN',isMyTopBid:false}]});
const rankings=(mode:string)=>({mode,totalGuilds:4,myAssociationId:guild.role==='NONE'?null:LAB_GUILD,myRank:2,updatedAt:now(),
 entries:[{associationId:uid(41),name:'철의 맹세',recordNumber:'00021',emblem:{...DEFAULT_GUILD_EMBLEM,base:'#2f4f80',symbol:'crown'},level:5,exp:8800,members:20,memberLimit:30,territories:1,victories:11,captures:6,defenses:5,mine:false},
 {associationId:LAB_GUILD,name:guild.name,recordNumber:'00027',emblem:guild.emblem,level:guild.level,exp:guild.exp,members:guild.members.length,memberLimit:30,territories:guild.owned.length,victories:8,captures:3,defenses:5,mine:guild.role!=='NONE'},
 {associationId:uid(43),name:'붉은 달',recordNumber:'00025',emblem:{...DEFAULT_GUILD_EMBLEM,base:'#624075',symbol:'moon'},level:3,exp:5600,members:16,memberLimit:30,territories:1,victories:4,captures:2,defenses:2,mine:false}].map((x,i)=>({rank:i+1,...x}))});
const cycle=()=>({cycleKey:'guild-ui-lab-cycle',phase:'BIDDING',bidClosesAt:new Date(Date.now()+3600000).toISOString(),battleStartsAt:new Date(Date.now()+7200000).toISOString(),battleEndsAt:new Date(Date.now()+10800000).toISOString(),nextCycleAt:new Date(Date.now()+604800000).toISOString()});
const warDeclarations=()=>({cycleKey:'guild-ui-lab-cycle',phase:'BIDDING',bidClosesAt:cycle().bidClosesAt,battleStartsAt:cycle().battleStartsAt,
 myAssociationId:guild.role==='NONE'?null:LAB_GUILD,myRole:guild.role==='NONE'?null:guild.role,tickets:100,guildTickets:guild.tickets,
 declarations:[{townId:'farm-1',associationId:LAB_GUILD,associationName:guild.name}]});
const warStage=(townId:string)=>({enabled:true,serverNow:Date.now(),phase:'DEPLOYMENT',eventId:'demo-war-event',cycleKey:'guild-ui-lab-cycle',
 deploymentStartsAt:created,battleStartsAt:new Date(Date.now()+3600000).toISOString(),battleEndsAt:new Date(Date.now()+7200000).toISOString(),
 ownerAssociationId:townId==='herb-1'||townId==='herb-2'?LAB_GUILD:uid(41),myAssociationId:guild.role==='NONE'?null:LAB_GUILD,
 myRole:guild.role==='NONE'?null:guild.role,tickets:150,canAttack:true,
 fronts:Array.from({length:5},(_,i)=>({frontId:i+1,defenderUserId:i===0?uid(2):null,defenderName:i===0?'루시안':null,
 associationId:i===0?LAB_GUILD:null,associationName:i===0?guild.name:null,defenderEpoch:1,revision:1,hp:i===0?450:null,maxHp:i===0?500:null,mp:i===0?120:null,maxMp:i===0?150:null,occupiedAt:i===0?created:null,defenseWins:0}))});
const occupation=()=>({userId:LAB_USER,window:cycle(),identity:guild.role==='NONE'?null:{groupKey:LAB_GUILD,groupName:guild.name,role:guild.role,associationId:LAB_GUILD},
 towers:['ore','leather','gem','kaleon'].map(t=>({tower:t,ownerGroupKey:t==='ore'?LAB_GUILD:null,ownerGroupName:t==='ore'?guild.name:null,occupiedAt:created})),
 merit:{ore:100,leather:20,gem:0,kaleon:0},bids:[],matches:[],duel:null});
const fakeChatMessages:{id:string;user_id:string;nickname:string;body:string;created_at:string;client_id:string;association_id:string|null;sender_guild_id:string;sender_guild_name:string;sender_guild_emblem:GuildEmblemData;sender_class_id:string}[]=[
 {id:uid(100),user_id:uid(2),nickname:'루시안',body:'오늘 보스전 참여하실 분?',created_at:created,client_id:'demo-a',association_id:LAB_GUILD,sender_guild_id:LAB_GUILD,sender_guild_name:'검은 새벽',sender_guild_emblem:guild.emblem,sender_class_id:'mage'}
];
function dispatch(name:string,p:Record<string,any>):any{
 const n=Number(p.p_amount)||0;
 switch(name){
 case'get_online_association_state_v2':return associationState();
 case'create_online_association_v3':
  if(guild.role!=='NONE')throw Error('ASSOCIATION_ALREADY_JOINED');
  guild={...sampleGuild(),name:String(p.p_name||'새 원정단'),description:String(p.p_description||''),policy:p.p_join_policy==='OPEN'?'OPEN':'APPROVAL',
   emblem:p.p_emblem??{...DEFAULT_GUILD_EMBLEM},role:'LEADER',members:[defaultPeople()[0]],applications:[],
   level:1,exp:0,points:0,silver:0,gold:0,tickets:0,owned:[]};
  game.silver-=1000;changed(guild.name+' 원정단을 창설했습니다.');
  return{state:associationState(),record:record()};
 case'join_online_association':
  if(String(p.p_association_id)===uid(0))throw Error('ASSOCIATION_NOT_FOUND');
  guild.role='MEMBER';guild.name=directory().find(d=>d.associationId===p.p_association_id)?.name||guild.name;
  changed(guild.name+' 원정단에 가입했습니다.');return{state:associationState(),record:record()};
 case'leave_online_association':case'disband_online_association':
  guild.role='NONE';changed('원정단에서 탈퇴했습니다.');return{state:associationState(),record:record()};
 case'update_online_association':guild.description=String(p.p_description||'');guild.notice=String(p.p_notice||'');
  guild.policy=p.p_join_policy==='OPEN'||p.p_join_policy==='CLOSED'?p.p_join_policy:'APPROVAL';
  guild.share=Number(p.p_revenue_share_rate)||0;changed('원정단 정보를 수정했습니다.');return{state:associationState(),record:record()};
 case'review_online_association_application':{
   const app=guild.applications.find(a=>a.applicationId===p.p_application_id);
   if(app&&p.p_accept)guild.members.push({userId:app.applicantUserId,playerLabel:app.playerLabel,role:'MEMBER',joinedAt:now()});
   guild.applications=guild.applications.filter(a=>a.applicationId!==p.p_application_id);
   changed((app?.playerLabel||'단원')+(p.p_accept?' 가입 승인':' 가입 거절'));return{state:associationState(),record:record()};
 }
 case'kick_online_association_member':
  guild.members=guild.members.filter(m=>m.userId!==p.p_member_user_id);changed('원정단원 내보내기');return{state:associationState(),record:record()};
 case'transfer_online_association_leadership':
  guild.members=guild.members.map(m=>({...m,role:m.userId===p.p_member_user_id?'LEADER':'MEMBER'}));guild.role='MEMBER';changed('단장 권한을 위임했습니다.');return{state:associationState(),record:record()};
 case'get_association_progression':return growth();
 case'donate_to_association':{
  if(p.p_currency==='silver'){game.silver-=n;guild.silver+=n;}else if(p.p_currency==='gold'){game.market.gold-=n;guild.gold+=n;}else guild.tickets+=n;
  guild.points+=Math.max(1,Math.round(n/100));guild.exp+=Math.max(1,Math.round(n/100));
  changed('원정단 기부 '+n);return{progression:growth(),record:record()};
 }
 case'get_guild_territory_state':return territory();
 case'set_guild_village_tax':changed('세율을 변경했습니다.');return materials();
 case'get_online_association_shop':return shop();
 case'buy_online_association_shop_item':{
  const item=shopItems.find(x=>x.itemId===p.p_item_id);
  if(!item)throw Error('ASSOCIATION_ITEM_NOT_FOUND');
  guild.points=Math.max(0,guild.points-item.contributionCost);guild.purchased[item.itemId]=(guild.purchased[item.itemId]||0)+1;
  changed(item.name+' 구매');return{state:shop(),record:record(),replayed:false,reward:{name:item.name,type:'demo',quantity:1}};
 }
 case'get_association_warehouse':return warehouse();
 case'get_association_warehouse_history':return{ledger:warehouse().ledger.filter(e=>!p.p_withdrawals_only||e.amount<0),hasMore:false};
 case'transfer_association_treasury':{
  const value=Number(p.p_amount)||0,sign=p.p_direction==='DEPOSIT'?1:-1;
  if(p.p_currency==='SILVER'){guild.silver+=sign*value;game.silver-=sign*value;}
  if(p.p_currency==='GOLD'){guild.gold+=sign*value;game.market.gold-=sign*value;}
  if(p.p_currency==='TICKET')guild.tickets+=sign*value;
  changed('금고 '+(sign>0?'입금':'출금')+' '+value);return{warehouse:warehouse(),record:record(),replayed:false,ledgerEntryId:5};
 }
 case'get_guild_materials':return materials();
 case'transfer_guild_material':{
  const material=String(p.p_material),qty=Number(p.p_amount)||0,sign=p.p_direction==='DEPOSIT'?1:-1;
  guild.materials[material]=(guild.materials[material]||0)+sign*qty;guild.personalMaterials[material]=(guild.personalMaterials[material]||0)-sign*qty;
  changed('재료 '+material+' 이동');return{state:materials(),replayed:false};
 }
 case'get_guild_rankings_v2':return rankings(String(p.p_mode||'OVERALL'));
 case'get_guild_boss_state':return bosses();
 case'attack_guild_boss':{
  const kind=p.p_kind==='WEEKLY'?'WEEKLY':'DAILY';const damage=kind==='WEEKLY'?4500:1200;
  guild.bossHp[kind]=Math.max(0,guild.bossHp[kind]-damage);guild.attacks++;
  changed('보스 '+damage+' 피해');
  return{state:bosses(),replayed:false,result:{encounterId:kind==='DAILY'?'daily-raid-demo':'weekly-raid-demo',kind,name:kind==='DAILY'?'굶주린 성자':'성당을 짊어진 거인',damage,remainingHp:guild.bossHp[kind],maxHp:kind==='DAILY'?10000:80000,defeated:guild.bossHp[kind]===0,attacksLeft:Math.max(0,5-guild.attacks),createdAt:now(),
    combat:{damage,turns:[{turn:1,lines:['기크의 공격이 적중했습니다.'],playerHp:850,playerMp:100,damageTotal:damage}],playerHp:850,maxPlayerHp:1000,playerMp:100,maxPlayerMp:150,outcome:'survived',attackStat:230,defenseStat:140,weapon:'검'}}};
 }
 case'get_guild_auction_state':return auction();
 case'bid_guild_auction':guild.lotBid=Number(p.p_bid)||guild.lotBid+20;guild.points-=guild.lotBid;changed('경매 입찰');return{state:auction(),replayed:false};
 case'register_guild_material_auction':guild.lotBid=Number(p.p_starting_bid)||120;changed('재료 경매 등록');return{state:auction(),replayed:false};
 case'get_occupation_state':return occupation();
 case'get_village_war_declarations':return warDeclarations();
 case'declare_village_war':changed('선전포고 모의 등록');return{state:warDeclarations(),replayed:false};
 case'get_village_war_state':return warStage(String(p.p_town_id||'city'));
 case'place_village_war_defender':case'remove_village_war_defender':case'claim_empty_village_war_front':case'attack_village_war_front':
  changed('점령전 '+name+' 처리');return{state:warStage(String(p.p_town_id||'city')),replayed:false,result:{action:name.startsWith('place')?'PLACE':name.startsWith('remove')?'REMOVE':name.startsWith('claim')?'CLAIM_EMPTY':'ATTACK',frontId:Number(p.p_front_id)||1,defenderEpoch:1,ticketsSpent:0,cooldownUntil:null}};
 case'get_occupation_guild_emblems':return{[LAB_GUILD]:guild.emblem};
 case'get_premium_status':return{expiresAt:null,serverNow:Date.now()};
 case'get_chat_association':return guild.role==='NONE'?null:{id:LAB_GUILD,name:guild.name};
 default:throw Error('MOCK_RPC_UNSUPPORTED_'+name);
 }
}
let installed=false;
export function installGuildLabMock(){
 if(installed)return;installed=true;restoreLab();
 const original=window.fetch.bind(window);
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const parsed=new URL(url,window.location.href);
  if(supabaseConfig&&parsed.origin===supabaseConfig.url){
   try{
    if(parsed.pathname==='/rest/v1/game_chat_messages'){
      if((init?.method||'GET').toUpperCase()==='POST'){
        const item=JSON.parse(String(init?.body||'{}')) as {body:string;client_id:string;association_id?:string};
        const message={id:crypto.randomUUID(),user_id:LAB_USER,nickname:'기크',body:String(item.body||'').slice(0,200),created_at:now(),
         client_id:item.client_id,association_id:item.association_id||null,sender_guild_id:guild.role==='NONE'?null:LAB_GUILD,
         sender_guild_name:guild.role==='NONE'?null:guild.name,sender_guild_emblem:guild.role==='NONE'?null:guild.emblem,sender_class_id:'warrior'};
        fakeChatMessages.push(message as typeof fakeChatMessages[number]);
        return new Response(JSON.stringify([message]),{status:201,headers:{'Content-Type':'application/json'}});
      }
      const isWorld=parsed.searchParams.get('association_id')==='is.null';
      const rows=fakeChatMessages.filter(m=>isWorld?m.association_id===null:m.association_id!==null);
      return new Response(JSON.stringify([...rows].reverse()),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(!parsed.pathname.startsWith('/rest/v1/rpc/'))return new Response(JSON.stringify({message:'LAB_BLOCKED_REAL_BACKEND'}),{status:403,headers:{'Content-Type':'application/json'}});
    const rpc=decodeURIComponent(parsed.pathname.split('/').pop()||'');
    let body:Record<string,any>={};try{body=init?.body?JSON.parse(String(init.body)):{};}catch{}
    const response=dispatch(rpc,body);
    return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
   }catch(e){
    const msg=e instanceof Error?e.message:'MOCK_FAILED';
    return new Response(JSON.stringify({message:msg}),{status:400,headers:{'Content-Type':'application/json'}});
   }
  }
  return original(input,init);
 };
}
