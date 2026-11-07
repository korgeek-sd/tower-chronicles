export type TownKind='herb'|'farm'|'city';
export interface WorldTown{id:string;name:string;kind:TownKind;x:number;y:number;owner:string;tax:number;}
// Preview fixtures only. Ownership and economy are not connected to gameplay saves.
export const ACTIVE_TOWN_IDS=['herb-1','farm-1','city','herb-2','farm-2'] as const;
export const ACTIVE_TOWN_ID_SET:ReadonlySet<string>=new Set(ACTIVE_TOWN_IDS);
export const isActiveTownId=(id:unknown):id is typeof ACTIVE_TOWN_IDS[number]=>typeof id==='string'&&ACTIVE_TOWN_ID_SET.has(id);
export const WORLD_TOWNS:WorldTown[]=[
 {id:'herb-1',name:'달그늘',kind:'herb',x:1,y:0,owner:'붉은달',tax:3},
 {id:'farm-1',name:'황금들',kind:'farm',x:3,y:0,owner:'철의맹세',tax:5},
 {id:'farm-2',name:'보리뜰',kind:'farm',x:0,y:1,owner:'새벽별',tax:2},
 {id:'herb-2',name:'이슬숲',kind:'herb',x:2,y:1,owner:'붉은달',tax:4},
 {id:'city',name:'노바르',kind:'city',x:2,y:2,owner:'철의맹세',tax:5},
];
export const TOWN_ROUTES=[['herb-1','farm-1'],['herb-1','city'],['farm-1','city'],['city','herb-2'],['city','farm-2'],['herb-2','farm-2']];
export function canTravel(from:string,to:string){return from!==to&&WORLD_TOWNS.some(t=>t.id===from)&&WORLD_TOWNS.some(t=>t.id===to);}
export const townKindLabel=(kind:TownKind)=>kind==='herb'?'약초 마을':kind==='farm'?'농업 마을':'중앙 도시';
