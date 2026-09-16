import type {EventCondition,EventEffect,ExpeditionEventDefinition} from './types';

const positiveInteger=(value:number)=>Number.isSafeInteger(value)&&value>0;
const ratio=(value:number)=>Number.isFinite(value)&&value>0&&value<=1;

function validateCondition(condition:EventCondition,path:string,errors:string[]){
 switch(condition.kind){
  case 'PLAYER_HP_BELOW':
  case 'PLAYER_HP_ABOVE':if(!ratio(condition.ratio))errors.push(`${path}: ratio must be > 0 and <= 1`);break;
  case 'TIER':
  case 'FLOOR':if(!Number.isFinite(condition.min)||!Number.isFinite(condition.max)||condition.min>condition.max)errors.push(`${path}: invalid range`);break;
  case 'HAS_ITEM':
  case 'MISSING_ITEM':if(condition.quantity!==undefined&&!positiveInteger(condition.quantity))errors.push(`${path}: quantity must be a positive integer`);break;
  case 'HAS_POTION':
  case 'MISSING_POTION':if(condition.amount!==undefined&&!positiveInteger(condition.amount))errors.push(`${path}: amount must be a positive integer`);break;
  case 'TOWER':if(condition.values.length===0)errors.push(`${path}: tower list must not be empty`);break;
  case 'BOSS_FLOOR':
  case 'FLOOR_TYPE':
  case 'CUSTOM':break;
  default:{const exhaustive:never=condition;return exhaustive;}
 }
}

function validateEffect(effect:EventEffect,path:string,errors:string[]){
 switch(effect.kind){
  case 'HEAL_HP':if(!ratio(effect.ratio))errors.push(`${path}: heal ratio must be > 0 and <= 1`);break;
  case 'TAKE_DAMAGE':if(!Number.isFinite(effect.amount)||effect.amount<0)errors.push(`${path}: damage must be >= 0`);break;
  case 'TAKE_DAMAGE_RATIO':
   if(!ratio(effect.ratio))errors.push(`${path}: damage ratio must be > 0 and <= 1`);
   if(effect.minimum!==undefined&&(!Number.isFinite(effect.minimum)||effect.minimum<0))errors.push(`${path}: minimum damage must be >= 0`);
   break;
  case 'ADD_POTION':
  case 'CONSUME_POTION':if(!positiveInteger(effect.amount))errors.push(`${path}: potion amount must be a positive integer`);break;
  case 'ADD_EXPEDITION_SILVER':if(!Number.isFinite(effect.amount)||effect.amount<0)errors.push(`${path}: silver must be >= 0`);break;
  case 'ADD_TEMP_LOOT':if(!positiveInteger(effect.loot.amount))errors.push(`${path}: loot amount must be a positive integer`);break;
  case 'APPLY_EFFECT':
  case 'REMOVE_EFFECT':if(!effect.effectId)errors.push(`${path}: effectId is required`);break;
  case 'START_BOSS_BATTLE':
  case 'NO_EFFECT':break;
  default:{const exhaustive:never=effect;return exhaustive;}
 }
}

export function validateEventCatalog(catalog:ExpeditionEventDefinition[]):string[]{
 const errors:string[]=[];
 const eventIds=new Set<string>();
 for(const event of catalog){
  const eventPath=`event:${event.id||'<missing>'}`;
  if(!event.id)errors.push(`${eventPath}: id is required`);
  else if(eventIds.has(event.id))errors.push(`${eventPath}: duplicate event id`);
  eventIds.add(event.id);
  if(!Number.isFinite(event.weight)||event.weight<=0)errors.push(`${eventPath}: weight must be > 0`);
  if(event.metadata?.fixture)errors.push(`${eventPath}: fixture event cannot enter production catalog`);
  if(event.choices.length===0)errors.push(`${eventPath}: at least one choice is required`);
  event.conditions?.forEach((condition,index)=>validateCondition(condition,`${eventPath}.condition[${index}]`,errors));
  const choiceIds=new Set<string>();
  for(const choice of event.choices){
   const choicePath=`${eventPath}.choice:${choice.id||'<missing>'}`;
   if(!choice.id)errors.push(`${choicePath}: id is required`);
   else if(choiceIds.has(choice.id))errors.push(`${choicePath}: duplicate choice id`);
   choiceIds.add(choice.id);
   choice.conditions?.forEach((condition,index)=>validateCondition(condition,`${choicePath}.condition[${index}]`,errors));
   choice.effects.forEach((effect,index)=>validateEffect(effect,`${choicePath}.effect[${index}]`,errors));
   const outcomeIds=new Set<string>();
   for(const outcome of choice.outcomes??[]){
    const outcomePath=`${choicePath}.outcome:${outcome.id||'<missing>'}`;
    if(!outcome.id)errors.push(`${outcomePath}: id is required`);
    else if(outcomeIds.has(outcome.id))errors.push(`${outcomePath}: duplicate outcome id`);
    outcomeIds.add(outcome.id);
    if(!Number.isFinite(outcome.weight)||outcome.weight<=0)errors.push(`${outcomePath}: weight must be > 0`);
    outcome.effects.forEach((effect,index)=>validateEffect(effect,`${outcomePath}.effect[${index}]`,errors));
   }
  }
 }
 return errors;
}
