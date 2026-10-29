import React from 'react';
const cells:Record<string,number>={home:0,hunt:1,inventory:2,market:3,'gold-exchange':3,association:4,bank:5,quests:6,seal:7,cosmetics:8,craft:9,skills:10,'appearance-summon':11,occupation:12,mail:13,premium:14,world:15};
/** Decorative atlas artwork; the enclosing control supplies its accessible name. */
export function HubIcon({name}:{name:string}){
 const cell=cells[name]??0;
 return <span className="tc-hub-icon" data-hub-icon={name} aria-hidden="true" style={{backgroundPosition:`${(cell%4)*100/3}% ${Math.floor(cell/4)*100/3}%`}}/>;
}
