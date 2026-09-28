import type {EquipmentGrade,EquipmentKind} from '../types';

export type EquipmentGradeWeights=Record<EquipmentGrade,number>;
export type EquipmentIdentityWeights=readonly [
  number,number,number,number,number,number,number,number,number,
];

export interface EquipmentDropTable {
  equipmentChance:number;
  itemPool:readonly EquipmentKind[];
  gradeWeights:EquipmentGradeWeights;
}

export const SHARED_EQUIPMENT_KINDS=[
  'association_supply_iron_sword',
  'outer_guard_longbow',
  'archive_standard_arcane_staff',
  'expedition_iron_helmet',
  'return_corps_plate_armor',
  'mining_detail_reinforced_gloves',
  'survey_corps_dust_boots',
  'association_registration_tag',
  'expedition_merit_ring',
] as const satisfies readonly EquipmentKind[];

const gradeWeights=(
  common:number,
  uncommon:number,
  rare:number,
  heroic:number,
  legendary:number,
):EquipmentGradeWeights=>({common,uncommon,rare,heroic,legendary});

const floorTable=(
  equipmentChance:number,
  itemPool:readonly EquipmentKind[],
  weights:EquipmentGradeWeights,
):EquipmentDropTable=>({equipmentChance,itemPool,gradeWeights:weights});

const FLOOR_1_POOL=[
  'association_supply_iron_sword',
  'expedition_iron_helmet',
  'survey_corps_dust_boots',
] as const satisfies readonly EquipmentKind[];

const FLOOR_2_POOL=[
  'outer_guard_longbow',
  'return_corps_plate_armor',
  'mining_detail_reinforced_gloves',
] as const satisfies readonly EquipmentKind[];

const FLOOR_3_POOL=[
  'archive_standard_arcane_staff',
  'association_registration_tag',
  'expedition_merit_ring',
] as const satisfies readonly EquipmentKind[];

const COMMON_UNCOMMON=gradeWeights(85,15,0,0,0);
const COMMON_TO_RARE=gradeWeights(70,24,6,0,0);
const COMMON_TO_HEROIC=gradeWeights(55,30,12,3,0);

export const IRON_EQUIPMENT_FLOOR_DROPS:Record<number,EquipmentDropTable>={
  1:floorTable(.08,FLOOR_1_POOL,COMMON_UNCOMMON),
  2:floorTable(.09,FLOOR_2_POOL,COMMON_UNCOMMON),
  3:floorTable(.10,FLOOR_3_POOL,COMMON_TO_RARE),
  4:floorTable(.11,SHARED_EQUIPMENT_KINDS,COMMON_TO_RARE),
  5:floorTable(.12,SHARED_EQUIPMENT_KINDS,COMMON_TO_RARE),
  6:floorTable(.14,SHARED_EQUIPMENT_KINDS,COMMON_TO_HEROIC),
  7:floorTable(.16,SHARED_EQUIPMENT_KINDS,COMMON_TO_HEROIC),
  8:floorTable(.18,SHARED_EQUIPMENT_KINDS,gradeWeights(0,65,27,8,0)),
  9:floorTable(.20,SHARED_EQUIPMENT_KINDS,gradeWeights(0,55,32,12,1)),
  10:floorTable(.25,SHARED_EQUIPMENT_KINDS,gradeWeights(0,48,34,16,2)),
};

export type IronNormalMonsterId=
  | 'goblin_miner'
  | 'goblin_carrier'
  | 'goblin_overseer'
  | 'cave_rat'
  | 'mine_bat';

export const IRON_MONSTER_EQUIPMENT_WEIGHTS:Record<IronNormalMonsterId,EquipmentIdentityWeights>={
  goblin_miner:[18,7,7,7,7,22,18,7,7],
  goblin_carrier:[8,8,8,8,21,8,8,21,10],
  goblin_overseer:[18,7,7,18,7,7,7,7,22],
  cave_rat:[7,7,7,7,7,7,26,26,6],
  mine_bat:[7,26,26,7,7,7,7,7,6],
};

export const IRON_BOSS_EQUIPMENT_DROPS:Record<number,EquipmentDropTable>={
  6:floorTable(.60,SHARED_EQUIPMENT_KINDS,gradeWeights(0,55,35,10,0)),
  7:floorTable(.70,SHARED_EQUIPMENT_KINDS,gradeWeights(0,45,40,15,0)),
  8:floorTable(.80,SHARED_EQUIPMENT_KINDS,gradeWeights(0,35,43,21,1)),
  9:floorTable(.90,SHARED_EQUIPMENT_KINDS,gradeWeights(0,25,45,27,3)),
  10:floorTable(1,SHARED_EQUIPMENT_KINDS,gradeWeights(0,0,55,38,7)),
};

