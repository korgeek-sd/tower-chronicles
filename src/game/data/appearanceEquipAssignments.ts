import type {Cosmetics} from '../types';
import {APPEARANCES,type AppearanceRarity} from './cosmetics';
import {appearanceLevel} from './appearanceProgress';
import {appearanceEquipEffectValue,type AppearanceEquipEffectId} from './appearanceEquipEffects';

/**
 * One equip-only effect per collectible appearance.
 * A permanent unlock does NOT grant any passive bonus when another skin is worn.
 * Server owns the authoritative assignment and equipment/loot calculations.
 */
export const APPEARANCE_EFFECT_ASSIGNMENTS:Readonly<Record<string,AppearanceEquipEffectId>>={
 mechanic:'hunting_equipment_drop',
 skeleton_knight:'defense',
 association_archivist:'hunting_exp',
 returning_knight:'shield_generation',
 novar_outskirts_guard:'defense',
 mining_crew:'hunting_silver',
 slime:'max_hp',
 faceless_one:'skill_activation',
 hexer:'dot_damage',
 ice_mage:'mp_cost_reduction',
 inquisitor:'armor_penetration',
 nameless_pilgrim:'hp_recovery',
 scout:'skill_activation',
 arcane_archer:'skill_damage',
 thief:'crit_chance',
 pickpocket:'hunting_silver',
 musketeer:'crit_damage',
 bounty_hunter:'hunting_equipment_drop',
 apprentice_mage:'max_mp',
 lumpen:'hunting_exp',
 golem:'max_hp',
 butcher:'dot_damage',
 grave_robber:'hunting_equipment_drop',
 court_jester:'crit_chance',
 crossbowman:'armor_penetration',
 lumberjack:'attack',
 corsair:'hunting_silver',
 teddy:'max_hp',
 plague_doctor:'dot_damage',
 knight:'shield_generation',
 summoner:'skill_damage',
 cultist:'mp_cost_reduction',
 celestial_archer:'crit_chance',
 assault_gunner:'crit_damage',
 alchemist:'hp_recovery',
 blacksmith:'hunting_equipment_drop',
 contract_mercenary:'attack',
 wandering_preacher:'hunting_exp',
 shepherd:'shield_generation',
 proletaria:'attack',
 valkyrie:'shield_generation',
 seraphim:'hp_recovery',
 ophanim:'skill_activation',
 advanced_mage:'max_mp',
 cain:'crit_damage',
 rat_king:'hunting_equipment_drop',
 saintess:'hp_recovery',
 archmage:'skill_damage',
 nameless_sinner:'max_hp',
 bourgeoisie:'hunting_silver',
 intellectual:'hunting_exp',
 necromancer:'dot_damage',
 noble_knight:'defense',
 antichrist:'armor_penetration',
 nidhogg:'dot_damage',
 bahamut:'max_hp',
 baal:'armor_penetration',
 puppeteer:'skill_activation',
 nameless_king:'attack',
 first_forgotten_one:'hunting_equipment_drop',
 false_savior:'hp_recovery',
};

export interface ActiveAppearanceEffect {id:AppearanceEquipEffectId;value:number}

/** Preview for any cataloged appearance (including a locked appearance). */
export function appearanceEffectFor(appearanceId:string,level:number):ActiveAppearanceEffect|null {
 const appearance=APPEARANCES.find(a=>a.id===appearanceId);
 const id=APPEARANCE_EFFECT_ASSIGNMENTS[appearanceId];
 if(!appearance?.rarity||!id||level<1)return null;
 return {id,value:appearanceEquipEffectValue(id,appearance.rarity as AppearanceRarity,level)};
}

/** Only equipped + unlocked skins have effects; save fragments never grant power. */
export function equippedAppearanceEffect(cosmetics:Cosmetics):ActiveAppearanceEffect|null {
 const id=cosmetics.selectedAppearanceId;
 if(id==='default'||!cosmetics.unlockedAppearanceIds.includes(id))return null;
 return appearanceEffectFor(id,appearanceLevel(cosmetics,id));
}
