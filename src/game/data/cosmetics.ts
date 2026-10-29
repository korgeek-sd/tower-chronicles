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
  description:'수많은 보물을 약탈했지만 마지막 항해에서 자신의 배가 세상의 모든 해도에서 지워졌음을 알게 된 해적.',
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'
 }
,
 {id:"teddy",name:"테디",rarity:"B",imagePath:"assets/characters/appearances/teddy-90735135ad9b.webp",
  description:"전쟁터의 아이들에게 곰 인형을 나눠주던 방랑자, 마지막 인형을 건넨 날 자신의 이름마저 잊어버렸다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"proletaria",name:"프롤레타리아",rarity:"A",imagePath:"assets/characters/appearances/proletaria-a229ecdc09eb.webp",
  description:"평범한 노동계급",
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
  description:"신의 명령에 따라 전사자의 영혼을 인도했지만 어느 전장에서 자신이 데려가야 할 영혼이 아직 살아 있음을 발견한 천상의 전사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"seraphim",name:"세라핌",rarity:"A",imagePath:"assets/characters/appearances/seraphim-3ca6492f504e.webp",
  description:"신의 가장 가까운 곳에서 영원히 찬송하던 천사였으나 어느 날 자신이 부르던 찬송의 마지막 구절이 사라졌음을 깨달은 존재.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"ophanim",name:"오파님",rarity:"A",imagePath:"assets/characters/appearances/ophanim-293fd8efbd0b.webp",
  description:"세상의 모든 죄와 운명을 지켜보도록 만들어졌지만 탑의 기록에서 지워진 자들만큼은 끝내 바라볼 수 없었던 천사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"cain",name:"카인",rarity:"SR",imagePath:"assets/characters/appearances/cain-2d736a29c0e5.webp",
  description:"최초로 형제의 피를 흘린 뒤 신에게 표식을 받고 영원히 죽음보다 긴 추방의 길을 걷게 된 죄인.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"plague_doctor",name:"역병의사",rarity:"B",imagePath:"assets/characters/appearances/plague_doctor-4e692458eaea.webp",
  description:"수천 명의 목숨을 구했지만 자신이 치료한 환자들이 모두 같은 날 죽음을 맞이한 이유를 알지 못한 의사.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"knight",name:"기사",rarity:"B",imagePath:"assets/characters/appearances/knight-a15fd8a32dbd.webp",
  description:"평생 왕에게 충성을 맹세했지만 마지막으로 받은 명령은 자신의 왕을 처형하라는 것이었다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"nidhogg",name:"니드호그",rarity:"SSR",imagePath:"assets/characters/appearances/nidhogg-b1f245699fec.webp",
  description:"세상의 뿌리를 갉아먹으며 종말을 기다리던 고대의 용으로, 그가 삼킨 이름들은 탑의 기록에서도 영원히 사라졌다고 전해진다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bahamut",name:"바하무트",rarity:"SSR",imagePath:"assets/characters/appearances/bahamut-6f2bad33f638.webp",
  description:"세상이 기록되기 이전의 바다를 떠받치던 태초의 존재로, 그 깊은 심연에는 신조차 기록하지 못한 최초의 비밀이 잠들어 있다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"baal",name:"바알",rarity:"SSR",imagePath:"assets/characters/appearances/baal-d5dd22a83f6c.webp",
  description:"수많은 왕국이 신이라 숭배했던 고대의 존재로, 그의 신전과 신도들이 말소된 뒤에도 제물의 이름만큼은 기억하고 있다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"puppeteer",name:"인형술사",rarity:"SSR",imagePath:"assets/characters/appearances/puppeteer-9b1c4849e516.webp",
  description:"왕과 영웅의 운명마저 붉은 실로 움직였다고 전해지는 존재로, 그가 끊어 버린 실의 주인들은 탑의 기록에서 흔적도 없이 사라졌다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"rat_king",name:"쥐들의 왕",rarity:"SR",imagePath:"assets/characters/appearances/rat_king-1442030871fd.webp",
  description:"역병과 기근으로 버려진 도시에서 살아남은 자들을 다스렸으나 마지막 백성마저 죽은 뒤에도 왕관을 내려놓지 못한 왕.",
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
  description:"수많은 기적으로 사람들을 구원했지만 자신이 받은 계시가 신이 아닌 탑의 기록에서 비롯되었음을 알게 된 성녀.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"summoner",name:"소환술사",rarity:"B",imagePath:"assets/characters/appearances/summoner-158e9c44bd6e.webp",
  description:"죽은 벗의 영혼을 다시 불러내는 데 성공했지만 돌아온 존재는 그를 전혀 기억하지 못했다.",
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
 {id:"cultist",name:"이교도",rarity:"B",imagePath:"assets/characters/appearances/cultist-39f49aebf524.webp",description:"메아쿨파의 외경을 진실이라 믿고 금서를 탐독하다 마침내 자신의 이름이 기록된 장을 발견한 신도.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"scout",name:"정찰병",rarity:"C",imagePath:"assets/characters/appearances/scout-79aa0d899db2.webp",description:"누구보다 먼저 위험을 발견했지만 단 한 번도 동료들을 구하지 못한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"celestial_archer",name:"천상의 사수",rarity:"B",imagePath:"assets/characters/appearances/celestial_archer-163199b8d562.webp",description:"신의 명령에 따라 단 한 번도 빗나가지 않는 화살을 쏘았지만 마지막 표적은 자신이 섬기던 천사였다.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
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
 {id:"assault_gunner",name:"돌격포수",rarity:"B",imagePath:"assets/characters/appearances/assault_gunner-c943be85cea4.webp",description:"적의 성벽을 무너뜨리는 데 평생을 바쳤지만 마지막 포격으로 자신이 지켜야 할 도시를 파괴한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"apprentice_mage",name:"견습 마법사",rarity:"C",imagePath:"assets/characters/appearances/apprentice_mage-405af5eafc3a.webp",description:"스승의 금서를 펼쳤다가 자신의 미래가 기록된 백지 한 장을 발견한 견습생.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"advanced_mage",name:"고급 마법사",rarity:"A",imagePath:"assets/characters/appearances/advanced_mage-fa1aafe579fe.webp",description:"수백 년간 전해지던 마법의 진리를 증명했지만 마지막 연구에서 세상의 법칙이 누군가에 의해 고쳐지고 있다는 사실을 발견한 마법사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.A},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"archmage",name:"대마법사",rarity:"SR",imagePath:"assets/characters/appearances/archmage-098128fade40.webp",description:"세상의 모든 마법을 이해한 끝에 자신이 사용하는 주문조차 누군가 미리 기록해 두었다는 사실을 발견한 마법사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"alchemist",name:"연금술사",rarity:"B",imagePath:"assets/characters/appearances/alchemist-c694c0994604.webp",description:"죽음을 되돌리는 영약을 완성했지만 그 대가로 자신의 남은 수명을 모두 잃어버린 연금술사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
{id:"nameless_sinner",name:"이름없는 죄인",rarity:"SR",imagePath:"assets/characters/appearances/nameless_sinner-d1e1ca138f17.webp",description:"자신이 저지르지 않은 죄까지 모두 짊어지고 처형되었으나 죽음 이후에도 죄를 고백하라는 명령을 받는 자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"blacksmith",name:"대장장이",rarity:"B",imagePath:"assets/characters/appearances/blacksmith-bbbc6ce0235c.webp",description:"수많은 영웅의 무기를 만들었지만 자신이 벼린 검으로 왕이 살해된 뒤 모든 기록에서 이름이 지워진 장인.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"bourgeoisie",name:"부르주아지",rarity:"SR",imagePath:"assets/characters/appearances/bourgeoisie-55ec362a480e.webp",description:"왕국의 전쟁과 평화를 모두 돈으로 사들였지만 정작 자신의 죽음을 막을 대가는 끝내 마련하지 못한 자본가.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"contract_mercenary",name:"계약용병",rarity:"B",imagePath:"assets/characters/appearances/contract_mercenary-e9050d6bf383.webp",description:"어떤 의뢰도 거절하지 않았지만 마지막 계약서에는 자신의 목숨을 대가로 바친다는 조항이 적혀 있었다.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"lumpen",name:"룸펜",rarity:"C",imagePath:"assets/characters/appearances/lumpen-af215675cc90.webp",description:"가진 것도 지킬 것도 없이 세상을 떠돌다 자신의 존재마저 잊힌 자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
{id:"intellectual",name:"인텔리",rarity:"SR",imagePath:"assets/characters/appearances/intellectual-46ec6e964259.webp",description:"탑의 기록에 존재하지 않는 역사를 연구하다 자신이 밝혀낸 진실과 함께 모든 학문에서 이름이 지워진 지식인.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"golem",name:"골렘",rarity:"C",imagePath:"assets/characters/appearances/golem-32a3c62e0a47.webp",description:"주인이 사라진 뒤에도 마지막 명령을 수행하며 존재의 이유를 묻는 피조물.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"butcher",name:"도축업자",rarity:"C",imagePath:"assets/characters/appearances/butcher-a95c87e77ae8.webp",description:"평생 생명을 도살하다 어느 날부터 죽은 자들의 목소리를 듣게 된 도축업자.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"necromancer",name:"사령술사",rarity:"SR",imagePath:"assets/characters/appearances/necromancer-ea3c02973234.webp",description:"죽은 자들의 영혼을 불러 수많은 비밀을 알아냈지만 어느 날부터 모든 망자가 똑같은 이름 하나만 속삭이기 시작한 술사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"grave_robber",name:"도굴꾼",rarity:"C",imagePath:"assets/characters/appearances/grave_robber-651bca2f1018.webp",description:"수많은 무덤을 파헤치다 자신의 이름이 새겨진 관을 발견한 도굴꾼.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"court_jester",name:"궁정 광대",rarity:"C",imagePath:"assets/characters/appearances/court_jester-f3273b99a6ec.webp",description:"왕국이 멸망하던 날에도 왕의 명령에 따라 홀로 웃고 있던 광대.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"noble_knight",name:"귀족기사",rarity:"SR",imagePath:"assets/characters/appearances/noble_knight-c890a64f92e7.webp",description:"수많은 전쟁에서 왕국을 지켜 영웅으로 추앙받았지만 자신이 섬긴 왕이 백성들의 이름을 탑에서 지우고 있음을 알게 된 기사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"crossbowman",name:"석궁병",rarity:"C",imagePath:"assets/characters/appearances/crossbowman-64b4356b6055.webp",description:"평생 명령에 따라 화살을 쏘았지만 자신이 누구를 죽였는지 알지 못한 병사.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"lumberjack",name:"벌목꾼",rarity:"C",imagePath:"assets/characters/appearances/lumberjack-38ee59603c16.webp",description:"평생 숲을 베어 길을 만들다 마지막 나무와 함께 자신의 고향마저 잃어버린 벌목꾼.",proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.C},sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"nameless_king",name:"이름 잃은 왕",rarity:"SSR",imagePath:"assets/characters/appearances/nameless_king-0e66257e14de.webp",
  description:"세상의 모든 왕국을 정복하고 자신의 이름을 영원히 남기려 했지만 탑의 기록에서 단 한 글자도 남기지 못한 채 말소된 왕.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"first_forgotten_one",name:"첫 번째 잊혀진 자",rarity:"SSR",imagePath:"assets/characters/appearances/first_forgotten_one-d6f47fb1a875.webp",
  description:"금지된 열매를 취해 최초의 원죄를 세상에 남겼으나 정작 탑의 기록에서는 자신의 이름을 빼앗긴 최초의 추방자.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"false_savior",name:"거짓 구원자",rarity:"SSR",imagePath:"assets/characters/appearances/false_savior-314bb25e8c12.webp",
  description:"모든 죄를 대신 짊어지겠다며 세상에 나타났으나 그가 구원한 자들의 이름은 하나둘 탑의 기록에서 지워지고 있었다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SSR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}
,
 {id:"antichrist",name:"적그리스도",rarity:"SR",imagePath:"assets/characters/appearances/antichrist-f1e4175ae584.webp",
  description:"신의 계시를 전한다며 사람들을 현혹했으나 그의 손바닥에 새겨진 빈 상처에서 흘러나온 것은 구원이 아닌 말소의 예언이었다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.SR},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"wandering_preacher",name:"떠돌이 설교사",rarity:"B",imagePath:"assets/characters/appearances/wandering_preacher-e4b366ac97d0.webp",
  description:"죄를 고백하면 누구나 구원받을 수 있다고 설교했지만 자신의 죄를 고백한 날부터 신의 목소리가 들리지 않았다.",
  proposedBonus:{stat:'attack',percent:APPEARANCE_PROPOSED_PERCENT.B},
  sourceLabel:'외형 뽑기 · 준비중',tradeable:false,artStatus:'ready'}

,
 {id:"shepherd",name:"양치기",rarity:"B",imagePath:"assets/characters/appearances/shepherd-0117a18adfac.webp",
  description:"잃어버린 양 한 마리를 찾아 탑에 들어섰지만 수십 년이 지난 지금도 그 양이 누구의 것이었는지 기억하지 못한다.",
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