import type {
  EquipmentGrade,
  EquipmentKind,
  EquipmentLoadout,
  EquipmentItem,
  Slot,
} from '../types';

export const EQUIPMENT_GRADES=[
  'common',
  'uncommon',
  'rare',
  'heroic',
  'legendary',
] as const satisfies readonly EquipmentGrade[];


export const EQUIPMENT_GRADE_NAMES:Record<EquipmentGrade,string>={
  common:'일반',
  uncommon:'고급',
  rare:'희귀',
  heroic:'영웅',
  legendary:'전설',
};


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
  critDamage?:number;
  armorPenetration?:number;
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
    baseStats:{attack:12,critChance:.02},
    description:'탑 외곽 경계 임무에 쓰이는 장거리 제식 무기.',
  },
  archive_standard_arcane_staff:{
    kind:'archive_standard_arcane_staff',
    name:'기록원 제식 마도봉',
    slot:'weapon',
    weaponFamily:'staff',
    baseStats:{attack:10,armorPenetration:.05},
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
    baseStats:{attack:3,critChance:.01},
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
    name:'귀환자의 부적 목걸이',
    slot:'necklace',
    baseStats:{hp:25,critDamage:.05},
    description:'탐사자의 협회 등록 정보를 나타내는 목걸이형 인식패.',
  },
  expedition_merit_ring:{
    kind:'expedition_merit_ring',
    name:'추적자의 인장 반지',
    slot:'ring',
    baseStats:{attack:4,armorPenetration:.02},
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


export const EQUIPMENT_FIXED_STATS={
  "association_supply_iron_sword": {
    "common": {
      "attack": 10,
      "defense": 4
    },
    "uncommon": {
      "attack": 12,
      "defense": 5
    },
    "rare": {
      "attack": 14,
      "defense": 6
    },
    "heroic": {
      "attack": 17,
      "defense": 7
    },
    "legendary": {
      "attack": 20,
      "defense": 8
    }
  },
  "outer_guard_longbow": {
    "common": {
      "attack": 12,
      "critChance": 0.02
    },
    "uncommon": {
      "attack": 14,
      "critChance": 0.03
    },
    "rare": {
      "attack": 17,
      "critChance": 0.04
    },
    "heroic": {
      "attack": 20,
      "critChance": 0.05
    },
    "legendary": {
      "attack": 24,
      "critChance": 0.06
    }
  },
  "archive_standard_arcane_staff": {
    "common": {
      "attack": 10,
      "armorPenetration": 0.05
    },
    "uncommon": {
      "attack": 12,
      "armorPenetration": 0.07
    },
    "rare": {
      "attack": 14,
      "armorPenetration": 0.09
    },
    "heroic": {
      "attack": 17,
      "armorPenetration": 0.12
    },
    "legendary": {
      "attack": 20,
      "armorPenetration": 0.15
    }
  },
  "expedition_iron_helmet": {
    "common": {
      "hp": 20,
      "defense": 5
    },
    "uncommon": {
      "hp": 25,
      "defense": 6
    },
    "rare": {
      "hp": 30,
      "defense": 7
    },
    "heroic": {
      "hp": 40,
      "defense": 9
    },
    "legendary": {
      "hp": 50,
      "defense": 11
    }
  },
  "return_corps_plate_armor": {
    "common": {
      "hp": 55,
      "defense": 7
    },
    "uncommon": {
      "hp": 65,
      "defense": 9
    },
    "rare": {
      "hp": 80,
      "defense": 11
    },
    "heroic": {
      "hp": 100,
      "defense": 14
    },
    "legendary": {
      "hp": 125,
      "defense": 17
    }
  },
  "mining_detail_reinforced_gloves": {
    "common": {
      "attack": 3,
      "critChance": 0.01
    },
    "uncommon": {
      "attack": 4,
      "critChance": 0.02
    },
    "rare": {
      "attack": 5,
      "critChance": 0.03
    },
    "heroic": {
      "attack": 6,
      "critChance": 0.04
    },
    "legendary": {
      "attack": 8,
      "critChance": 0.05
    }
  },
  "survey_corps_dust_boots": {
    "common": {
      "hp": 15,
      "defense": 3
    },
    "uncommon": {
      "hp": 20,
      "defense": 4
    },
    "rare": {
      "hp": 25,
      "defense": 5
    },
    "heroic": {
      "hp": 35,
      "defense": 6
    },
    "legendary": {
      "hp": 45,
      "defense": 8
    }
  },
  "association_registration_tag": {
    "common": {
      "hp": 25,
      "critDamage": 0.05
    },
    "uncommon": {
      "hp": 30,
      "critDamage": 0.07
    },
    "rare": {
      "hp": 40,
      "critDamage": 0.1
    },
    "heroic": {
      "hp": 50,
      "critDamage": 0.14
    },
    "legendary": {
      "hp": 65,
      "critDamage": 0.2
    }
  },
  "expedition_merit_ring": {
    "common": {
      "attack": 4,
      "armorPenetration": 0.02
    },
    "uncommon": {
      "attack": 5,
      "armorPenetration": 0.03
    },
    "rare": {
      "attack": 6,
      "armorPenetration": 0.04
    },
    "heroic": {
      "attack": 8,
      "armorPenetration": 0.06
    },
    "legendary": {
      "attack": 10,
      "armorPenetration": 0.08
    }
  }
} as const satisfies Record<EquipmentKind,Record<EquipmentGrade,EquipmentBaseStats>>;

export function equipmentItemStats(item:EquipmentItem):EquipmentBaseStats {
 return {...EQUIPMENT_FIXED_STATS[item.kind][item.grade]};
}

export function equipmentItemName(item:EquipmentItem):string {
  return `${EQUIPMENT_GRADE_NAMES[item.grade]} ${equipmentDefinition(item.kind).name}`;
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
