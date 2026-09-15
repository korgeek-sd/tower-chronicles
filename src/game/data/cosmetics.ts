export interface AppearanceData {id:string;name:string;imagePath:string;description:string;sourceLabel:string;tradeable:boolean;hideNameWhenLocked?:boolean}
export interface TitleData {id:string;name:string;description:string;sourceLabel:string}
export interface CosmeticsCatalog {appearances:AppearanceData[];titles:TitleData[]}
export const DEFAULT_APPEARANCE_ID='default';
export const APPEARANCES:AppearanceData[]=[{id:DEFAULT_APPEARANCE_ID,name:'기본 모험가',imagePath:'assets/player/default.png',description:'탑을 오르기 시작한 모험가의 기본 전신 외형',sourceLabel:'기본 지급',tradeable:false}];
export const TITLES:TitleData[]=[];
export const COSMETICS_CATALOG:CosmeticsCatalog={appearances:APPEARANCES,titles:TITLES};
export const appearanceById=(id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG)=>catalog.appearances.find(x=>x.id===id);
export const titleById=(id:string,catalog:CosmeticsCatalog=COSMETICS_CATALOG)=>catalog.titles.find(x=>x.id===id);

