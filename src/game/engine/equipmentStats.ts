import type {GameState,Item,Slot,Stats,Weapon} from '../types';
import {CONFIG,EQUIPMENT,STARTER,WEAPONS} from '../data/config';
import {
  ACCESSORY_ENHANCEMENT_VALUES,
  ACCESSORY_TRIGGER_VALUES,
  equipmentStatMultiplier,
} from '../data/enhancement';

export interface EquipmentContribution {
  hp:number;
  attack:number;
  defense:number;
  speed:number;
}

const ZERO_CONTRIBUTION:EquipmentContribution={hp:0,attack:0,defense:0,speed:0};

export function equipmentContribution(item:Item|undefined):EquipmentContribution {
  if(!item)return ZERO_CONTRIBUTION;
  const mult=equipmentStatMultiplier(item.enhancement);
  if(item.kind in WEAPONS){
    const weapon=WEAPONS[item.kind as Weapon];
    const itemScale=(item.id==='starter'?STARTER.scale:1)*item.tier*mult;
    return {hp:0,attack:weapon.attack*itemScale,defense:weapon.defense*itemScale,speed:0};
  }
  if(item.kind==='armor')return {
    hp:EQUIPMENT.armor.hp*item.tier*mult,
    attack:0,
    defense:EQUIPMENT.armor.defense*item.tier*mult,
    speed:0,
  };
  if(item.kind==='boots')return {
    hp:EQUIPMENT.boots.hp*item.tier*mult,
    attack:0,
    defense:0,
    speed:EQUIPMENT.boots.speed*item.tier*mult,
  };
  return ZERO_CONTRIBUTION;
}

const equippedItem=(s:GameState,slot:Slot,equipment:Record<Slot,string|null>)=>
  s.items.find(item=>item.id===equipment[slot]);

export function equipmentStats(s:GameState,equipment:Record<Slot,string|null>=s.equipped):Stats {
  const weaponItem=equippedItem(s,'weapon',equipment);
  const weaponKind:Weapon=weaponItem&&weaponItem.kind in WEAPONS?weaponItem.kind as Weapon:'sword';
  const identity=WEAPONS[weaponKind];
  const weapon=weaponItem?equipmentContribution(weaponItem):{hp:0,attack:identity.attack*.4,defense:identity.defense*.4,speed:0};
  const armor=equipmentContribution(equippedItem(s,'armor',equipment));
  const boots=equipmentContribution(equippedItem(s,'boots',equipment));
  return {
    hp:CONFIG.baseHp+armor.hp+boots.hp,
    attack:CONFIG.baseAttack+weapon.attack,
    defense:CONFIG.baseDefense+weapon.defense+armor.defense,
    speed:identity.speed+boots.speed,
    skillPower:identity.skillPower,
    critChance:Math.min(1,Math.max(0,identity.critChance)),
    critDamage:identity.critDamage,
    attackHits:identity.basicHitMultipliers.length,
  };
}

export type AccessoryPassive =
  | {kind:'vampire';value:number;directHpDamageOnly:true}
  | {kind:'unyielding';value:number;hpRatioAtOrBelow:number}
  | {kind:'berserker';value:number;hpRatioAtOrBelow:number};

export function accessoryPassive(item:Item|undefined):AccessoryPassive|null {
  if(!item)return null;
  if(item.kind==='vampire')return {
    kind:'vampire',
    value:ACCESSORY_ENHANCEMENT_VALUES.vampire[item.enhancement],
    directHpDamageOnly:ACCESSORY_TRIGGER_VALUES.vampire.directHpDamageOnly,
  };
  if(item.kind==='unyielding')return {
    kind:'unyielding',
    value:ACCESSORY_ENHANCEMENT_VALUES.unyielding[item.enhancement],
    hpRatioAtOrBelow:ACCESSORY_TRIGGER_VALUES.unyielding.hpRatioAtOrBelow,
  };
  if(item.kind==='berserker')return {
    kind:'berserker',
    value:ACCESSORY_ENHANCEMENT_VALUES.berserker[item.enhancement],
    hpRatioAtOrBelow:ACCESSORY_TRIGGER_VALUES.berserker.hpRatioAtOrBelow,
  };
  return null;
}
