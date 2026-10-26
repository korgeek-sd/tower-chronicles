import type {VillageLifeState} from '../../online/villageLife';
export type ProductId='vitality_potion'|'potion'|'attack_food'|'defense_food'|'experience_food'|'challenge_ticket';
export type FoodId=Extract<ProductId,`${string}_food`>;
export type LifeMasteryTrack='herb'|'farm'|'ticket';
export const LIFE_MASTERY_NAMES:Record<LifeMasteryTrack,string>={herb:'약초 숙련도',farm:'농업 숙련도',ticket:'도전권 제작 숙련도'};
export const LIFE_MASTERY_LEVEL_XP=[0,100,250,450,700,1000,1400,1900,2500,3200] as const;
export const LIFE_MASTERY_LEVEL_BONUS=[0,3,7,10,13,17,20,23,27,30] as const;
export const LIFE_MASTERY_MAX_XP=3200;
export function lifeMasteryTrack(id:ProductId):LifeMasteryTrack{return id==='potion'?'herb':id==='challenge_ticket'?'ticket':'farm';}
export function lifeMasteryLevel(xp:number){const valid=Math.max(0,Math.min(LIFE_MASTERY_MAX_XP,Math.floor(Number.isFinite(xp)?xp:0)));let level=1;for(let i=1;i<LIFE_MASTERY_LEVEL_XP.length;i++)if(valid>=LIFE_MASTERY_LEVEL_XP[i])level=i+1;return level;}
export function lifeMasteryBonus(xp:number){return LIFE_MASTERY_LEVEL_BONUS[lifeMasteryLevel(xp)-1];}
export const PRODUCT_NAMES:Record<ProductId,string>={vitality_potion:'활력 회복 포션',potion:'회복 포션',attack_food:'떡볶이',defense_food:'감자튀김',experience_food:'빵',challenge_ticket:'점령전 도전권'};
export const CRAFT_RECIPES:readonly {id:ProductId;material:'herb'|'pepper'|'potato'|'wheat'|'stone';base:number;kind:'herb'|'farm'|'city';description:string}[]=[
 {id:'potion',material:'herb',base:1000,kind:'herb',description:'개당 HP 1 · 일반 사냥 후 자동 사용'},
 {id:'attack_food',material:'pepper',base:1,kind:'farm',description:'PvE 공격력 +10% · 30회 전투'},
 {id:'defense_food',material:'potato',base:1,kind:'farm',description:'PvE 방어력 +10% · 30회 전투'},
 {id:'experience_food',material:'wheat',base:1,kind:'farm',description:'PvE 경험치 +10% · 30회 전투'},
 {id:'challenge_ticket',material:'stone',base:1,kind:'city',description:'마을 선전포고 시 100개 소비 · 거래 가능'},
];
export interface LifeActionRequest{id:string;town:string;action:'craft'|'food'|'well'|'vitality';item:ProductId|'well';count:number}
export function validLifeAction(value:unknown):value is LifeActionRequest{
 if(!value||typeof value!=='object')return false;const r=value as LifeActionRequest;
 return typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&typeof r.town==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(r.town)&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100&&(r.action==='craft'?CRAFT_RECIPES.some(x=>x.id===r.item):r.action==='food'?['attack_food','defense_food','experience_food'].includes(r.item):(r.action==='vitality'?r.item==='vitality_potion'&&r.count===1:r.action==='well'&&r.item==='well'&&r.count===1));
}
export function craftLimit(s:VillageLifeState,id:ProductId){const r=CRAFT_RECIPES.find(x=>x.id===id),t=s.towns.find(x=>x.id===s.location);if(!r||!t||t.kind!=='city'&&t.kind!==r.kind)return 0;return Math.max(0,Math.min(100,s.actionPoints,Math.floor((s.materials[r.material]??0)/10)));}
export function craftPreview(id:ProductId,count:number,mastery:number,carry:number){const base=CRAFT_RECIPES.find(x=>x.id===id)!.base;let quantity=0;for(let i=0;i<count;i++){carry+=base*lifeMasteryBonus(mastery);quantity+=base+Math.floor(carry/100);carry%=100;mastery=Math.min(LIFE_MASTERY_MAX_XP,mastery+1);}return {quantity,carry,mastery};}

