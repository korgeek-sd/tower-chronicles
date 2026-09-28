import type {EquipmentItem,GameState,Item,Slot,Stats,Weapon} from '../types';
import {CONFIG,EQUIPMENT,STARTER,WEAPONS} from '../data/config';
import {
  ACCESSORY_ENHANCEMENT_VALUES,
  ACCESSORY_TRIGGER_VALUES,
  equipmentStatMultiplier,
} from '../data/enhancement';
import {EQUIPMENT_DEFINITIONS,EQUIPMENT_SLOTS,equipmentItemStats} from '../data/equipment';

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

const legacyEquippedItem=(s:GameState,slot:Slot,equipment:Record<Slot,string|null>)=>
  s.items.find(item=>item.id===equipment[slot]);

const modernEquippedItem=(s:GameState,slot:Slot,equipment:Record<Slot,string|null>):EquipmentItem|undefined=>{
  const id=equipment[slot];
  return (s.equipmentItems??[]).find(item=>item.id===id);
};

const modernContribution=(item:EquipmentItem|undefined):EquipmentContribution=>{
  if(!item)return ZERO_CONTRIBUTION;
  const value=equipmentItemStats(item);
  return {hp:value.hp??0,attack:value.attack??0,defense:value.defense??0,speed:0};
};

export function equipmentStats(s:GameState,equipment:Record<Slot,string|null>=s.equipped):Stats {
  const modernWeapon=modernEquippedItem(s,'weapon',equipment);
  const legacyWeapon=legacyEquippedItem(s,'weapon',equipment);
  const modernDefinition=modernWeapon?EQUIPMENT_DEFINITIONS[modernWeapon.kind]:null;
  const weaponKind:Weapon=modernDefinition&&'weaponFamily' in modernDefinition?modernDefinition.weaponFamily:(
    legacyWeapon&&legacyWeapon.kind in WEAPONS?legacyWeapon.kind as Weapon:'sword'
  );
  const identity=WEAPONS[weaponKind];
  const weapon=modernWeapon
    ?modernContribution(modernWeapon)
    :legacyWeapon
      ?equipmentContribution(legacyWeapon)
      :{hp:0,attack:identity.attack*.4,defense:identity.defense*.4,speed:0};

  let hp=CONFIG.baseHp+weapon.hp;
  let attack=CONFIG.baseAttack+weapon.attack;
  let defense=CONFIG.baseDefense+weapon.defense;
  let speed=identity.speed;
  let nonWeaponCrit=0;

  for(const slot of EQUIPMENT_SLOTS){
    if(slot==='weapon')continue;
    const modern=modernEquippedItem(s,slot,equipment);
    if(modern){
      const contribution=modernContribution(modern),itemStats=equipmentItemStats(modern);
      hp+=contribution.hp;attack+=contribution.attack;defense+=contribution.defense;
      nonWeaponCrit+=itemStats.critChance??0;
      continue;
    }
    const legacy=legacyEquippedItem(s,slot,equipment);
    if(!legacy)continue;
    const contribution=equipmentContribution(legacy);
    hp+=contribution.hp;attack+=contribution.attack;defense+=contribution.defense;speed+=contribution.speed;
  }

  const modernWeaponStats=modernWeapon?equipmentItemStats(modernWeapon):null;
  const weaponCrit=modernWeaponStats?.critChance??identity.critChance;
  return {
    hp,
    attack,
    defense,
    speed,
    skillPower:identity.skillPower,
    critChance:Math.min(1,Math.max(0,weaponCrit+nonWeaponCrit)),
    critDamage:identity.critDamage,
    attackHits:identity.basicHitMultipliers.length,
  };
}

export type AccessoryPassive =
  | {kind:'vampire';value:number;directHpDamageOnly:true}
  | {kind:'unyielding';value:number;hpRatioAtOrBelow:number}
  | {kind:'berserker';value:number;hpRatioAtOrBelow:number};

export function accessoryPassiveDescription(item:Item|undefined):string|null {
  const passive=accessoryPassive(item);
  if(!passive)return null;
  if(passive.kind==='vampire')return `가한 직접 피해의 ${Math.round(passive.value*100)}% 회복`;
  if(passive.kind==='unyielding')return `HP ${Math.round(passive.hpRatioAtOrBelow*100)}% 이하에서 받는 피해 ${Math.round(passive.value*100)}% 감소`;
  return `HP ${Math.round(passive.hpRatioAtOrBelow*100)}% 이하에서 공격력 ${Math.round(passive.value*100)}% 증가`;
}

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
