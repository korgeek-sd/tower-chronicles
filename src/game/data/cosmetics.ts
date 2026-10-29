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
 {id:"proletaria",name:"프롤레타리아",rarity:"A",imagePath:"assets/characters/appearances/proletaria-a229ecdc09eb.webp",
  description:"검은 긴 머리와 낡은 작업복, 거대한 망치와 낫을 지닌 혁명가.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"mechanic",name:"메카닉",rarity:"C",imagePath:"assets/characters/appearances/mechanic-f87a0bf1f4a2.webp",
  description:"자신이 만든 기계가 수많은 생명을 앗아간 이유를 끝내 밝혀내지 못한 기술자.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"skeleton_knight",name:"해골기사",rarity:"C",imagePath:"assets/characters/appearances/skeleton_knight-65d28cc4f7e7.webp",
  description:"왕국이 멸망하고 육신이 썩어 사라진 뒤에도 주군과의 맹세를 지키는 기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"valkyrie",name:"발키리",rarity:"A",imagePath:"assets/characters/appearances/valkyrie-a22cd8cc46a8.webp",
  description:"백색 날개와 빛나는 후광, 은빛 갑옷을 두르고 검과 성서를 든 전사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"seraphim",name:"세라핌",rarity:"A",imagePath:"assets/characters/appearances/seraphim-3ca6492f504e.webp",
  description:"수많은 눈과 겹겹의 흑백 날개, 가시 후광과 사슬 장식으로 이루어진 천사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"ophanim",name:"오파님",rarity:"A",imagePath:"assets/characters/appearances/ophanim-293fd8efbd0b.webp",
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
 {id:"nidhogg",name:"니드호그",rarity:"SSR",imagePath:"assets/characters/appearances/nidhogg-b1f245699fec.webp",
  description:"검은 비늘과 거대한 날개에 사슬과 적갈색 장식을 두른 고대의 용.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bahamut",name:"바하무트",rarity:"SSR",imagePath:"assets/characters/appearances/bahamut-6f2bad33f638.webp",
  description:"검은 비늘과 적갈색 지느러미를 지닌 거대한 고대 물고기.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"baal",name:"바알",rarity:"SSR",imagePath:"assets/characters/appearances/baal-d5dd22a83f6c.webp",
  description:"굽은 뿔과 붉은 꼬리를 지니고 거대한 창을 든 악마.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"puppeteer",name:"인형술사",rarity:"SSR",imagePath:"assets/characters/appearances/puppeteer-9b1c4849e516.webp",
  description:"검은 베일과 긴 은발을 지니고 붉은 실로 관절 인형을 조종하는 인형술사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"rat_king",name:"쥐들의 왕",rarity:"SR",imagePath:"assets/characters/appearances/rat_king-1442030871fd.webp",
  description:"낡은 왕관과 해진 로브를 걸치고 쥐 무리를 거느리며 왕홀을 든 쥐들의 왕.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"association_archivist",name:"협회 기록관",rarity:"C",imagePath:"assets/characters/appearances/association_archivist-1ecce291a5d6.webp",
  description:"평생 타인의 삶을 기록했지만 정작 자신의 이름은 어디에도 남기지 못한 기록관.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"returning_knight",name:"귀환기사",rarity:"C",imagePath:"assets/characters/appearances/returning_knight-d6739a1eead4.webp",
  description:"수많은 전장에서 살아 돌아왔지만 더 이상 돌아갈 고향이 없는 기사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"novar_outskirts_guard",name:"노바르 외곽 경비대",rarity:"C",imagePath:"assets/characters/appearances/novar_outskirts_guard-7857a466e725.webp",
  description:"평생 도시의 문을 지켰지만 결국 자신은 그 문을 통과하지 못한 경비병.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"mining_crew",name:"채굴반",rarity:"C",imagePath:"assets/characters/appearances/mining_crew-c2a27c4817e0.webp",
  description:"동료들이 하나둘 사라지는 광산에서도 끝내 곡괭이를 내려놓지 못한 광부.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"slime",name:"슬라임",rarity:"C",imagePath:"assets/characters/appearances/slime-7539a5faac9f.webp",
  description:"수많은 것을 삼켰지만 자신의 것이라 부를 것은 아무것도 없는 존재.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"faceless_one",name:"얼굴없는 자",rarity:"C",imagePath:"assets/characters/appearances/faceless_one-09689d34a94e.webp",
  description:"모든 기록에서 얼굴과 이름이 지워져 존재조차 증명할 수 없게 된 자.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"saintess",name:"성녀",rarity:"SR",imagePath:"assets/characters/appearances/saintess-29a1458166d1.webp",
  description:"검은 성의를 걸치고 해골 장식의 지팡이와 펼친 성서를 든 성녀.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"summoner",name:"소환술사",rarity:"B",imagePath:"assets/characters/appearances/summoner-158e9c44bd6e.webp",
  description:"봉인된 두루마리와 사슬을 지니고 검은 늑대와 동행하는 소환술사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"hexer",name:"주박사",rarity:"C",imagePath:"assets/characters/appearances/hexer-11e073a27196.webp",
  description:"타인의 불행을 대가로 소원을 이루어 주다 결국 스스로를 저주한 술사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"ice_mage",name:"얼음법사",rarity:"C",imagePath:"assets/characters/appearances/ice_mage-a0e5a21e9b2c.webp",
  description:"사랑하는 이의 죽음을 막기 위해 시간을 얼리려다 자신의 삶마저 멈춰 버린 마법사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"inquisitor",name:"이단심문관",rarity:"C",imagePath:"assets/characters/appearances/inquisitor-935681bfff19.webp",description:"신의 이름으로 수많은 죄인을 심판했지만 정작 자신의 죄는 용서받지 못한 자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"nameless_pilgrim",name:"이름없는 순례자",rarity:"C",imagePath:"assets/characters/appearances/nameless_pilgrim-d1b7cd17fa98.webp",description:"자신이 지은 죄조차 모른 채 평생 용서를 구하며 탑을 떠도는 순례자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"cultist",name:"이교도",rarity:"B",imagePath:"assets/characters/appearances/cultist-39f49aebf524.webp",description:"낡은 두건과 누더기 로브를 걸치고 단검과 해진 경전을 지닌 이교도.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"scout",name:"정찰병",rarity:"C",imagePath:"assets/characters/appearances/scout-79aa0d899db2.webp",description:"누구보다 먼저 위험을 발견했지만 단 한 번도 동료들을 구하지 못한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"celestial_archer",name:"천상의 사수",rarity:"B",imagePath:"assets/characters/appearances/celestial_archer-163199b8d562.webp",description:"백색 날개와 은빛 갑옷을 두르고 정교한 활을 든 천상의 사수.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"arcane_archer",name:"비전궁수",rarity:"C",imagePath:"assets/characters/appearances/arcane_archer-733d3d2a8fe7.webp",description:"별의 움직임을 따라 화살을 쏘다 자신의 운명을 가리키는 별을 잃어버린 사수.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"thief",name:"도적",rarity:"C",imagePath:"assets/characters/appearances/thief-f6aa16d9020a.webp",description:"살아남기 위해 모든 것을 훔치다 결국 자신의 이름마저 빼앗긴 도둑.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"pickpocket",name:"소매치기",rarity:"C",imagePath:"assets/characters/appearances/pickpocket-f33e435f5e71.webp",description:"죽은 자의 품에서 훔친 기도문 한 장 때문에 평생 쫓기는 신세가 된 소매치기.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"musketeer",name:"머스킷병",rarity:"C",imagePath:"assets/characters/appearances/musketeer-856a01ebb909.webp",description:"왕국이 멸망한 뒤에도 전쟁이 끝났다는 명령을 받지 못한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bounty_hunter",name:"현상금 사냥꾼",rarity:"C",imagePath:"assets/characters/appearances/bounty_hunter-c9baeeca1bf2.webp",description:"수많은 죄인을 추적하다 어느 날 자신의 이름이 적힌 수배서를 발견한 사냥꾼.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"assault_gunner",name:"돌격포수",rarity:"B",imagePath:"assets/characters/appearances/assault_gunner-c943be85cea4.webp",description:"해진 망토와 탄약 벨트를 걸치고 넓은 포구의 대형 총포를 든 돌격포수.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"apprentice_mage",name:"견습 마법사",rarity:"C",imagePath:"assets/characters/appearances/apprentice_mage-405af5eafc3a.webp",description:"스승의 금서를 펼쳤다가 자신의 미래가 기록된 백지 한 장을 발견한 견습생.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"advanced_mage",name:"고급 마법사",rarity:"A",imagePath:"assets/characters/appearances/advanced_mage-fa1aafe579fe.webp",description:"붉은 안감의 고깔모자와 로브를 걸치고 루비 장식 지팡이를 지닌 고급 마법사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"archmage",name:"대마법사",rarity:"SR",imagePath:"assets/characters/appearances/archmage-098128fade40.webp",description:"긴 은발과 붉은 안감의 로브를 두르고 거대한 마법진과 불꽃을 펼치는 대마법사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"alchemist",name:"연금술사",rarity:"B",imagePath:"assets/characters/appearances/alchemist-c694c0994604.webp",description:"붉은 물약 플라스크와 여러 시약병을 지니고 해진 앞치마를 두른 연금술사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
{id:"nameless_sinner",name:"이름없는 죄인",rarity:"SR",imagePath:"assets/characters/appearances/nameless_sinner-d1e1ca138f17.webp",description:"해진 옷과 붕대를 두르고 끊어진 사슬과 수갑을 찬 이름없는 죄인.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"blacksmith",name:"대장장이",rarity:"B",imagePath:"assets/characters/appearances/blacksmith-bbbc6ce0235c.webp",description:"낡은 가죽 앞치마와 도구 벨트를 두르고 망치와 집게를 든 대장장이.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bourgeoisie",name:"부르주아지",rarity:"SR",imagePath:"assets/characters/appearances/bourgeoisie-55ec362a480e.webp",description:"금빛 장식의 롱코트와 조끼를 입고 지팡이와 금화를 지닌 부르주아지.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"contract_mercenary",name:"계약용병",rarity:"B",imagePath:"assets/characters/appearances/contract_mercenary-e9050d6bf383.webp",description:"해진 붉은 망토와 가죽 장비를 걸치고 커다란 검을 어깨에 멘 계약용병.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"lumpen",name:"룸펜",rarity:"C",imagePath:"assets/characters/appearances/lumpen-af215675cc90.webp",description:"가진 것도 지킬 것도 없이 세상을 떠돌다 자신의 존재마저 잊힌 자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
{id:"intellectual",name:"인텔리",rarity:"SR",imagePath:"assets/characters/appearances/intellectual-46ec6e964259.webp",description:"긴 학자 외투와 회중시계를 갖추고 책과 두루마리를 지닌 인텔리.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"golem",name:"골렘",rarity:"C",imagePath:"assets/characters/appearances/golem-32a3c62e0a47.webp",description:"주인이 사라진 뒤에도 마지막 명령을 수행하며 존재의 이유를 묻는 피조물.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"butcher",name:"도축업자",rarity:"C",imagePath:"assets/characters/appearances/butcher-a95c87e77ae8.webp",description:"평생 생명을 도살하다 어느 날부터 죽은 자들의 목소리를 듣게 된 도축업자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"necromancer",name:"사령술사",rarity:"SR",imagePath:"assets/characters/appearances/necromancer-ea3c02973234.webp",description:"해골 장식 지팡이와 마법서를 지니고 보랏빛 영혼 불꽃을 다루는 사령술사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"grave_robber",name:"도굴꾼",rarity:"C",imagePath:"assets/characters/appearances/grave_robber-651bca2f1018.webp",description:"수많은 무덤을 파헤치다 자신의 이름이 새겨진 관을 발견한 도굴꾼.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"court_jester",name:"궁정 광대",rarity:"C",imagePath:"assets/characters/appearances/court_jester-f3273b99a6ec.webp",description:"왕국이 멸망하던 날에도 왕의 명령에 따라 홀로 웃고 있던 광대.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"noble_knight",name:"귀족기사",rarity:"SR",imagePath:"assets/characters/appearances/noble_knight-c890a64f92e7.webp",description:"모피 망토와 금빛 장식의 붉은 의장을 두르고 화려한 대검을 지닌 귀족기사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"crossbowman",name:"석궁병",rarity:"C",imagePath:"assets/characters/appearances/crossbowman-64b4356b6055.webp",description:"평생 명령에 따라 화살을 쏘았지만 자신이 누구를 죽였는지 알지 못한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"lumberjack",name:"벌목꾼",rarity:"C",imagePath:"assets/characters/appearances/lumberjack-38ee59603c16.webp",description:"평생 숲을 베어 길을 만들다 마지막 나무와 함께 자신의 고향마저 잃어버린 벌목꾼.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"nameless_king",name:"이름 잃은 왕",rarity:"SSR",imagePath:"assets/characters/appearances/nameless_king-0e66257e14de.webp",
  description:"빛바랜 왕관과 찢어진 모피 망토를 두르고 피 묻은 대검과 사슬을 지닌, 기록에서 이름이 지워진 왕.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"first_forgotten_one",name:"첫 번째 잊혀진 자",rarity:"SSR",imagePath:"assets/characters/appearances/first_forgotten_one-d6f47fb1a875.webp",
  description:"뱀이 휘감긴 몸과 가시덩굴, 피 묻은 선악과를 든 최초의 추방자. 그의 이름은 탑의 기록에서 지워졌다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"false_savior",name:"거짓 구원자",rarity:"SSR",imagePath:"assets/characters/appearances/false_savior-314bb25e8c12.webp",
  description:"가시관을 닮은 후광과 피로 물든 성의를 걸치고 붉은 보석이 박힌 성장을 든, 구원을 사칭하는 자.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"antichrist",name:"적그리스도",rarity:"SR",imagePath:"assets/characters/appearances/antichrist-f1e4175ae584.webp",
  description:"검게 지워진 얼굴과 가시 후광, 속이 빈 손바닥과 찢어진 성의를 지닌 거짓된 메시아.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"wandering_preacher",name:"떠돌이 설교사",rarity:"B",imagePath:"assets/characters/appearances/wandering_preacher-e4b366ac97d0.webp",
  description:"낡은 성의와 회색 두건을 걸치고, 종과 십자가 장식 및 경전을 지닌 채 탑을 떠도는 설교사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"shepherd",name:"양치기",rarity:"B",imagePath:"assets/characters/appearances/shepherd-0117a18adfac.webp",
  description:"낡은 양털 망토와 붉은 목도리를 두르고 구부러진 목자 지팡이와 여장을 지닌 방랑하는 양치기.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
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