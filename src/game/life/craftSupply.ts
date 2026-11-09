import {CRAFT_RECIPES,type ProductId} from './crafting';
import type {LifeMaterial,LifeResource,LifeTown,VillageLifeState} from '../../online/villageLife';

/** Only herbs and crops come from village production. Stones come from dismantling equipment. */
export function craftingMaterialSource(material:LifeMaterial):LifeResource|'dismantle'{
 return material==='herb'?'herb':material==='stone'?'dismantle':'farm';
}
export interface CraftSupplyNeed{
 product:ProductId;material:LifeMaterial;required:number;owned:number;missing:number;source:LifeResource|'dismantle';
}
export function craftingSupplyNeed(state:VillageLifeState,product:ProductId,count:number):CraftSupplyNeed{
 const recipe=CRAFT_RECIPES.find(r=>r.id===product);
 if(!recipe)throw Error('RECIPE_INVALID');
 const required=Math.max(1,Math.min(100,Math.floor(Number.isFinite(count)?count:1)))*10;
 const owned=Math.max(0,Math.floor(state.materials[recipe.material]??0));
 return {product,material:recipe.material,required,owned,missing:Math.max(0,required-owned),source:craftingMaterialSource(recipe.material)};
}
const stockFor=(town:LifeTown,source:LifeResource)=>source==='herb'?town.herbRemaining:town.farmRemaining;
/** Prefer a viable current town, otherwise choose a stocked town rather than sending players to an empty field. */
export function recommendedCraftSupplyTown(state:VillageLifeState,source:LifeResource):LifeTown|null{
 const candidates=state.towns.filter(t=>(t.kind===source||t.kind==='city')&&stockFor(t,source)>0);
 const current=candidates.find(t=>t.id===state.location);
 if(current)return current;
 return [...candidates].sort((a,b)=>stockFor(b,source)-stockFor(a,source)||a.tax-b.tax||a.id.localeCompare(b.id))[0]??null;
}
