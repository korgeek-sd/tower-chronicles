import type {GameState,Bag,Item,Slot,Weapon,Stats,GearMasteryKey,MarketState,AssociationState,CombatEvent,EquipmentItem,EquipmentKind,EquipmentLoadout} from '../types';
import {CONFIG,STARTER,TOWERS,WEAPONS,EQUIPMENT,PASSIVES,towerIds,GEAR_MASTERY_KEYS,GEAR_MASTERY_NAMES} from '../data/config';
import {EQUIPMENT_DEFINITIONS,V2_STARTER_EQUIPMENT_ID,createV2StarterEquipment,emptyEquipmentLoadout,equipmentItemName,equipmentItemSlot} from '../data/equipment';
import {initialCosmetics} from './cosmetics';
import {initialPresets} from './presets';
import {emptyBestiary} from './bestiary';
import {equipmentStats} from './equipmentStats';
export const emptyBag=():Bag=>({healing_lesser:0,healing_standard:0,healing_greater:0,healing_supreme:0,revival:0});
export const initialGearMastery=()=>Object.fromEntries(GEAR_MASTERY_KEYS.map(k=>[k,{unlockedTier:1,progress:0}])) as GameState['gearMastery'];
export const initialMarketState=():MarketState=>({traderCertified:false,ownerId:'local-player',gold:1000,orders:[],trades:[],storage:[],nextOrderId:1,nextTradeId:1,nextSequence:1,nextStorageId:1});
export const initialCraftingState=()=>({jobs:[],nextJobId:1});
export const initialAssociationState=():AssociationState=>({currentId:null,associations:[],nextId:1,nextApplicationId:1});
export function initialState():GameState {return {version:23,bestiary:emptyBestiary(),ownedJobIds:[],currentJobId:null,exploration:{unlockedTier:{ore:1,leather:1,gem:1,kaleon:1},highestReturned:{ore:0,leather:0,gem:0,kaleon:0}},crafting:initialCraftingState(),association:initialAssociationState(),market:initialMarketState(),goldenRecorder:{expiresAt:null},expeditionPresets:initialPresets(),cosmetics:initialCosmetics(),gearMastery:initialGearMastery(),skillBooks:{},lootItems:{},lastExpedition:null,silver:0,materials:Object.fromEntries(towerIds.map(t=>[t,[0,0,0,0,0]])) as GameState['materials'],items:[],equipmentItems:[createV2StarterEquipment()],equipped:emptyEquipmentLoadout(V2_STARTER_EQUIPMENT_ID),learned:['heavy','guard','quick'],skills:['heavy','guard','quick'],potions:{healing_lesser:CONFIG.starterLesser,healing_standard:CONFIG.starterStandard,healing_greater:0,healing_supreme:0,revival:0},loadout:{healing_lesser:10,healing_standard:0,healing_greater:0,healing_supreme:0,revival:0},threshold:70,mastery:{weapon:{unlocked:1,progress:0,crafts:0},armor:{unlocked:1,progress:0,crafts:0},accessory:{unlocked:1,progress:0,crafts:0},alchemy:{unlocked:1,progress:0,crafts:0}},tickets:Object.fromEntries(towerIds.map(t=>[t,Array.from({length:CONFIG.maxFloor},(_,i)=>i===0?CONFIG.starterTickets:0)])) as GameState['tickets'],progress:{ore:1,leather:1,gem:1,kaleon:1},expedition:null,logs:[],combatEvents:[],combatEventSequence:0,notice:'첫 원정을 준비하세요. 각 탑 1층 입장권 20장 지급!',nextId:1};}
export const itemSlot=(kind:string):Slot=>{
  const modern=EQUIPMENT_DEFINITIONS[kind as EquipmentKind];
  if(modern)return modern.slot;
  if(kind in WEAPONS)return 'weapon';
  if(kind==='armor')return 'armor';
  if(kind==='boots')return 'boots';
  return 'ring';
};
export const itemName=(item:Item)=>`${item.tier}T ${item.id==='starter'?STARTER.name:item.kind in WEAPONS?WEAPONS[item.kind as Weapon].name:item.kind in EQUIPMENT?EQUIPMENT[item.kind as keyof typeof EQUIPMENT].name:PASSIVES[item.kind as keyof typeof PASSIVES].name+' 장신구'} +${item.enhancement}`;
export const equippedItem=(s:GameState,slot:Slot|'accessory',equipment:EquipmentLoadout=s.equipped)=>{
  const id=slot==='accessory'?(equipment.accessory??equipment.ring):equipment[slot];
  return s.items.find(i=>i.id===id);
};
export const equipmentItemById=(s:GameState,id:string|null|undefined):EquipmentItem|undefined=>
  id?(s.equipmentItems??[]).find(item=>item.id===id):undefined;