export function ironEquipmentFloorDrop(floor:number):EquipmentDropTable|null {
  if(!Number.isInteger(floor)||floor<1||floor>10)return null;
  return IRON_EQUIPMENT_FLOOR_DROPS[floor]??null;
}

export function ironEquipmentWeightsForFloor(
  floor:number,
  monsterId:IronNormalMonsterId,
):Partial<Record<EquipmentKind,number>> {
  const table=ironEquipmentFloorDrop(floor);
  if(!table)return {};
  const weights=IRON_MONSTER_EQUIPMENT_WEIGHTS[monsterId];
  const allowed=new Set<EquipmentKind>(table.itemPool);
  const selected=SHARED_EQUIPMENT_KINDS
    .map((kind,index)=>[kind,weights[index]] as const)
    .filter(([kind])=>allowed.has(kind));
  const total=selected.reduce((sum,[,weight])=>sum+weight,0);
  if(total<=0)return {};
  return Object.fromEntries(
    selected.map(([kind,weight])=>[kind,weight/total*100]),
  ) as Partial<Record<EquipmentKind,number>>;
}


function unit(value:number){
  if(!Number.isFinite(value))return 0;
  return Math.max(0,Math.min(.999999999999,value));
}

function pickByWeights<T extends string>(entries:readonly (readonly [T,number])[],roll:number):T|null {
  const total=entries.reduce((sum,[,weight])=>sum+Math.max(0,weight),0);
  if(total<=0)return null;
  let point=unit(roll)*total;
  for(const [value,weight] of entries){
    point-=Math.max(0,weight);
    if(point<0)return value;
  }
  return entries.at(-1)?.[0]??null;
}

function pickGrade(weights:EquipmentGradeWeights,roll:number):EquipmentGrade|null {
  return pickByWeights(
    (['common','uncommon','rare','heroic','legendary'] as const).map(grade=>[grade,weights[grade]] as const),
    roll,
  );
}

export interface RolledEquipmentDrop {
  kind:EquipmentKind;
  grade:EquipmentGrade;
  enhancement:0;
}

export function rollIronEquipmentDrop(
  floor:number,
  monsterId:string,
  boss:boolean,
  rng:()=>number=Math.random,
):RolledEquipmentDrop|null {
  const table=boss?IRON_BOSS_EQUIPMENT_DROPS[floor]:ironEquipmentFloorDrop(floor);
  if(!table||unit(rng())>=table.equipmentChance)return null;

  let kind:EquipmentKind|null=null;
  if(boss){
    kind=table.itemPool[Math.min(table.itemPool.length-1,Math.floor(unit(rng())*table.itemPool.length))]??null;
  }else if(monsterId in IRON_MONSTER_EQUIPMENT_WEIGHTS){
    const normalized=ironEquipmentWeightsForFloor(floor,monsterId as IronNormalMonsterId);
    kind=pickByWeights(
      table.itemPool.map(item=>[item,normalized[item]??0] as const),
      rng(),
    );
  }
  if(!kind)return null;
  const grade=pickGrade(table.gradeWeights,rng());
  return grade?{kind,grade,enhancement:0}:null;
}


export const IRON_ENHANCEMENT_STONE_CHANCES:Record<number,number>={
  1:.12,2:.14,3:.16,4:.18,5:.20,6:.22,7:.25,8:.28,9:.32,10:.38,
};

export const IRON_BOSS_ENHANCEMENT_STONES:Record<number,number>={
  6:3,7:4,8:5,9:7,10:10,
};

export function rollIronEnhancementStoneDrop(
  floor:number,
  boss:boolean,
  rng:()=>number=Math.random,
):number {
  if(!Number.isInteger(floor)||floor<1||floor>10)return 0;
  if(boss)return IRON_BOSS_ENHANCEMENT_STONES[floor]??0;
  const chance=IRON_ENHANCEMENT_STONE_CHANCES[floor]??0;
  if(unit(rng())>=chance)return 0;
  const roll=unit(rng());
  if(floor<=4)return 1;
  if(floor<=7)return roll<.30?1:2;
  if(floor===8)return roll<.50?1:2;
  if(floor===9)return roll<.50?1:roll<.85?2:3;
  return roll<.40?1:roll<.80?2:3;
}
