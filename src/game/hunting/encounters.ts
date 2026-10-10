import catalog from './monsterCatalog.json' with {type:'json'};
import type {HuntMapId} from './model';
import type {MonsterUnit} from './monsterSkills';
export type HuntMonster=MonsterUnit;
export type HuntMonsterSnapshot=MonsterUnit;
export const HUNT_MONSTERS:Record<HuntMapId,readonly HuntMonster[]> = catalog as Record<HuntMapId,readonly HuntMonster[]>;
export function chooseHuntMonster(map:HuntMapId,previousId?:string,draw=Math.random()):HuntMonster {
 const pool=HUNT_MONSTERS[map];
 const options=pool.filter(monster=>monster.id!==previousId);
 return options[Math.floor(Math.max(0,Math.min(1-Number.EPSILON,draw))*options.length)];
}
