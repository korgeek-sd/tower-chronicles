import type {CombatActor,Weapon} from '../types';

export type BattleFxKind='DIRECT_HIT'|'HEAL'|'STATUS'|'ARMOR_BREAK';

export interface BattleFxEvent {
  id:number;
  sequence:number;
  source:CombatActor;
  target:CombatActor;
  kind:BattleFxKind;
  weaponId?:Weapon;
  skillId?:string;
  effectId?:string;
  hitIndex?:number;
  hitCount?:number;
  damage?:number;
  absorbedByShield?:number;
  healing?:number;
}

export type BattleFxEventDraft=Omit<BattleFxEvent,'id'|'sequence'>;

export interface BattleFxCollector {
  readonly events:BattleFxEvent[];
  emit(event:BattleFxEventDraft):BattleFxEvent;
}

export function createBattleFxCollector():BattleFxCollector {
  const events:BattleFxEvent[]=[];
  let sequence=0;
  return {
    events,
    emit(event){
      const value:BattleFxEvent={...event,id:sequence+1,sequence};
      sequence++;
      events.push(value);
      return value;
    }
  };
}
