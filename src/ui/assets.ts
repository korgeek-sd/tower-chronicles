export type NavigationAssetKey='home'|'inventory'|'market'|'association'|'shop';

const NAVIGATION_ASSETS:Record<NavigationAssetKey,string>={
 home:'./assets/ui/navigation-relic/home.svg',
 inventory:'./assets/ui/navigation-relic/inventory.svg',
 market:'./assets/ui/navigation-relic/market.svg',
 association:'./assets/ui/navigation-relic/association.svg',
 shop:'./assets/ui/navigation-relic/shop.svg',
};

export const navigationAssetFor=(key:NavigationAssetKey)=>NAVIGATION_ASSETS[key];

export const shopGoldAssetFor=(gold:number)=>{
 const tier=gold>=24500?3:gold>=7000?2:1;
 return './assets/shop/gold/gold_stack_'+tier+'.svg';
};
