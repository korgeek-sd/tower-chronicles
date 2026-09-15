import type {GameState,Bag,Item,Slot,Weapon,Stats,GearMasteryKey,MarketState,AssociationState} from '../types';
import {CONFIG,STARTER,TOWERS,WEAPONS,EQUIPMENT,PASSIVES,towerIds,GEAR_MASTERY_KEYS,GEAR_MASTERY_NAMES} from '../data/config';
import {initialCosmetics} from './cosmetics';
import {initialPresets} from './presets';
export const emptyBag=():Bag=>({health:0,regen:0,attack:0,defense:0,haste:0});
export const initialGearMastery=()=>Object.fromEntries(GEAR_MASTERY_KEYS.map(k=>[k,{unlockedTier:1,progress:0}])) as GameState['gearMastery'];
export const initialMarketState=():MarketState=>({traderCertified:false,ownerId:'local-player',gold:1000,orders:[],trades:[],nextOrderId:1,nextTradeId:1,nextSequence:1});
export const initialCraftingState=()=>({jobs:[],nextJobId:1});
export const initialAssociationState=():AssociationState=>({currentId:null,associations:[],nextId:1,nextApplicationId:1});
export function initialState():GameState {return {version:19,ownedJobIds:[],currentJobId:null,exploration:{unlockedTier:{ore:1,leather:1,gem:1,kaleon:1},highestReturned:{ore:0,leather:0,gem:0,kaleon:0}},crafting:initialCraftingState(),association:initialAssociationState(),market:initialMarketState(),goldenRecorder:{expiresAt:null},expeditionPresets:initialPresets(),cosmetics:initialCosmetics(),gearMastery:initialGearMastery(),skillBooks:{},lootItems:{},lastExpedition:null,silver:0,materials:Object.fromEntries(towerIds.map(t=>[t,[0,0,0,0,0]])) as GameState['materials'],items:[{id:'starter',kind:'sword',tier:1,enhancement:0}],equipped:{weapon:'starter',armor:null,boots:null,accessory:null},learned:['heavy','guard','quick'],skills:['heavy','guard','quick'],potions:{health:CONFIG.starterHealth,regen:CONFIG.starterOther,attack:CONFIG.starterOther,defense:CONFIG.starterOther,haste:CONFIG.starterOther},loadout:{health:10,regen:2,attack:1,defense:1,haste:1},threshold:70,mastery:{weapon:{unlocked:1,progress:0,crafts:0},armor:{unlocked:1,progress:0,crafts:0},accessory:{unlocked:1,progress:0,crafts:0},alchemy:{unlocked:1,progress:0,crafts:0}},tickets:Object.fromEntries(towerIds.map(t=>[t,Array.from({length:50},(_,i)=>i===0?CONFIG.starterTickets:0)])) as GameState['tickets'],progress:{ore:1,leather:1,gem:1,kaleon:1},expedition:null,logs:[],notice:'첫 원정을 준비하세요. 각 탑 1층 입장권 20장 지급!',nextId:1};}
export const itemSlot=(kind:string):Slot=>kind in WEAPONS?'weapon':kind==='armor'?'armor':kind==='boots'?'boots':'accessory';
export const itemName=(item:Item)=>`${item.tier}T ${item.id==='starter'?STARTER.name:item.kind in WEAPONS?WEAPONS[item.kind as Weapon].name:item.kind in EQUIPMENT?EQUIPMENT[item.kind as keyof typeof EQUIPMENT].name:PASSIVES[item.kind as keyof typeof PASSIVES].name+' 장신구'} +${item.enhancement}`;
export const equippedItem=(s:GameState,slot:Slot,equipment=s.equipped)=>s.items.find(i=>i.id===equipment[slot]);
export const weaponOf=(s:GameState,equipment=s.equipped):Weapon=>(equippedItem(s,'weapon',equipment)?.kind as Weapon)||'sword';
export function stats(s:GameState,equipment=s.equipped):Stats {const w=equippedItem(s,'weapon',equipment);const d=WEAPONS[weaponOf(s,equipment)];const scale=w?(w.id==='starter'?STARTER.scale:1)*w.tier*(1+w.enhancement*.1):.4;const armor=equippedItem(s,'armor',equipment),boots=equippedItem(s,'boots',equipment);return {hp:CONFIG.baseHp+(armor?.tier||0)*EQUIPMENT.armor.hp+(boots?.tier||0)*EQUIPMENT.boots.hp,attack:CONFIG.baseAttack+d.attack*scale,defense:CONFIG.baseDefense+d.defense*scale+(armor?.tier||0)*EQUIPMENT.armor.defense,speed:d.speed+(boots?.tier||0)*EQUIPMENT.boots.speed,skillPower:d.skillPower};}
export function log(s:GameState,message:string){s.logs.push(message);s.logs=s.logs.slice(-CONFIG.logLimit);}
export const masteryKeyOf=(item:Item):GearMasteryKey=>item.kind in WEAPONS?item.kind as Weapon:itemSlot(item.kind) as Exclude<Slot,'weapon'>;
export function equip(s:GameState,id:string):GameState {if(s.expedition)return {...s,notice:'원정 중에는 장비를 변경할 수 없습니다.'};const n=structuredClone(s),item=n.items.find(i=>i.id===id);if(item){const key=masteryKeyOf(item),allowed=n.gearMastery[key].unlockedTier;if(item.tier>allowed)return {...n,notice:`T${item.tier} ${GEAR_MASTERY_NAMES[key]}을 장착하려면 ${GEAR_MASTERY_NAMES[key]} 숙련이 더 필요합니다.`};n.equipped[itemSlot(item.kind)]=id;n.notice=`${itemName(item)} 장착 완료`;}return n;}







