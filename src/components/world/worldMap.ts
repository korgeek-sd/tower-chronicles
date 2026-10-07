export type TownKind='herb'|'farm'|'city';
export interface WorldTown{id:string;name:string;kind:TownKind;x:number;y:number;owner:string;tax:number;}
// Preview fixtures only. Ownership and economy are not connected to gameplay saves.
export const WORLD_TOWNS:WorldTown[]=[
 {id:'herb-1',name:'달그늘',kind:'herb',x:1,y:0,owner:'붉은달',tax:3},
 {id:'farm-1',name:'황금들',kind:'farm',x:3,y:0,owner:'철의맹세',tax:5},
 {id:'farm-2',name:'보리뜰',kind:'farm',x:0,y:1,owner:'새벽별',tax:2},
 {id:'herb-2',name:'이슬숲',kind:'herb',x:2,y:1,owner:'붉은달',tax:4},
 {id:'herb-3',name:'안개골',kind:'herb',x:4,y:1,owner:'중립',tax:0},
 {id:'city',name:'노바르',kind:'city',x:2,y:2,owner:'철의맹세',tax:5},
 {id:'herb-4',name:'은잎골',kind:'herb',x:0,y:3,owner:'새벽별',tax:2},
 {id:'farm-3',name:'해오름',kind:'farm',x:2,y:3,owner:'푸른늑대',tax:3},
 {id:'farm-4',name:'풍요뜰',kind:'farm',x:4,y:3,owner:'철의맹세',tax:4},
 {id:'farm-5',name:'밀바람',kind:'farm',x:1,y:4,owner:'중립',tax:0},
 {id:'herb-5',name:'초록샘',kind:'herb',x:3,y:4,owner:'푸른늑대',tax:3},
];
export const TOWN_ROUTES=[['herb-1','farm-2'],['herb-1','herb-2'],['farm-1','herb-2'],['farm-1','herb-3'],['farm-2','herb-4'],['herb-2','city'],['herb-3','farm-4'],['city','herb-4'],['city','farm-3'],['city','farm-4'],['herb-4','farm-5'],['farm-3','farm-5'],['farm-3','herb-5'],['farm-4','herb-5']];
export function canTravel(from:string,to:string){return from!==to&&WORLD_TOWNS.some(t=>t.id===from)&&WORLD_TOWNS.some(t=>t.id===to);}
export const townKindLabel=(kind:TownKind)=>kind==='herb'?'약초 마을':kind==='farm'?'농업 마을':'중앙 도시';
