import type {HuntMapId} from './model';
export interface HuntMonster {id:string;name:string;image:string}
export interface HuntMonsterSnapshot extends HuntMonster {hp:number;attack:number;defense:number}
const red=(id:string,name:string):HuntMonster=>({id,name,image:`assets/monsters/redfang/${id}.png`});
const ore=(id:string,name:string):HuntMonster=>({id,name,image:`assets/monsters/iron-t1/${id}.png`});
export const HUNT_MONSTERS:Record<HuntMapId,readonly HuntMonster[]>={
 plains:[red('hide_gnawer','가죽 갉는 하이에나'),red('wasteland_boar','황야 멧돼지'),red('carrion_vulture','썩은날 독수리')],
 forest:[red('thorn_jackal','가시 자칼'),red('hide_gnawer','가죽 갉는 하이에나'),red('carrion_vulture','썩은날 독수리')],
 mine:[ore('goblin_miner','고블린 광부'),ore('cave_rat','동굴 쥐'),ore('mine_bat','광산 박쥐'),ore('goblin_carrier','고블린 운반꾼'),ore('goblin_overseer','고블린 감독관')],
 fortress:[red('pack_vanguard','무리 선봉'),red('thorn_jackal','가시 자칼'),red('wasteland_boar','황야 멧돼지')],
 ruins:[red('fang_nest','송곳니 둥지'),red('pack_vanguard','무리 선봉'),red('carrion_vulture','썩은날 독수리')],
};
export function chooseHuntMonster(map:HuntMapId,previousId?:string,draw= Math.random()):HuntMonster {
 const pool=HUNT_MONSTERS[map];
 if(!previousId)return pool[0];
 const candidates=pool.filter(m=>m.id!==previousId);
 return candidates[Math.floor(Math.max(0,Math.min(1-Number.EPSILON,draw))*candidates.length)];
}
