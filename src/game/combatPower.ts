/** Combat Power v1: permanent combat stats + equipped learned skill coefficient.
 * Server mirror: private.combat_power_from_stats / private.member_skill_bonus.
 * Temporary food, consumables, world/guild buffs and unspent gear aren't included.
 */
export interface PowerStats{
 hp:number;attack:number;defense:number;
 critChance:number;critDamage:number;armorPenetration:number;
}
const finite=(value:number)=>Number.isFinite(value)?value:0;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,finite(v)));
export function calculateCombatPower(stats:PowerStats,skillBonus=0){
 const attack=clamp(stats.attack,0,1e9);
 const hp=clamp(stats.hp,0,1e9);
 const defense=clamp(stats.defense,0,1e9);
 const crit=clamp(stats.critChance,0,.6);
 const critDamage=Math.max(1,finite(stats.critDamage));
 const penetration=clamp(stats.armorPenetration,0,1);
 const bonus=clamp(skillBonus,0,.2);
 const offense=attack*10*(1+crit*(critDamage-1))*(1+penetration*.5);
 const survival=hp*.5*(1+defense/100);
 const power=Math.floor(Math.min(1e9,(offense+survival)*(1+bonus)));
 return {power,offense,survival,skillBonus:bonus};
}
