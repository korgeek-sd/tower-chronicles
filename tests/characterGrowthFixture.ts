import type {CharacterGrowthSnapshot} from '../src/online/characterGrowth';
import {huntingExperienceForLevel} from '../src/game/hunting/model';
export function characterGrowthFixture():CharacterGrowthSnapshot{return {
 experience:huntingExperienceForLevel(42)+90024,allocation:{hp:2,attack:4,defense:3,crit:2,mp:1},
 baseStats:{hp:180,attack:8,defense:3,critChance:.05,critDamage:1.5,armorPenetration:0},
 stats:{hp:208,attack:43.20414,defense:9.1581885,critChance:.09,critDamage:1.5,armorPenetration:0,appearanceEffect:{id:'attack',value:2}},maxMp:110,
 currentJobId:null,selectedAppearanceId:'default',
 equipment:[{slot:'weapon',item:{id:'test-weapon',kind:'association_supply_iron_sword',grade:'rare',enhancement:0},stats:{attack:30}}],
 seals:{association:{level:12,bonus:{hpPercent:1.7,attackPercent:.85,defensePercent:.85}},guardian:{level:7,bonus:{hpPercent:.45,attackPercent:0,defensePercent:.9}}},
 collection:{applied:false,registeredSetIds:[],unlockedAppearanceIds:[]},foodTurns:{attack_food:3},
};}
