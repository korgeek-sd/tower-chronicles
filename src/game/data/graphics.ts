import type {Tower,Monster} from '../types';
import {TOWERS,towerIds} from './config';
import {APPEARANCES,appearanceById,DEFAULT_APPEARANCE_ID} from './cosmetics';
import {IRON_T1_MONSTERS,IRON_BOSS_SLOTS} from './ironSpire';
import {RED_T1_MONSTERS,RED_BOSS_SLOTS} from './redFang';
import {CRYSTAL_T1_MONSTERS,CRYSTAL_BOSS_SLOTS} from './crystalTower';
import {KALEON_T1_MONSTERS,KALEON_BOSS_SLOTS} from './kaleon';
export interface MonsterGraphic {
  id:string; tower:Tower; name:string;
  image:{idle?:string;hit?:string;[state:string]:string|undefined};
  display:{scale:number;offsetX:number;offsetY:number};
}
export interface PlayerGraphic {id:string;image:{idle?:string};display:{scale:number;offsetX:number;offsetY:number}}
export const SCENE_CONFIG={hitDurationMs:200,damageDurationMs:650,maxDamageLabels:5};
export const PLAYER_GRAPHIC:PlayerGraphic={id:DEFAULT_APPEARANCE_ID,image:{idle:APPEARANCES[0].imagePath},display:{scale:1.25,offsetX:-1,offsetY:0}};
export const playerGraphicFor=(appearanceId:string):PlayerGraphic=>{const appearance=appearanceById(appearanceId)??APPEARANCES[0];return {...PLAYER_GRAPHIC,id:appearance.id,image:{idle:appearance.imagePath}};};
const ids:Record<Tower,string>={ore:'goblin_miner',leather:'wild_boar',gem:'crystal_guardian',kaleon:'moss_spirit'};
export const MONSTER_GRAPHICS:MonsterGraphic[]=[];
MONSTER_GRAPHICS.push(...IRON_T1_MONSTERS.map(m=>({id:m.graphicId,tower:'ore' as const,name:m.displayName,image:{idle:`assets/monsters/iron-t1/${m.id}.png`},display:{scale:m.boss?1.18:1,offsetX:0,offsetY:m.id==='mine_bat'?0:18}})));
const ironBossArt:Record<string,string>={iron_maw_burrower:'iron_maw_burrower',black_vein_armor_breaker:'black_vein_armor_breaker',echo_devourer:'echo_devourer',deep_hoist_overseer:'deep_hoist_overseer',iron_core_pulsator:'iron_core_pulsator'};
MONSTER_GRAPHICS.push(...Object.values(IRON_BOSS_SLOTS).map(slot=>({id:slot.bossId,tower:'ore' as const,name:slot.name,image:{idle:`assets/monsters/iron-bosses/${ironBossArt[slot.bossId]}.png`},display:{scale:1.28,offsetX:0,offsetY:10}})));
MONSTER_GRAPHICS.push(...RED_T1_MONSTERS.map(m=>({id:m.graphicId,tower:'leather' as const,name:m.displayName,image:{idle:`assets/monsters/redfang/${m.id}.png`},display:{scale:1,offsetX:0,offsetY:m.id==='carrion_vulture'?0:18}})));
// Crystal Tower uses the existing crystal guardian art as a temporary placeholder until dedicated sprites land.
MONSTER_GRAPHICS.push(...CRYSTAL_T1_MONSTERS.map(m=>({id:m.graphicId,tower:'gem' as const,name:m.displayName,image:{idle:'assets/monsters/gem/crystal_guardian_idle.png',hit:'assets/monsters/gem/crystal_guardian_hit.png'},display:{scale:1,offsetX:0,offsetY:18}})));
MONSTER_GRAPHICS.push(...Object.values(CRYSTAL_BOSS_SLOTS).map(slot=>({id:slot.bossId,tower:'gem' as const,name:slot.name,image:{idle:'assets/monsters/gem/crystal_guardian_idle.png',hit:'assets/monsters/gem/crystal_guardian_hit.png'},display:{scale:1.28,offsetX:0,offsetY:10}})));
// Kaleon uses the existing moss-spirit art as a placeholder until dedicated sprites land.
MONSTER_GRAPHICS.push(...KALEON_T1_MONSTERS.map(m=>({id:m.graphicId,tower:'kaleon' as const,name:m.displayName,image:{idle:'assets/monsters/kaleon/moss_spirit_idle.png',hit:'assets/monsters/kaleon/moss_spirit_hit.png'},display:{scale:1,offsetX:0,offsetY:18}})));
MONSTER_GRAPHICS.push(...Object.values(KALEON_BOSS_SLOTS).map(slot=>({id:slot.bossId,tower:'kaleon' as const,name:slot.name,image:{idle:'assets/monsters/kaleon/moss_spirit_idle.png',hit:'assets/monsters/kaleon/moss_spirit_hit.png'},display:{scale:1.28,offsetX:0,offsetY:10}})));
const redBossArt:Record<string,string>={bloodmane_tracker:'bloodmane_tracker',redjaw_hide_eater:'redjaw_hide_eater',fang_pack_matriarch:'fang_pack_matriarch',sanctuary_talon_bishop:'sanctuary_talon_bishop',lord_of_red_fang:'lord_of_red_fang'};
MONSTER_GRAPHICS.push(...Object.values(RED_BOSS_SLOTS).map(slot=>({id:slot.bossId,tower:'leather' as const,name:slot.name,image:{idle:`assets/monsters/red-bosses/${redBossArt[slot.bossId]}.png`},display:{scale:1.28,offsetX:0,offsetY:10}})));
export const TOWER_BACKGROUNDS=Object.fromEntries(towerIds.map(t=>[t,
  Object.fromEntries([1,2,3,4,5].map(tier=>[tier,`assets/backgrounds/${t}/t${tier}.png`]))
])) as Record<Tower,Record<number,string>>;
TOWER_BACKGROUNDS.ore[1]='assets/backgrounds/ore/t1.png';
export const BOSS_FLOORS=[6,7,8,9,10] as const;
export const isBossFloor=(floor:number)=>BOSS_FLOORS.some(n=>n===floor);
export const graphicFor=(tower:Tower,monster:Pick<Monster,'name'>)=>MONSTER_GRAPHICS.find(g=>g.tower===tower&&g.name===monster.name);
export const backgroundFor=(tower:Tower,_floor:number)=>TOWER_BACKGROUNDS[tower][1];
// Relative URLs work in Vite subdirectories and alongside the offline HTML.
export const assetUrl=(path:string)=>'./'+path.replace(/^\/+/, '');