export const equippedEquipmentItem=(s:GameState,slot:Slot,equipment:EquipmentLoadout=s.equipped)=>
  equipmentItemById(s,equipment[slot]);
export const weaponOf=(s:GameState,equipment=s.equipped):Weapon=>{
  const modern=equippedEquipmentItem(s,'weapon',equipment);
  const definition=modern?EQUIPMENT_DEFINITIONS[modern.kind]:null;
  const family=definition&&'weaponFamily' in definition?definition.weaponFamily:null;
  if(family)return family;
  return (equippedItem(s,'weapon',equipment)?.kind as Weapon)||'sword';
};
export function stats(s:GameState,equipment=s.equipped):Stats {return equipmentStats(s,equipment);}
export interface EquipmentStatComparison {
  slot:Slot;
  equipped:boolean;
  before:Pick<Stats,'attack'|'defense'|'hp'>;
  after:Pick<Stats,'attack'|'defense'|'hp'>;
  delta:Pick<Stats,'attack'|'defense'|'hp'>;
}
const comparisonStats=(value:Stats)=>({attack:value.attack,defense:value.defense,hp:value.hp});
export function equipmentStatComparison(s:GameState,id:string):EquipmentStatComparison|null {
  const modern=equipmentItemById(s,id);
  const legacy=s.items.find(item=>item.id===id);
  const slot=modern?equipmentItemSlot(modern):legacy?itemSlot(legacy.kind):null;
  if(!slot)return null;
  const equipped=s.equipped[slot]===id;
  const next:EquipmentLoadout={...s.equipped};
  if(equipped){
    next[slot]=null;
    if(slot==='ring'&&next.accessory===id)next.accessory=null;
  }else{
    next[slot]=id;
    if(slot==='ring')delete next.accessory;
  }
  const before=comparisonStats(stats(s));
  const after=comparisonStats(stats(s,next));
  return {
    slot,
    equipped,
    before,
    after,
    delta:{
      attack:after.attack-before.attack,
      defense:after.defense-before.defense,
      hp:after.hp-before.hp,
    },
  };
}
export function log(s:GameState,message:string){s.logs.push(message);s.logs=s.logs.slice(-CONFIG.logLimit);}
export function recordCombatEvent(s:GameState,event:Omit<CombatEvent,'id'>){const id=(s.combatEventSequence??0)+1;s.combatEventSequence=id;s.combatEvents=[...(s.combatEvents??[]),{...event,id}].slice(-40);}
export const masteryKeyOf=(item:Item):GearMasteryKey=>{
  if(item.kind in WEAPONS)return item.kind as Weapon;
  if(item.kind==='armor'||item.kind==='boots')return item.kind;
  return 'accessory';
};
export function equip(s:GameState,id:string):GameState {
  if(s.expedition)return {...s,notice:'원정 중에는 장비를 변경할 수 없습니다.'};
  const n=structuredClone(s),modern=equipmentItemById(n,id);
  if(modern){
    const slot=equipmentItemSlot(modern);
    n.equipped[slot]=id;
    if(slot==='ring')delete n.equipped.accessory;
    n.notice=`${equipmentItemName(modern)} 장착 완료`;
    return n;
  }
  const item=n.items.find(i=>i.id===id);
  if(item){
    const key=masteryKeyOf(item),allowed=n.gearMastery[key].unlockedTier;
    if(item.tier>allowed)return {...n,notice:`T${item.tier} ${GEAR_MASTERY_NAMES[key]}을 장착하려면 ${GEAR_MASTERY_NAMES[key]} 숙련이 더 필요합니다.`};
    n.equipped[itemSlot(item.kind)]=id;
    n.notice=`${itemName(item)} 장착 완료`;
  }
  return n;
}
export function unequip(s:GameState,id:string):GameState {
  if(s.expedition)return {...s,notice:'원정 중에는 장비를 변경할 수 없습니다.'};
  const n=structuredClone(s);
  const modern=equipmentItemById(n,id);
  const legacy=n.items.find(item=>item.id===id);
  const slot=modern?equipmentItemSlot(modern):legacy?itemSlot(legacy.kind):null;
  if(!slot||n.equipped[slot]!==id)return n;
  n.equipped[slot]=null;
  if(slot==='ring'&&n.equipped.accessory===id)n.equipped.accessory=null;
  n.notice=`${modern?equipmentItemName(modern):legacy?itemName(legacy):'장비'} 해제 완료`;
  return n;
}







