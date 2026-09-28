import type {
  EquipmentGrade,
  EquipmentKind,
  EquipmentLoadout,
  EquipmentItem,
  EquipmentEnhancementLevel,
  Slot,
} from '../types';

export const EQUIPMENT_GRADES=[
  'common',
  'uncommon',
  'rare',
  'heroic',
  'legendary',
] as const satisfies readonly EquipmentGrade[];

export const EQUIPMENT_GRADE_MULTIPLIERS={
  common:1,
  uncommon:1.12,
  rare:1.26,
  heroic:1.42,
  legendary:1.60,
} as const satisfies Record<EquipmentGrade,number>;

export const EQUIPMENT_GRADE_NAMES:Record<EquipmentGrade,string>={
  common:'일반',
  uncommon:'고급',
  rare:'희귀',
  heroic:'영웅',
  legendary:'전설',
};

export const EQUIPMENT_ENHANCEMENT_MULTIPLIERS={
  0:1,
  1:1.04,
  2:1.08,
  3:1.13,
  4:1.18,
  5:1.24,
  6:1.31,
  7:1.38,
  8:1.45,
  9:1.52,
  10:1.60,
} as const satisfies Record<EquipmentEnhancementLevel,number>;

export const EQUIPMENT_SLOTS=[
  'weapon',
  'helmet',
  'armor',
  'gloves',
  'boots',
  'necklace',
  'ring',
] as const satisfies readonly Slot[];

export type EquipmentWeaponFamily='sword'|'bow'|'staff';

export interface EquipmentBaseStats {
  hp?:number;
  attack?:number;
  defense?:number;
  critChance?:number;
}

export interface EquipmentDefinition {
  kind:EquipmentKind;
  name:string;
  slot:Slot;
  weaponFamily?:EquipmentWeaponFamily;
  baseStats:Readonly<EquipmentBaseStats>;
  description:string;
}

export const EQUIPMENT_DEFINITIONS={
  association_supply_iron_sword:{
    kind:'association_supply_iron_sword',
    name:'협회 보급 철검',
    slot:'weapon',
    weaponFamily:'sword',
    baseStats:{attack:10,defense:4},
    description:'협회가 신입 탐사자에게 지급하는 표준 철검.',
  },
  outer_guard_longbow:{
    kind:'outer_guard_longbow',
    name:'외곽 경비대 장궁',
    slot:'weapon',
    weaponFamily:'bow',
    baseStats:{attack:12,defense:1,critChance:.05},
    description:'탑 외곽 경계 임무에 쓰이는 장거리 제식 무기.',
  },
  archive_standard_arcane_staff:{
    kind:'archive_standard_arcane_staff',
    name:'기록원 제식 마도봉',
    slot:'weapon',
    weaponFamily:'staff',
    baseStats:{attack:6},
    description:'기록원 술식 담당자가 사용하는 표준 마도구.',
  },
  expedition_iron_helmet:{
    kind:'expedition_iron_helmet',
    name:'원정대 철제 투구',
    slot:'helmet',
    baseStats:{hp:20,defense:5},
    description:'일반 원정대에서 널리 쓰이는 실전형 철제 투구.',
  },
  return_corps_plate_armor:{
    kind:'return_corps_plate_armor',
    name:'귀환대 판금갑',
    slot:'armor',
    baseStats:{hp:55,defense:7},
    description:'전리품 호송과 귀환 임무를 맡는 인원을 위한 판금갑.',
  },
  mining_detail_reinforced_gloves:{
    kind:'mining_detail_reinforced_gloves',
    name:'채굴반 강화 장갑',
    slot:'gloves',
    baseStats:{attack:3,defense:2},
    description:'채굴과 잔해 작업, 근접 전투를 함께 버티도록 보강한 장갑.',
  },
  survey_corps_dust_boots:{
    kind:'survey_corps_dust_boots',
    name:'탐사대 방진 장화',
    slot:'boots',
    baseStats:{hp:15,defense:3},
    description:'먼지와 잔해가 많은 탑 내부 탐사를 위한 장화.',
  },
  association_registration_tag:{
    kind:'association_registration_tag',
    name:'협회 등록 인식패',
    slot:'necklace',
    baseStats:{attack:2,hp:25},
    description:'탐사자의 협회 등록 정보를 나타내는 목걸이형 인식패.',
  },
  expedition_merit_ring:{
    kind:'expedition_merit_ring',
    name:'원정 공적 반지',
    slot:'ring',
    baseStats:{attack:4,critChance:.03},
    description:'원정 실적을 인정받은 탐사자에게 수여되는 공적 반지.',
  },
} as const satisfies Record<EquipmentKind,EquipmentDefinition>;

export const EQUIPMENT_SLOT_NAMES:Record<Slot,string>={
  weapon:'무기',
  helmet:'투구',
  armor:'갑옷',
  gloves:'장갑',
  boots:'장화',
  necklace:'목걸이',
  ring:'반지',
};

export function equipmentDefinition(kind:EquipmentKind):EquipmentDefinition {
  return EQUIPMENT_DEFINITIONS[kind];
}

export function emptyEquipmentLoadout(weapon:string|null=null):EquipmentLoadout {
  return {
    weapon,
    helmet:null,
    armor:null,
    gloves:null,
    boots:null,
    necklace:null,
    ring:null,
  };
}

export function normalizeEquipmentLoadout(value:Partial<EquipmentLoadout>|null|undefined):EquipmentLoadout {
  return {
    weapon:value?.weapon??null,
    helmet:value?.helmet??null,
    armor:value?.armor??null,
    gloves:value?.gloves??null,
    boots:value?.boots??null,
    necklace:value?.necklace??null,
    ring:value?.ring??value?.accessory??null,
  };
}


export function equipmentItemMultiplier(item:EquipmentItem):number {
  return EQUIPMENT_GRADE_MULTIPLIERS[item.grade]*EQUIPMENT_ENHANCEMENT_MULTIPLIERS[item.enhancement];
}

export function equipmentItemStats(item:EquipmentItem):EquipmentBaseStats {
  const definition=equipmentDefinition(item.kind),multiplier=equipmentItemMultiplier(item),base=definition.baseStats;
  return {
    hp:base.hp===undefined?undefined:base.hp*multiplier,
    attack:base.attack===undefined?undefined:base.attack*multiplier,
    defense:base.defense===undefined?undefined:base.defense*multiplier,
    critChance:base.critChance,
  };
}

export function equipmentItemName(item:EquipmentItem):string {
  return `${EQUIPMENT_GRADE_NAMES[item.grade]} ${equipmentDefinition(item.kind).name} +${item.enhancement}`;
}

export function equipmentItemSlot(item:EquipmentItem):Slot {
  return equipmentDefinition(item.kind).slot;
}


export const V2_STARTER_EQUIPMENT_ID='starter-v2';

export function createV2StarterEquipment():EquipmentItem {
  return {
    id:V2_STARTER_EQUIPMENT_ID,
    kind:'association_supply_iron_sword',
    grade:'common',
    enhancement:0,
  };
}
