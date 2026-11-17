import {PRODUCT_NAMES} from './crafting';
/** Server-authoritative tradable crafted consumables; vitality recovery is reward-only. */
export const MARKET_LIFE_PRODUCT_IDS=['potion','attack_food','defense_food','experience_food','adventurer_box'] as const;
export type MarketLifeProduct=typeof MARKET_LIFE_PRODUCT_IDS[number];
export const marketLifeProductItemId=(id:MarketLifeProduct)=>'product:life:'+id;
export const marketLifeProductName=(id:MarketLifeProduct)=>id==='adventurer_box'?'모험가 장비 상자':PRODUCT_NAMES[id];
