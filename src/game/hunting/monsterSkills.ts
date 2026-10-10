import {damage} from './model';
export interface MonsterSkill {name:string;interval:number;multiplier:number;penetration:number;hits:number;leech:number;description:string}
export const HUNT_MONSTER_SKILLS:Record<string,MonsterSkill> = {
  "hide_gnawer": {
    "name": "찢어 물기",
    "interval": 3,
    "multiplier": 1.3,
    "penetration": 0,
    "hits": 1,
    "leech": 0,
    "description": "3턴마다 공격력 130% 피해"
  },
  "wasteland_boar": {
    "name": "들이받기",
    "interval": 4,
    "multiplier": 1.6,
    "penetration": 0,
    "hits": 1,
    "leech": 0,
    "description": "4턴마다 공격력 160% 피해"
  },
  "carrion_vulture": {
    "name": "살점 꿰뚫기",
    "interval": 3,
    "multiplier": 1.15,
    "penetration": 0.3,
    "hits": 1,
    "leech": 0,
    "description": "3턴마다 공격력 115% 피해 · 방어 관통 30%"
  },
  "thorn_jackal": {
    "name": "가시 난타",
    "interval": 3,
    "multiplier": 1.3,
    "penetration": 0.1,
    "hits": 1,
    "leech": 0,
    "description": "3턴마다 공격력 130% 피해 · 방어 관통 10%"
  },
  "goblin_miner": {
    "name": "곡괭이 강타",
    "interval": 3,
    "multiplier": 1.4,
    "penetration": 0.2,
    "hits": 1,
    "leech": 0,
    "description": "3턴마다 공격력 140% 피해 · 방어 관통 20%"
  },
  "cave_rat": {
    "name": "재빠른 급습",
    "interval": 2,
    "multiplier": 1.15,
    "penetration": 0,
    "hits": 1,
    "leech": 0,
    "description": "2턴마다 공격력 115% 피해"
  },
  "mine_bat": {
    "name": "흡혈 송곳니",
    "interval": 4,
    "multiplier": 1.15,
    "penetration": 0,
    "hits": 1,
    "leech": 0.5,
    "description": "4턴마다 공격력 115% 피해 · 입힌 피해의 50% 회복"
  },
  "goblin_carrier": {
    "name": "광석 투척",
    "interval": 4,
    "multiplier": 1.5,
    "penetration": 0,
    "hits": 1,
    "leech": 0,
    "description": "4턴마다 공격력 150% 피해"
  },
  "goblin_overseer": {
    "name": "채찍 명령",
    "interval": 3,
    "multiplier": 1.35,
    "penetration": 0.15,
    "hits": 1,
    "leech": 0,
    "description": "3턴마다 공격력 135% 피해 · 방어 관통 15%"
  },
  "pack_vanguard": {
    "name": "무리 난격",
    "interval": 4,
    "multiplier": 0.85,
    "penetration": 0,
    "hits": 2,
    "leech": 0,
    "description": "4턴마다 공격력 85% 피해 2회"
  },
  "fang_nest": {
    "name": "송곳니 분출",
    "interval": 4,
    "multiplier": 1.5,
    "penetration": 0.2,
    "hits": 1,
    "leech": 0,
    "description": "4턴마다 공격력 150% 피해 · 방어 관통 20%"
  }
} as const;
export interface MonsterAction { damage:number;heal:number;skillName:string|null;hits:number;line:string; }
export function resolveMonsterAction(monsterId:string,monsterName:string,turn:number,attack:number,defense:number,guard:boolean,monsterHp:number,monsterMaxHp:number):MonsterAction {
 const skill=HUNT_MONSTER_SKILLS[monsterId];
 const active=!!skill&&turn>0&&turn%skill.interval===0;
 const numberOfHits=active?skill.hits:1;
 const multiplier=(active?skill.multiplier:1)*(guard?.5:1);
 const penetration=active?skill.penetration:0;
 let total=0;
 for(let i=0;i<numberOfHits;i++)total+=damage(attack,defense,multiplier,penetration);
 const heal=active&&skill.leech>0?Math.min(Math.max(0,monsterMaxHp-monsterHp),Math.floor(total*skill.leech)):0;
 const skillName=active?skill.name:null;
 return {damage:total,heal,skillName,hits:numberOfHits,line:monsterName+'의 '+(skillName??'공격')+'! '+total+' 피해'+(active&&numberOfHits>1?' · '+numberOfHits+'연타':'')+(heal>0?' · HP +'+heal:'')};
}
