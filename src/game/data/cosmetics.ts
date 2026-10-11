/**
 * Appearance content catalog (2026-10-11).
 * This file defines content and proposed progression metadata ONLY.
 * Do not add bonus values to player combat stats or charge gold until the
 * server-owned drawing / collection systems are implemented separately.
 */
export type AppearanceRarity='C'|'B'|'A'|'SR'|'SSR';
export type AppearanceBonusStat='hp'|'attack'|'defense';

export interface AppearanceProposedBonus{
 stat:AppearanceBonusStat;
 percent:number;
}
export interface AppearanceData{
 id:string;
 name:string;
 imagePath?:string;
 description:string;
 sourceLabel:string;
 tradeable:boolean;
 hideNameWhenLocked?:boolean;
 rarity?:AppearanceRarity;
 collectionId?:string;
 proposedBonus?:AppearanceProposedBonus;
 artStatus?:'ready'|'pending';
}
export interface TitleData{id:string;name:string;description:string;sourceLabel:string}
export interface CosmeticsCatalog{appearances:AppearanceData[];titles:TitleData[]}
export interface AppearanceCollection{
 id:string;
 name:string;
 description:string;
 appearanceIds:string[];
 proposedCompletionBonus:AppearanceProposedBonus;
}

export const DEFAULT_APPEARANCE_ID='default';
export const APPEARANCE_RARITIES:readonly AppearanceRarity[]=['C','B','A','SR','SSR'];
/** Balance placeholders, not awarded to owners until a later combat release. */
export const APPEARANCE_PROPOSED_PERCENT:Readonly<Record<AppearanceRarity,number>>={C:1,B:2,A:3,SR:4,SSR:5};
export const APPEARANCE_BONUS_LABELS:Readonly<Record<AppearanceBonusStat,string>>={
 hp:'최대 HP',attack:'공격력',defense:'방어력'
};
const entries=[
 {
  id:'ashen_border',name:'잿빛 외곽',description:'탑의 그림자 밖에서 살아남은 자들의 낡은 장비와 몸짓.',
  stat:'hp',bonus:1,
  figures:[
   ['dust_pathfinder','먼지길 방랑자','먼지투성이 망토와 금이 간 물통을 멘 생존자'],
   ['rust_bell_warden','녹슨 종의 파수꾼','재앙이 다가오면 울리지 않는 종을 흔드는 파수꾼'],
   ['grey_veil_scout','회색 장막의 척후','재 속에 발자국을 감추는 정찰대의 마지막 생존자'],
   ['grave_mark_reclaimer','묘표의 회수자','이름 없는 무덤에서 유품과 약속을 건지는 인물'],
   ['ash_crown_wanderer','잿빛 왕관의 유랑자','무너진 왕국의 마지막 재를 머리에 얹은 유랑자']
  ]
 },
 {
  id:'green_sanctum',name:'녹관 성역',description:'가시와 성흔, 축복과 파문이 뒤섞인 녹빛의 성소.',
  stat:'defense',bonus:1,
  figures:[
   ['moss_pilgrim','이끼 순례자','낡은 풀잎 장식과 작은 향로를 두른 순례자'],
   ['thorn_choir','가시 성가대원','목소리 대신 가시를 봉헌하는 성가대원'],
   ['silent_gardener','침묵의 정원지기','시든 성수를 들고 비밀의 정원을 지키는 사람'],
   ['exiled_laurel','추방된 월계관','성역에서 파문당하고 녹관을 거꾸로 쓴 자'],
   ['reversed_stigmata','역행하는 성흔','치유되지 않는 성흔이 빛나는 성역의 금기']
  ]
 },
 {
  id:'red_fang',name:'붉은 송곳니',description:'포식과 추적이 모든 질서를 대신하는 피 묻은 경계지.',
  stat:'attack',bonus:1,
  figures:[
   ['fang_tracker','어린 송곳니 추적자','짐승의 이빨로 만든 목걸이를 단 초보 사냥꾼'],
   ['red_mud_stalker','핏흙 추격자','붉은 흙과 말린 가죽으로 몸을 감춘 추격자'],
   ['pack_feaster','무리의 식사관','먹잇감을 나누는 의식을 관리하는 이교도'],
   ['eclipse_fang','월식의 송곳니','검붉은 달 아래 가면을 벗지 않는 사냥꾼'],
   ['blood_beast_regent','혈수의 대리왕','짐승의 뼈로 만든 왕관을 쓴 무리의 지배자']
  ]
 },
 {
  id:'broken_archive',name:'폐허의 기록',description:'사라진 이름을 마지막 페이지까지 지우지 않는 기록원들.',
  stat:'hp',bonus:1,
  figures:[
   ['dust_scribe','먼지 서기','타다 남은 문서와 숯필을 품은 기록 담당자'],
   ['torn_sealkeeper','찢긴 봉인사','낡은 붕대로 봉인의 틈을 감싼 기술자'],
   ['extinguished_lamplighter','꺼진 등불의 기록원','빛 없는 등잔을 든 도서관의 밤 경비원'],
   ['oblivion_auditor','망각의 감찰자','금지 문서를 검은 천으로 가린 조사관'],
   ['last_witness','최후의 증언자','모든 기록이 사라진 날을 홀로 기억하는 자']
  ]
 },
 {
  id:'deep_fault',name:'깊은 심연',description:'빛이 사라진 광맥 아래에서 돌아온, 돌아오지 못한 자들의 흔적.',
  stat:'defense',bonus:1,
  figures:[
   ['mine_candlebearer','갱도의 촛불지기','이마에 부러진 촛대를 매단 광부'],
   ['blackwater_diver','먹빛 잠수자','검은 물속에서 끌어올린 낡은 잠수복의 주인'],
   ['rift_surveyor','균열 측량관','갈라진 계측판을 들고 심층을 기록하는 사람'],
   ['abyss_salvage_knight','심연 회수기사','오랜 세월 녹슨 철갑을 입은 지하의 기사'],
   ['crown_below','바닥 아래의 왕관','가장 깊은 곳의 왕관을 쓰고 돌아온 존재']
  ]
 },
 {
  id:'inverted_altar',name:'거꾸로 선 제단',description:'성스러운 의식이 뒤집힌 제단과 고해실의 금기.',
  stat:'attack',bonus:1,
  figures:[
   ['oath_beggar','서약의 나그네','목에 봉인된 서약서를 매달고 걷는 이방인'],
   ['inverted_acolyte','거꾸로 맹세한 시종','검은 촛농이 굳은 사제복의 시종'],
   ['sin_reader','죄의 낭독자','이름 대신 죄목을 소리 내어 읽는 고해자'],
   ['silent_confessor','침묵의 고해사','입을 봉인한 채 심판을 집행하는 사제'],
   ['proxy_of_the_void','공허의 대변자','그 누구의 신탁에도 속하지 않는 검은 성인']
  ]
 },
 {
  id:'fallen_novar',name:'몰락한 도시',description:'한때 번화했던 시장과 왕좌에 남은 동전과 계약의 그림자.',
  stat:'hp',bonus:1,
  figures:[
   ['lost_porter','길 잃은 운반꾼','대금 대신 쓰러진 표지판을 받은 나그네'],
   ['copper_token_keeper','구리 증표 관리인','통행 증표를 주렁주렁 단 성문 관리인'],
   ['debt_executor','빚의 집행인','오래된 채무 목록을 갑옷 위에 새긴 집행인'],
   ['silver_deceiver','은빛 사기꾼','왕실 인장을 훔쳐 가짜 명령을 전하는 자'],
   ['fallen_throne_heir','무너진 왕좌의 계승자','주인 없는 왕좌에서 일어선 마지막 후계자']
  ]
 },
 {
  id:'returning_road',name:'귀환의 길',description:'되돌아온 탐사자들의 방패와 마지막 신호.',
  stat:'defense',bonus:1,
  figures:[
   ['worn_shieldbearer','닳은 방패병','파손된 문양의 방패를 두 손으로 붙든 생존자'],
   ['return_signalman','귀환 신호수','꺼진 신호탄을 손에서 놓지 않는 안내자'],
   ['bone_guide','백골의 인도자','해진 지도와 뼈 부적을 들고 길을 여는 자'],
   ['memory_survivor','망각을 이긴 자','쓰러진 동료의 이름을 갑옷에 새긴 귀환자'],
   ['last_homecomer','마지막 귀환자','길이 사라진 뒤에도 끝내 돌아온 사람']
  ]
 }
] satisfies Array<{
 id:string;name:string;description:string;stat:AppearanceBonusStat;bonus:number;
 figures:Array<[string,string,string]>;
}>;

