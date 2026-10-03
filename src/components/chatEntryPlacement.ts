export type ChatEntryMode='normal'|'immersive';
export type ChatEntrySide='left'|'right';
export type ChatEntryPlacement={side:ChatEntrySide;y:number};
export type ChatEntryStorage={getItem(key:string):string|null;setItem(key:string,value:string):void};
const MIN_Y=.06,MAX_Y=.94;
export const chatEntryStorageKey=(mode:ChatEntryMode)=>`tower-chat-entry:${mode}:v1`;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export function resolveChatEntryPlacement(clientX:number,clientY:number,viewportWidth:number,viewportHeight:number):ChatEntryPlacement{
 const width=Math.max(1,viewportWidth),height=Math.max(1,viewportHeight);
 return {side:clientX<width/2?'left':'right',y:clamp(clientY/height,MIN_Y,MAX_Y)};
}
export function readChatEntryPlacement(mode:ChatEntryMode,storage?:ChatEntryStorage):ChatEntryPlacement|null{
 const target=storage??(typeof window!=='undefined'?window.localStorage:undefined);if(!target)return null;
 try{const raw=target.getItem(chatEntryStorageKey(mode));if(!raw)return null;const value=JSON.parse(raw) as Partial<ChatEntryPlacement>;if((value.side!=='left'&&value.side!=='right')||typeof value.y!=='number'||!Number.isFinite(value.y))return null;return {side:value.side,y:clamp(value.y,MIN_Y,MAX_Y)};}catch{return null;}
}
export function saveChatEntryPlacement(mode:ChatEntryMode,placement:ChatEntryPlacement,storage?:ChatEntryStorage){
 const target=storage??(typeof window!=='undefined'?window.localStorage:undefined);if(!target)return;
 try{target.setItem(chatEntryStorageKey(mode),JSON.stringify({side:placement.side,y:clamp(placement.y,MIN_Y,MAX_Y)}));}catch{}
}
