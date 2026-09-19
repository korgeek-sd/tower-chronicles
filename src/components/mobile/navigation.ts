export type AppPage=
  |'home'|'towers'|'floor'|'battle'
  |'inventory'|'equipment'|'craft'|'mastery'
  |'skills'|'jobs'|'cosmetics'|'premium'
  |'market'|'association'|'settings';

export type BottomNavPage='home'|'inventory'|'market'|'association'|'craft'|'equipment';

export const BOTTOM_NAV_ITEMS=[
  {page:'home',label:'거점',asset:'./assets/ui/navigation-new/home.png'},
  {page:'inventory',label:'가방',asset:'./assets/ui/navigation-new/inventory.png'},
  {page:'market',label:'거래소',asset:'./assets/ui/navigation-new/market.png'},
  {page:'association',label:'조합',asset:'./assets/ui/navigation-new/association.png'},
  {page:'craft',label:'제작',asset:'./assets/ui/navigation-new/craft.png'},
  {page:'equipment',label:'장비',asset:'./assets/ui/navigation-new/equipment.png'},
] as const satisfies readonly {page:BottomNavPage;label:string;asset:string}[];

export function bottomNavDestination(page:AppPage):BottomNavPage|null{
  if(page==='mastery')return 'craft';
  if(page==='skills')return 'equipment';
  if(page==='towers'||page==='floor')return 'home';
  if(page==='home'||page==='inventory'||page==='market'||page==='association'||page==='craft'||page==='equipment')return page;
  return null;
}