export const APPEARANCE_COLLECTIONS:AppearanceCollection[]=entries.map(collection=>({
 id:collection.id,name:collection.name,description:collection.description,
 appearanceIds:collection.figures.map(([id])=>id),
 proposedCompletionBonus:{stat:collection.stat,percent:collection.bonus}
}));

const starter:AppearanceData={
 id:DEFAULT_APPEARANCE_ID,name:'기본 모험가',imagePath:'assets/player/default.png',
 description:'탑을 오르기 시작한 모험가의 기본 전신 외형',
 sourceLabel:'기본 지급',tradeable:false,artStatus:'ready'
};
export const APPEARANCES:AppearanceData[]=[
 starter,
 ...entries.flatMap(collection=>collection.figures.map(([id,name,description],i)=>({
  id,name,description,rarity:APPEARANCE_RARITIES[i],collectionId:collection.id,
  proposedBonus:{stat:collection.stat,percent:APPEARANCE_PROPOSED_PERCENT[APPEARANCE_RARITIES[i]]},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'pending' as const
 }))),
 {
  id:'arquebus',name:'아르케부스',rarity:'C',
  description:'검은 화약과 긴 머스킷을 사용하는 고딕 총사. 총검 대신 장거리 사격을 선택했다.',
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'pending'
 },
 {
  id:'corsair',name:'코르세어',rarity:'B',
  imagePath:"assets/characters/appearances/corsair-4950756b5aa8.webp",
  description:'황금 장식의 삼각모와 커틀라스, 화승총을 지닌 고딕 해적.',
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'
 }
,
 {id:"teddy",name:"테디",rarity:"B",imagePath:"assets/characters/appearances/teddy-8461c32dcd30.webp",
  description:"곰돌이 후드와 포근한 갈색 코트를 입은 모험가.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"proletaria",name:"프롤레타리아",rarity:"A",imagePath:"assets/characters/appearances/proletaria-04b3cd8ec79f.webp",
  description:"검은 긴 머리와 낡은 작업복, 거대한 망치와 낫을 지닌 혁명가.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"mechanic",name:"메카닉",rarity:"C",imagePath:"assets/characters/appearances/mechanic-aa2683a5ad70.webp",
  description:"고글과 공구 가방을 착용하고 렌치와 정밀 기계를 다루는 정비사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"skeleton_knight",name:"해골기사",rarity:"C",imagePath:"assets/characters/appearances/skeleton_knight-1d9371e754bd.webp",
  description:"낡은 판금 갑옷을 두르고 장검과 거대한 방패를 든 해골 기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"valkyrie",name:"발키리",rarity:"A",imagePath:"assets/characters/appearances/valkyrie-488c94211b36.webp",
  description:"백색 날개와 빛나는 후광, 은빛 갑옷을 두르고 검과 성서를 든 전사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"seraphim",name:"세라핌",rarity:"A",imagePath:"assets/characters/appearances/seraphim-f20daf44dec1.webp",
  description:"수많은 눈과 겹겹의 흑백 날개, 가시 후광과 사슬 장식으로 이루어진 천사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
];
export const TITLES:TitleData[]=[];
export const COSMETICS_CATALOG:CosmeticsCatalog={appearances:APPEARANCES,titles:TITLES};

export const appearanceById=(id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG)=>catalog.appearances.find(x=>x.id===id);
export const titleById=(id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG)=>catalog.titles.find(x=>x.id===id);
export const appearanceCollectionById=(id:string)=>APPEARANCE_COLLECTIONS.find(x=>x.id===id);
export const appearanceBonusLabel=(bonus:AppearanceProposedBonus)=>APPEARANCE_BONUS_LABELS[bonus.stat]+' +'+bonus.percent+'%';
export function appearanceCollectionProgress(collection:AppearanceCollection,unlockedIds:readonly string[]){
 const owned=new Set(unlockedIds);
 const count=collection.appearanceIds.filter(id=>owned.has(id)).length;
 return {count,total:collection.appearanceIds.length,complete:count===collection.appearanceIds.length};
}
/** Ensure designer and server can rely on stable IDs without item/collection collisions. */
export function validateAppearanceCatalog(appearances:readonly AppearanceData[]=APPEARANCES,collections:readonly AppearanceCollection[]=APPEARANCE_COLLECTIONS){
 const ids=new Set(appearances.map(a=>a.id));
 const themes=new Set(collections.map(c=>c.id));
 if(ids.size!==appearances.length||themes.size!==collections.length)return false;
 if(appearances.filter(a=>a.id===DEFAULT_APPEARANCE_ID).length!==1)return false;
 const assigned=new Set<string>();
 for(const collection of collections){
  if(!collection.id||!collection.name||collection.appearanceIds.length!==5)return false;
  for(const id of collection.appearanceIds){
   const a=appearances.find(x=>x.id===id);
   if(!a||a.collectionId!==collection.id||assigned.has(id))return false;
   assigned.add(id);
  }
  const rarities=collection.appearanceIds.map(id=>appearances.find(a=>a.id===id)!.rarity);
  if(APPEARANCE_RARITIES.some(r=>!rarities.includes(r)))return false;
 }
 return appearances.every(a=>a.id===DEFAULT_APPEARANCE_ID
  ?a.artStatus==='ready'&&!!a.imagePath
  :(assigned.has(a.id)||(!a.collectionId&&!!a.rarity))&&!!a.name&&!!a.description&&!!a.proposedBonus&&a.proposedBonus.percent>0&&(a.artStatus==='pending'?a.imagePath===undefined:!!a.imagePath));
}
if(!validateAppearanceCatalog())throw Error('외형 카탈로그 구성 오류');
