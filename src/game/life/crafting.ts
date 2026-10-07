import type {VillageLifeState} from '../../online/villageLife';
export type ProductId='potion'|'attack_food'|'defense_food'|'experience_food'|'challenge_ticket';
export type FoodId=Extract<ProductId,`${string}_food`>;
export const PRODUCT_NAMES:Record<ProductId,string>={potion:'회복 포션',attack_food:'공격 음식',defense_food:'방어 음식',experience_food:'경험치 음식',challenge_ticket:'점령전 도전권'};
export const CRAFT_RECIPES:readonly {id:ProductId;material:'herb'|'pepper'|'potato'|'wheat'|'stone';base:number;kind:'herb'|'farm'|'city';description:string}[]=[
 {id:'potion',material:'herb',base:1000,kind:'herb',description:'개당 HP 1 · 일반 사냥 후 자동 사용'},
 {id:'attack_food',material:'pepper',base:1,kind:'farm',description:'PvE 공격력 +10% · 30회 전투'},
 {id:'defense_food',material:'potato',base:1,kind:'farm',description:'PvE 방어력 +10% · 30회 전투'},
 {id:'experience_food',material:'wheat',base:1,kind:'farm',description:'PvE 경험치 +10% · 30회 전투'},
 {id:'challenge_ticket',material:'stone',base:1,kind:'city',description:'점령전 도전 시 1개 소비 · 전쟁 연결 예정'},
];
export interface LifeActionRequest{id:string;town:string;action:'craft'|'food'|'well';item:ProductId|'well';count:number}
export function validLifeAction(value:unknown):value is LifeActionRequest{
 if(!value||typeof value!=='object')return false;const r=value as LifeActionRequest;
 return typeof r.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)&&typeof r.town==='string'&&/^(city|herb-[1-5]|farm-[1-5])$/.test(r.town)&&Number.isInteger(r.count)&&r.count>=1&&r.count<=100&&(r.action==='craft'?CRAFT_RECIPES.some(x=>x.id===r.item):r.action==='food'?['attack_food','defense_food','experience_food'].includes(r.item):r.action==='well'&&r.item==='well'&&r.count===1);
}
export function craftLimit(s:VillageLifeState,id:ProductId){const r=CRAFT_RECIPES.find(x=>x.id===id),t=s.towns.find(x=>x.id===s.location);if(!r||!t||t.kind!=='city'&&t.kind!==r.kind)return 0;return Math.max(0,Math.min(100,s.actionPoints,Math.floor((s.materials[r.material]??0)/10)));}
export function craftPreview(id:ProductId,count:number,mastery:number,carry:number){const base=CRAFT_RECIPES.find(x=>x.id===id)!.base;let quantity=0;for(let i=0;i<count;i++){carry+=base*Math.min(50,Math.floor(mastery/100));quantity+=base+Math.floor(carry/100);carry%=100;mastery++;}return {quantity,carry,mastery};}
