import type {CombatEvent} from '../game/types';
import type {GameFeelIntensity} from './types';

export type CombatFeelEmission=
 |{event:'combat.basic-hit'}
 |{event:'combat.critical-hit'}
 |{event:'combat.guard'}
 |{event:'combat.player-damaged';payload:{intensity:GameFeelIntensity}};

export function combatFeelForEvent(event:CombatEvent,playerMaxHp:number):CombatFeelEmission[]{
 if(event.attacker==='player'&&event.target==='monster'){
  return [{event:event.critical?'combat.critical-hit':'combat.basic-hit'}];
 }
 if(event.target!=='player')return [];
 const output:CombatFeelEmission[]=[];
 if(event.absorbedByShield>0)output.push({event:'combat.guard'});
 if(event.hpDamage>0){
  const ratio=event.hpDamage/Math.max(1,playerMaxHp);
  output.push({event:'combat.player-damaged',payload:{intensity:ratio>=.25?'strong':'normal'}});
 }
 return output;
}
