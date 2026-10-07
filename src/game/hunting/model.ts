import type {Stats,Tower} from '../types';
export type HuntMapId='plains'|'forest'|'mine';
export const VITALITY_CAP=100,VITALITY_INTERVAL=300000;
export const HUNT_MAPS=[
 {id:'plains' as const,name:'평야',tower:'leather' as Tower,monsterId:'hide_gnawer',monsterName:'가죽 갉는 하이에나',hp:90,attack:12,defense:5,speed:8,silver:35,exp:20,materialName:'1T 가죽'},
 {id:'forest' as const,name:'숲',tower:'leather' as Tower,monsterId:'thorn_jackal',monsterName:'가시 자칼',hp:130,attack:18,defense:8,speed:12,silver:55,exp:30,materialName:'1T 가죽'},
 {id:'mine' as const,name:'광산',tower:'ore' as Tower,monsterId:'goblin_miner',monsterName:'고블린 광부',hp:180,attack:24,defense:14,speed:6,silver:80,exp:45,materialName:'1T 철광석'},
];
export interface HuntTurn {turn:number;lines:string[];playerHp:number;monsterHp:number}
export interface HuntResult {startHp?:number;recoveredHp?:number;potionsUsed?:number;requestId?:string;mapId:HuntMapId;outcome:'victory'|'defeat';player:Stats;playerHp:number;monsterHp:number;turns:HuntTurn[];silver:number;exp:number;mastery:number;materialCount:number;createdAt:number}
export const HUNT_SKILLS=[{id:'heavy',name:'강타',description:'공격력 180% 피해 · 3턴마다 사용'},{id:'guard',name:'방어',description:'HP 50% 이하 · 이번 턴 받는 피해 50% 감소 · 4턴마다 사용'},{id:'quick',name:'속공',description:'공격력 120% 피해 · 2턴마다 사용'}];
export interface HuntingState {currentHp?:number|null;maxHp?:number|null;potions?:number;foodTurns?:Partial<Record<'attack_food'|'defense_food'|'experience_food',number>>;skills:string[];vitality:number;recoveredAt:number;experience:number;mastery:number;lastResult:HuntResult|null}
export const initialHuntingState=(now=Date.now()):HuntingState=>({skills:['heavy','guard','quick'],vitality:100,recoveredAt:now,experience:0,mastery:0,lastResult:null});
export function recoverVitality(state:HuntingState,now:number):HuntingState {
 const elapsed=Math.max(0,now-state.recoveredAt),ticks=Math.floor(elapsed/VITALITY_INTERVAL);
 const vitality=Math.min(VITALITY_CAP,state.vitality+ticks);
 return {...state,vitality,recoveredAt:vitality===VITALITY_CAP?Math.max(now,state.recoveredAt):state.recoveredAt+ticks*VITALITY_INTERVAL};
}
export const huntingLevel=(exp:number)=>1+Math.floor(Math.sqrt(Math.max(0,exp)/100));
export const damage=(attack:number,defense:number,multiplier=1)=>Math.max(1,Math.floor(attack*multiplier*100/(100+Math.max(0,defense))));
/** Guest-only resolver. Online results always originate in hunt_once. */
export function resolveHunt(before:HuntingState,mapId:HuntMapId,player:Stats,skills:readonly (string|null)[],now=Date.now(),rng:()=>number=Math.random){
 const map=HUNT_MAPS.find(m=>m.id===mapId);if(!map)throw Error('알 수 없는 지역입니다.');
 const state=recoverVitality(before,now);if(state.vitality<1)throw Error('활력이 부족합니다.');
 let hp=player.hp,mhp=map.hp;const turns:HuntTurn[]=[],cooldowns:Record<string,number>={};
 for(let turn=1;turn<=100&&hp>0&&mhp>0;turn++){
  const lines:string[]=[];let guard=false;
  const skill=skills.find(id=>id&&['heavy','guard','quick'].includes(id)&&!(cooldowns[id]>turn)&&(id!=='guard'||hp/player.hp<=.5));
  if(skill==='guard'){guard=true;cooldowns.guard=turn+4;lines.push('탐사자의 방어! 이번 턴 피해 50% 감소');}
  else {const mult=skill==='heavy'?1.8:skill==='quick'?1.2:1,critical=rng()<(player.critChance??.05),hit=damage(player.attack,map.defense,mult*(critical?1.5:1));mhp=Math.max(0,mhp-hit);if(skill)cooldowns[skill]=turn+(skill==='heavy'?3:2);lines.push(`탐사자의 ${skill==='heavy'?'강타':skill==='quick'?'속공':'공격'}! ${hit} 피해${critical?' · 치명타':''}`);}
  if(mhp>0){const hit=damage(map.attack,player.defense,guard?.5:1);hp=Math.max(0,hp-hit);lines.push(`${map.monsterName}의 공격! ${hit} 피해`);}
  turns.push({turn,lines,playerHp:hp,monsterHp:mhp});
 }
 const win=mhp===0&&hp>0;
 const result:HuntResult={mapId,outcome:win?'victory':'defeat',player:{...player},playerHp:hp,monsterHp:mhp,turns,silver:win?map.silver:0,exp:win?map.exp:0,mastery:win?1:0,materialCount:win?1:0,createdAt:now};
 return {state:{...state,vitality:state.vitality-1,experience:state.experience+result.exp,mastery:state.mastery+result.mastery,lastResult:result},result};
}
