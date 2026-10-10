import type {GameState} from '../types';
import {inventoryView,type InventoryViewItem,type InventoryCategory} from '../inventoryView';
import {LIFE_MATERIAL_NAMES,type VillageLifeState,type LifeMaterial} from '../../online/villageLife';
import {CRAFT_RECIPES,PRODUCT_NAMES,type ProductId,type FoodId} from './crafting';
import {skillBookFor} from '../skills/books';
export const LIFE_INVENTORY_CATEGORIES:readonly InventoryCategory[]=['all','equipment','skillbooks','materials','potions','foods','other'];
/** Current inventory: canonical equipment and catalog skillbooks plus the server-owned life inventory. */
export function unifiedInventoryView(game:GameState,life:VillageLifeState|null):InventoryViewItem[]{
 const items=inventoryView(game).filter(i=>(i.category==='equipment'&&i.modern)||(i.category==='skillbooks'&&!!skillBookFor(i.sourceId)));
 if(!life)return items;
 for(const [order,id] of (Object.keys(LIFE_MATERIAL_NAMES) as LifeMaterial[]).entries()){
  const quantity=life.materials[id]??0;if(quantity<=0)continue;
  items.push({key:'life:material:'+id,category:'materials',sourceId:'life:'+id,lifeMaterial:id,name:LIFE_MATERIAL_NAMES[id],quantity,iconId:'materials',description:id==='stone'?'장비를 분해해서 얻은 분해석입니다. 10개로 점령전 도전권을 제작합니다.':`${LIFE_MATERIAL_NAMES[id]} 10개로 ${id==='herb'?'회복 포션 1,000개':'음식 1개'}를 제작합니다.`,facts:['보유 '+quantity.toLocaleString()+'개','제작재료 10개 / 1회'],order,stack:true});
 }
 for(const [order,r] of CRAFT_RECIPES.entries()){
  const quantity=life.products?.[r.id]??0;if(quantity<=0)continue;
  const food=r.id.endsWith('_food'),facts=['보유 '+quantity.toLocaleString()+'개'];
  if(food)facts.push('지속 30회 / 1개','남은전투 '+(life.foodTurns?.[r.id as FoodId]??0).toLocaleString()+'회','적용 PvE 전용');
  if(r.id==='potion')facts.push('회복 HP 1 / 1개','사용 일반 사냥 자동 회복');
  items.push({key:'life:product:'+r.id,category:food?'foods':r.id==='potion'?'potions':'other',sourceId:'life:'+r.id,lifeProduct:r.id as ProductId,name:PRODUCT_NAMES[r.id],quantity,iconId:food?'health':r.id==='potion'?'potions':'tickets',description:r.description+(food?' · 세 종류 동시 적용, 같은 음식은 지속 횟수만 늘어납니다.':''),facts,order,stack:true});
 }
 return items;
}
