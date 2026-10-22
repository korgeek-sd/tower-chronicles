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
// Unillustrated appearances were retired from the active catalog.
const entries:Array<{
 id:string;name:string;description:string;stat:AppearanceBonusStat;bonus:number;
 figures:Array<[string,string,string]>;
}>=[];

export const APPEARANCE_COLLECTIONS:AppearanceCollection[]=entries.map(collection=>({
 id:collection.id,name:collection.name,description:collection.description,
 appearanceIds:collection.figures.map(([id])=>id),
 proposedCompletionBonus:{stat:collection.stat,percent:collection.bonus}
}));

const starter:AppearanceData={
 id:DEFAULT_APPEARANCE_ID,name:'기본 모험가',imagePath:'assets/characters/appearances/default-d749c30acd33.webp',
 description:'탑을 오르기 시작한 모험가의 기본 전신 외형',
 sourceLabel:'기본 지급',tradeable:false,artStatus:'ready'
};
export const APPEARANCES:AppearanceData[]=[
 starter,
 {
  id:'corsair',name:'코르세어',rarity:'B',
  imagePath:"assets/characters/appearances/corsair-23cd3b78fe82.webp",
  description:'황금 장식의 삼각모와 커틀라스, 화승총을 지닌 고딕 해적.',
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'
 }
,
 {id:"teddy",name:"테디",rarity:"B",imagePath:"assets/characters/appearances/teddy-90735135ad9b.webp",
  description:"곰돌이 후드와 포근한 갈색 코트를 입은 모험가.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"proletaria",name:"프롤레타리아",rarity:"A",imagePath:"assets/characters/appearances/proletaria-04b3cd8ec79f.webp",
  description:"검은 긴 머리와 낡은 작업복, 거대한 망치와 낫을 지닌 혁명가.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"mechanic",name:"메카닉",rarity:"C",imagePath:"assets/characters/appearances/mechanic-f87a0bf1f4a2.webp",
  description:"고글과 공구 가방을 착용하고 렌치와 정밀 기계를 다루는 정비사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"skeleton_knight",name:"해골기사",rarity:"C",imagePath:"assets/characters/appearances/skeleton_knight-1d9371e754bd.webp",
  description:"낡은 판금 갑옷을 두르고 장검과 거대한 방패를 든 해골 기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"valkyrie",name:"발키리",rarity:"A",imagePath:"assets/characters/appearances/valkyrie-a22cd8cc46a8.webp",
  description:"백색 날개와 빛나는 후광, 은빛 갑옷을 두르고 검과 성서를 든 전사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"seraphim",name:"세라핌",rarity:"A",imagePath:"assets/characters/appearances/seraphim-f20daf44dec1.webp",
  description:"수많은 눈과 겹겹의 흑백 날개, 가시 후광과 사슬 장식으로 이루어진 천사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"ophanim",name:"오파님",rarity:"A",imagePath:"assets/characters/appearances/ophanim-03ab6ea09819.webp",
  description:"거대한 눈을 중심으로 수많은 눈이 박힌 백금빛 고리와 사슬 장식이 교차하는 천사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"cain",name:"카인",rarity:"SR",imagePath:"assets/characters/appearances/cain-2d736a29c0e5.webp",
  description:"이마에 붉은 표식을 새기고 돌칼과 사슬에 묶인 돌을 든 방랑자.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"plague_doctor",name:"역병의사",rarity:"B",imagePath:"assets/characters/appearances/plague_doctor-4e692458eaea.webp",
  description:"검은 의복과 새부리 가면을 쓰고 지팡이와 붉은 등불을 든 역병의사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"knight",name:"기사",rarity:"B",imagePath:"assets/characters/appearances/knight-a15fd8a32dbd.webp",
  description:"청록빛 문양이 새겨진 판금갑옷을 입고 장검과 커다란 방패를 든 기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"nidhogg",name:"니드호그",rarity:"SSR",imagePath:"assets/characters/appearances/nidhogg-15d5c1976c1f.webp",
  description:"검은 비늘과 거대한 날개에 사슬과 적갈색 장식을 두른 고대의 용.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bahamut",name:"바하무트",rarity:"SSR",imagePath:"assets/characters/appearances/bahamut-0dc22fd371b0.webp",
  description:"검은 비늘과 적갈색 지느러미를 지닌 거대한 고대 물고기.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"baal",name:"바알",rarity:"SSR",imagePath:"assets/characters/appearances/baal-ce1a88984f47.webp",
  description:"굽은 뿔과 붉은 꼬리를 지니고 거대한 창을 든 악마.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"puppeteer",name:"인형술사",rarity:"SSR",imagePath:"assets/characters/appearances/puppeteer-9b1c4849e516.webp",
  description:"검은 베일과 긴 은발을 지니고 붉은 실로 관절 인형을 조종하는 인형술사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"rat_king",name:"쥐들의 왕",rarity:"SR",imagePath:"assets/characters/appearances/rat_king-4e7ee191fc09.webp",
  description:"낡은 왕관과 해진 로브를 걸치고 쥐 무리를 거느리며 왕홀을 든 쥐들의 왕.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"association_archivist",name:"협회 기록관",rarity:"C",imagePath:"assets/characters/appearances/association_archivist-302de6b19223.webp",
  description:"금속 기록필과 두꺼운 기록서를 들고 두루마리를 지닌 협회의 기록관.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"returning_knight",name:"귀환기사",rarity:"C",imagePath:"assets/characters/appearances/returning_knight-15a9f57d2044.webp",
  description:"낡은 투구와 사슬갑옷을 걸치고 양손으로 검을 든 귀환기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"novar_outskirts_guard",name:"노바르 외곽 경비대",rarity:"C",imagePath:"assets/characters/appearances/novar_outskirts_guard-41f717e45618.webp",
  description:"창과 검을 갖추고 노바르 외곽을 지키는 경비대원.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"mining_crew",name:"채굴반",rarity:"C",imagePath:"assets/characters/appearances/mining_crew-5995badd048d.webp",
  description:"조명이 달린 모자를 쓰고 곡괭이와 등불을 갖춘 채굴반원.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"slime",name:"슬라임",rarity:"C",imagePath:"assets/characters/appearances/slime-7539a5faac9f.webp",
  description:"슬라임 외형",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"faceless_one",name:"얼굴없는 자",rarity:"C",imagePath:"assets/characters/appearances/faceless_one-09689d34a94e.webp",
  description:"얼굴없는 자 외형",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
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
