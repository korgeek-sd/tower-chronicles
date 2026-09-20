import type {GameState} from '../../game/types';
import {stats,itemSlot,masteryKeyOf} from '../../game/engine/state';
export function inventoryPageSize(height:number,width:number){const gap=6,cell=Math.max(44,(Math.max(0,width)-gap*3)/4);return Math.max(1,Math.min(5,Math.floor((height+gap)/(cell+gap))))*4;}
export function inventoryIconPath(id:string,tier?:number):string|null{
 if(['sword','bow','dagger','staff'].includes(id)&&tier!==undefined&&Number.isInteger(tier)&&tier>=1&&tier<=5)return `./assets/ui/inventory/${id}-t${tier}.png`;
 if(['healing_lesser','healing_standard','healing_greater','healing_supreme','revival'].includes(id))return `./assets/ui/inventory/${id}.png`;
 return null;
}
export function equipmentPreview(game:GameState,id:string){
 const candidate=game.items.find(i=>i.id===id);if(!candidate)return null;
 const equipped=game.expedition?.equipment??game.equipped,current=stats(game,equipped),next=stats(game,{...equipped,[itemSlot(candidate.kind)]:id});
 const reason=game.expedition?'원정 중 변경 불가':Object.values(equipped).includes(id)?'장착 중':candidate.tier>game.gearMastery[masteryKeyOf(candidate)].unlockedTier?'장비 숙련이 부족합니다.':'';
 return {attack:next.attack-current.attack,defense:next.defense-current.defense,hp:next.hp-current.hp,speed:next.speed-current.speed,reason};
}
export function descriptionPages(text:string,limit=90){const chars=Array.from(text),size=Math.max(1,Math.floor(limit));return chars.length?Array.from({length:Math.ceil(chars.length/size)},(_,i)=>chars.slice(i*size,(i+1)*size).join('')):[''];}
