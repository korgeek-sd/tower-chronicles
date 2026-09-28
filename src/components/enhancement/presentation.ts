import type {EquipmentItem,GameState,Item} from '../../game/types';
import {TOWERS,WEAPONS} from '../../game/data/config';
import {enhancementQuote} from '../../game/engine/enhancement';
import {equipmentEnhancementQuote} from '../../game/engine/equipmentEnhancementV2';
import {equipmentItemStats,V2_STARTER_EQUIPMENT_ID} from '../../game/data/equipment';
import {accessoryPassive,equipmentContribution} from '../../game/engine/equipmentStats';

export interface EnhancementPreviewRow {label:string;current:string;next:string}

const number=(value:number,digits=1)=>{
  const fixed=value.toFixed(digits);
  return fixed.replace(/\.0+$/,'');
};

export function enhancementPreviewRows(item:Item):EnhancementPreviewRow[]{
  if(item.enhancement>=3)return [];
  const next={...item,enhancement:(item.enhancement+1) as Item['enhancement']};
  if(item.kind in WEAPONS||item.kind==='armor'||item.kind==='boots'){
    const current=equipmentContribution(item),target=equipmentContribution(next),rows:EnhancementPreviewRow[]=[];
    if(current.hp||target.hp)rows.push({label:'최대 HP 기여',current:number(current.hp),next:number(target.hp)});
    if(current.attack||target.attack)rows.push({label:'공격 기여',current:number(current.attack),next:number(target.attack)});
    if(current.defense||target.defense)rows.push({label:'방어 기여',current:number(current.defense),next:number(target.defense)});
    if(current.speed||target.speed)rows.push({label:'공격속도 기여',current:number(current.speed,2),next:number(target.speed,2)});
    return rows;
  }
  const current=accessoryPassive(item),target=accessoryPassive(next);
  if(!current||!target)return [];
  const label=current.kind==='vampire'?'흡혈':current.kind==='unyielding'?'피해 감소':'공격력 증가';
  return [{label,current:Math.round(current.value*100)+'%',next:Math.round(target.value*100)+'%'}];
}

export function enhancementAttemptView(game:GameState,item:Item){
  const quote=enhancementQuote(game,item.id);
  if(!quote)return {
    quote:null,
    materialName:null,
    materialOwned:0,
    canAttempt:false,
    reason:item.id==='starter'?'지급용 장비는 강화할 수 없습니다.':item.enhancement>=3?'최대 강화 단계입니다.':'강화할 수 없는 장비입니다.',
  };
  const owned=game.materials[quote.materialTower][quote.materialTier-1];
  const reason=game.expedition?'원정 중에는 강화할 수 없습니다.':game.silver<quote.silverCost?'Silver가 부족합니다.':owned<quote.materialCost?'강화 재료가 부족합니다.':'';
  return {
    quote,
    materialName:`T${quote.materialTier} ${TOWERS[quote.materialTower].material}`,
    materialOwned:owned,
    canAttempt:!reason,
    reason,
  };
}


export function equipmentEnhancementPreviewRows(item:EquipmentItem):EnhancementPreviewRow[]{
 if(item.enhancement>=10)return [];
 const next={...item,enhancement:(item.enhancement+1) as EquipmentItem['enhancement']};
 const current=equipmentItemStats(item),target=equipmentItemStats(next),rows:EnhancementPreviewRow[]=[];
 if((current.hp??0)!==(target.hp??0))rows.push({label:'최대 HP',current:number(current.hp??0),next:number(target.hp??0)});
 if((current.attack??0)!==(target.attack??0))rows.push({label:'공격',current:number(current.attack??0),next:number(target.attack??0)});
 if((current.defense??0)!==(target.defense??0))rows.push({label:'방어',current:number(current.defense??0),next:number(target.defense??0)});
 return rows;
}

export function equipmentEnhancementAttemptView(game:GameState,item:EquipmentItem){
 const quote=equipmentEnhancementQuote(game,item.id);
 if(!quote)return {
  quote:null,
  materialName:'강화석',
  materialOwned:Math.max(0,game.lootItems.enhancement_stone??0),
  canAttempt:false,
  reason:item.id===V2_STARTER_EQUIPMENT_ID?'협회 보급 장비는 강화할 수 없습니다.':
    item.enhancement>=10?'최대 강화 단계입니다.':'강화할 수 없는 장비입니다.',
 };
 return {
  quote,
  materialName:'강화석',
  materialOwned:quote.stonesOwned,
  canAttempt:quote.canAttempt,
  reason:quote.reason,
 };
}
