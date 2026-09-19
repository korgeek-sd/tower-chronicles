import type {ActiveEffect,CombatEvent} from '../../game/types';

export type LogKind='player'|'monster'|'crit'|'shield'|'buff'|'heal'|'reward'|'death'|null;

/** UI-only classification. Log strings in the save are never modified. */
export function logKind(line:string):LogKind{
 if(/치명상을 입었습니다|원정 실패|회생 포션을 사용하지 않았습니다/.test(line))return 'death';
 if(/치명타/.test(line))return 'crit';
 if(/보호막/.test(line))return 'shield';
 if(/회복|재생 회복/.test(line))return 'heal';
 if(/처치!|획득|보관|입장권/.test(line))return 'reward';
 if(/^\[/.test(line)||/적용|준비|반격|돌진 준비|수호|외피|노출|파쇄/.test(line))return 'buff';
 if(/^당신의/.test(line))return 'player';
 if(/의 기본 공격|의 행동|등장/.test(line))return 'monster';
 return null;
}

export interface BattleSummary{
 hits:number;dealt:number;taken:number;
 critCount:number;maxHit:number;maxCrit:number;shieldAbsorbed:number;
 playerHits:number;monsterHits:number;
}

/** Summarizes DIRECT_DAMAGE telemetry. No save or engine state is touched. */
export function summarizeEvents(events:CombatEvent[]):BattleSummary{
 const out:BattleSummary={hits:0,dealt:0,taken:0,critCount:0,maxHit:0,maxCrit:0,shieldAbsorbed:0,playerHits:0,monsterHits:0};
 for(const e of events){
  if(e.kind!=='DIRECT_DAMAGE')continue;
  out.hits++;
  out.shieldAbsorbed+=e.absorbedByShield;
  if(e.critical)out.critCount++;
  if(e.hpDamage>out.maxHit)out.maxHit=e.hpDamage;
  if(e.critical&&e.hpDamage>out.maxCrit)out.maxCrit=e.hpDamage;
  if(e.attacker==='player'){out.dealt+=e.hpDamage;out.playerHits++;}
  else{out.taken+=e.hpDamage;out.monsterHits++;}
 }
 return out;
}

export interface DeathSnapshot{
 monsterName:string;maxHp:number;defense:number;
 effects:ActiveEffect[];potionsLeft:number;loadoutRevival:number;
}

export interface DeathHint{id:string;text:string}

/**
 * Heuristic only, not a balance verdict. Rules are intentionally simple:
 * big hit / damage-over-time left on / defense-down left / no potions left.
 */
export function analyzeDeath(args:{lastEvent?:CombatEvent;snap:DeathSnapshot}):DeathHint[]{
 const hints:DeathHint[]=[];
 const last=args.lastEvent,snap=args.snap;
 if(last&&last.target==='player'){
  if(last.critical||last.hpDamage>=Math.max(1,Math.round(snap.maxHp*.3)))
   hints.push({id:'burst',text:'큰 한 방에 무너졌습니다. 보호막·방어 태세로 한 방을 받는 쪽을 먼저 줄여보세요.'});
  if(last.absorbedByShield>0&&last.hpDamage>0)
   hints.push({id:'shield-break',text:'보호막이 있었지만 뚫렸습니다. 보호막 양보다 들어오는 피해가 큽니다.'});
 }
 const ids=new Set(snap.effects.map(e=>e.effectId));
 if(ids.has('fang_wound')||ids.has('poison')||ids.has('bleed'))
  hints.push({id:'dot',text:'출혈·중독이 걸린 채로 맞았습니다. 상태이상이 남았다면 다음엔 정비를 먼저 보세요.'});
 if(ids.has('crushing_pressure')||ids.has('weaken'))
  hints.push({id:'defense-down',text:'방어 약화 상태였습니다. 약화가 쌓이기 전에 전투를 끝내거나 포션 타이밍을 당겨보세요.'});
 if(last&&last.incomingDamage>=Math.max(1,Math.round(snap.defense*4+snap.maxHp*.15)))
  hints.push({id:'defense',text:'방어력 부족 신호입니다. 들어오는 피해가 최대 HP의 15%+방어 보정을 크게 넘었습니다.'});
 if(snap.potionsLeft<=0)
  hints.push({id:'potion',text:'회복 포션 부족입니다. 원정 가방의 회복 포션을 더 챙기거나 일찍 귀환하세요.'});
 if(!hints.length)
  hints.push({id:'general',text:'치명적인 흐름이 한 번에 왔습니다. 다음엔 HP 50% 아래에서 미리 회복·귀환을 보세요.'});
 return hints.slice(0,4);
}
