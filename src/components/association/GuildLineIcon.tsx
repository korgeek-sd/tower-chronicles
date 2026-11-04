import type {ReactNode} from 'react';
/** Plain, in-code line icons: no artwork downloads or image assets. */
export type GuildLineIconName='crest'|'hq'|'combat'|'territory'|'assets'|'members'|'boss'|'siege'|'land'|'shop'|'vault'|'auction'|'notice'|'chat';
const drawings:Record<GuildLineIconName,ReactNode>={
 crest:<><path d="M12 2 20 5v6c0 5-3 8-8 11-5-3-8-6-8-11V5z"/><path d="M8 8l8 8m0-8-8 8"/></>,
 hq:<><path d="M3 21V8h4V5h3v3h4V5h3v3h4v13H3z"/><path d="M3 12h18M9 21v-6h6v6"/></>,
 combat:<><path d="M4 3l16 16M20 3 4 19"/><path d="M3 3l5 1-4 4M21 3l-5 1 4 4M3 21l5-2-4-4M21 21l-5-2 4-4"/></>,
 territory:<><path d="M5 22V3m0 2 14 3-14 5M3 22h18M3 19l6-3 5 3 5-4 2 2"/></>,
 assets:<><path d="M3 7l9-5 9 5M3 21h18M5 19h14M5 7h14M8 7v12m8-12v12"/><path d="M10 13h4"/></>,
 members:<><path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M5 21v-3c0-3 3-5 7-5s7 2 7 5v3M4 8a2.5 2.5 0 0 0 0 5M20 8a2.5 2.5 0 0 1 0 5M2 21v-3c0-1.5 1-2.4 3-3m17 6v-3c0-1.5-1-2.4-3-3"/></>,
 boss:<><path d="M5 9 2 5l6 2 4-3 4 3 6-2-3 4v6l-3 4H8l-3-4z"/><path d="M8 12l2 2m6-2-2 2M10 18l2-3 2 3M9 20v2m6-2v2"/></>,
 siege:<><path d="M5 22V3m7 19V5m7 17V7M5 4l5 2-5 3m7-3 5 2-5 3m7-2 4 2-4 3M3 22h18"/></>,
 land:<><path d="M6 4h14v15H6a3 3 0 0 0-3 3V7a3 3 0 0 1 3-3z"/><path d="M6 19h14v3H6a3 3 0 0 1 0-3zM10 9h6m-6 4h6"/></>,
 shop:<><path d="M4 11v10h16V11M3 6h18l-2 6c-2 2-4 2-6 0-2 2-4 2-6 0-2 2-4 2-6 0z"/><path d="M9 21v-6h6v6"/></>,
 vault:<><path d="M4 9h16v12H4z"/><path d="M8 9V6a4 4 0 0 1 8 0v3M12 13v4M4 15h16"/></>,
 auction:<><path d="M13 3l8 8-3 3-8-8zM7 9l8 8-3 3-8-8z"/><path d="M10 12l-6 6M3 22h18M5 19h14"/></>,
 notice:<><path d="M3 11v4l5 2 10-4V7L8 11H3z"/><path d="M8 17l2 5m8-12 3-3m-3 6 3 3"/></>,
 chat:<><path d="M4 4h16v13H9l-5 4V4z"/><path d="M8 10h8m-8 4h5"/></>,
};
export function GuildLineIcon({name,className}:{name:GuildLineIconName;className?:string}){
 return <svg className={className??'tc-guild-line-icon'} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[name]}</svg>;
}
