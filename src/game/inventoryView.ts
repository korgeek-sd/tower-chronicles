import type {GameState} from './types';
import {TOWERS,towerIds,POTIONS,potionIds,PASSIVES,WEAPONS} from './data/config';
import {APPEARANCES} from './data/cosmetics';
import {itemName} from './engine/state';
import {bookName} from './engine/loot';
export const categories=['all','equipment','materials','potions','skillbooks','tickets','cosmetics','other'] as const;
export type InventoryCategory=typeof categories[number];
export const categoryNames:Record<InventoryCategory,string>={all:'전체',equipment:'장비',materials:'재료',potions:'포션',skillbooks:'스킬북',tickets:'입장권',cosmetics:'외형',other:'기타'};
export interface InventoryViewItem {key:string;category:InventoryCategory;name:string;quantity:number;iconId:string;tier?:number;enhancement?:number;description:string;equipped?:boolean;learned?:boolean;registered?:boolean;sourceId:string;order:number;stack:boolean}
export type InventorySort='default'|'name'|'tier'|'quantity';
export interface InventoryFilter {tier:number;status:boolean}
export function inventoryView(s:GameState):InventoryViewItem[]{
 const out:InventoryViewItem[]=[];
 const add=(x:Omit<InventoryViewItem,'key'>)=>{if(x.quantity>0)out.push({...x,key:x.category+':'+x.sourceId});};
 s.items.forEach(i=>add({category:'equipment',sourceId:i.id,name:itemName(i),quantity:1,iconId:i.kind in WEAPONS||['armor','boots'].includes(i.kind)?i.kind:'accessory',tier:i.tier,enhancement:i.enhancement,equipped:Object.values(s.equipped).includes(i.id),description:i.id==='starter'?'기록원 지급용 검. 제작 검보다 공격력이 낮습니다.':i.kind in WEAPONS?WEAPONS[i.kind as keyof typeof WEAPONS].description:i.kind in PASSIVES?PASSIVES[i.kind as keyof typeof PASSIVES].description:'노바르에서 제작한 탐사 장비입니다.',order:0,stack:false}));
 towerIds.forEach((t,order)=>{s.materials[t].forEach((quantity,index)=>add({category:'materials',sourceId:t+':'+index,name:`T${index+1} ${TOWERS[t].material}`,quantity,iconId:t,tier:index+1,description:'안전 귀환으로 확보한 제작 재료입니다.',order,stack:true}));s.tickets[t].forEach((quantity,index)=>add({category:'tickets',sourceId:t+':'+index,name:`${TOWERS[t].name} ${index+1}층 입장권`,quantity,iconId:'tickets',tier:Math.ceil((index+1)/10),description:'해당 층 입장 시 1장이 소비됩니다.',order:order*50+index,stack:true}));});
 potionIds.forEach((p,order)=>add({category:'potions',sourceId:p,name:POTIONS[p].name+' 포션',quantity:s.potions[p],iconId:p==='revival'?'potions':'health',tier:POTIONS[p].tier,description:POTIONS[p].description,order,stack:true}));
 Object.entries(s.skillBooks).forEach(([id,quantity])=>add({category:'skillbooks',sourceId:id,name:bookName(id),quantity,iconId:'skillbooks',learned:s.learned.includes(id),description:'사용하면 해당 기술을 배웁니다. 원정 중에는 사용할 수 없습니다.',order:0,stack:true}));
 APPEARANCES.forEach(a=>add({category:'cosmetics',sourceId:a.id,name:a.name,quantity:s.cosmetics.appearanceItems[a.id]||0,iconId:'cosmetics',registered:s.cosmetics.unlockedAppearanceIds.includes(a.id),description:a.description+' · '+a.sourceLabel,order:0,stack:true}));
 Object.entries(s.lootItems).forEach(([id,quantity])=>add({category:'other',sourceId:id,name:id,quantity,iconId:'other',description:'안전 귀환으로 보관한 영구 아이템입니다.',order:0,stack:true}));return out;
}
export function selectInventory(items:InventoryViewItem[],category:InventoryCategory='all',query='',sort:InventorySort='default',filter:InventoryFilter={tier:0,status:false}){
 const name=(a:InventoryViewItem,b:InventoryViewItem)=>a.name.localeCompare(b.name,'ko')||a.key.localeCompare(b.key);
 return items.filter(i=>(category==='all'||i.category===category)&&i.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())&&(!filter.tier||i.tier===filter.tier)&&(!filter.status||(category==='equipment'?i.equipped:category==='skillbooks'?!i.learned:category==='cosmetics'?!i.registered:true))).sort((a,b)=>{
 if(sort==='name')return name(a,b);if(sort==='tier')return (b.tier||0)-(a.tier||0)||name(a,b);if(sort==='quantity')return b.quantity-a.quantity||name(a,b);
 const cat=categories.indexOf(a.category)-categories.indexOf(b.category);if(cat)return cat;
 if(a.category==='equipment')return Number(b.equipped)-Number(a.equipped)||(b.tier||0)-(a.tier||0)||(b.enhancement||0)-(a.enhancement||0)||name(a,b);
 if(a.category==='skillbooks')return Number(a.learned)-Number(b.learned)||name(a,b);
 if(a.category==='cosmetics')return Number(a.registered)-Number(b.registered)||name(a,b);
 return a.order-b.order||(a.tier||0)-(b.tier||0)||name(a,b);
 });
}

