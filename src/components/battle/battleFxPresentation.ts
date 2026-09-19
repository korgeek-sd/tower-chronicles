import type {BattleFxEvent} from '../../game/engine/battleFx';

export type BattleFxImpact=
  |'slash'
  |'stab'
  |'arrow'
  |'magic_burst'
  |'heavy_hit'
  |'shield_hit'
  |'shield_cast'
  |'poison'
  |'bleed'
  |'armor_break'
  |'guard'
  |'haste'
  |'heal';

export type BattleFxShake='light'|'normal'|'heavy';
export type BattleFxSourceAction='PLAYER_ACTION'|'MONSTER_ACTION'|'SYSTEM';

export interface BattleFxPlaybackEvent extends BattleFxEvent {
  playbackId:string;
  batchId:string;
  atMs:number;
  lifetimeMs:number;
  impact:BattleFxImpact;
  shake?:BattleFxShake;
  label?:string;
}

export interface BattleFxBatch {
  id:string;
  sourceAction:BattleFxSourceAction;
  events:BattleFxPlaybackEvent[];
  durationMs:number;
}

function impactFor(event:BattleFxEvent):BattleFxImpact {
  if(event.kind==='ARMOR_BREAK')return 'armor_break';
  if(event.kind==='HEAL')return 'heal';
  if(event.kind==='STATUS'){
    if(event.effectId?.includes('shield'))return 'shield_cast';
    if(event.effectId==='poison'||event.effectId==='periodic_damage')return 'poison';
    if(event.effectId==='bleed')return 'bleed';
    if(event.skillId==='guard'||event.effectId==='guard')return 'guard';
    if(event.skillId==='quick')return 'haste';
    return 'magic_burst';
  }
  if((event.absorbedByShield??0)>0&&(event.damage??0)<=0)return 'shield_hit';
  if(event.skillId?.includes('charge'))return 'heavy_hit';
  if(event.skillId==='heavy')return 'heavy_hit';
  if(event.skillId==='execute')return 'slash';
  if(event.weaponId==='dagger')return 'stab';
  if(event.weaponId==='bow')return 'arrow';
  if(event.weaponId==='staff')return 'magic_burst';
  if(event.weaponId==='sword')return 'slash';
  return 'heavy_hit';
}

function shakeFor(event:BattleFxEvent):BattleFxShake|undefined {
  if(event.kind==='HEAL'||event.kind==='STATUS')return;
  if(event.kind==='ARMOR_BREAK'||event.skillId==='heavy'||event.skillId==='execute'||event.skillId?.includes('charge'))return 'heavy';
  if(event.weaponId==='dagger'||event.weaponId==='bow')return 'light';
  return 'normal';
}

function labelFor(event:BattleFxEvent){
  if(event.kind==='ARMOR_BREAK')return '갑주 파쇄';
  if(event.kind==='HEAL'&&(event.healing??0)>0)return '+'+Math.ceil(event.healing!);
  if((event.damage??0)>0)return '-'+Math.ceil(event.damage!);
  if((event.absorbedByShield??0)>0)return '보호막 '+Math.ceil(event.absorbedByShield!);
  return undefined;
}

function intervalFor(event:BattleFxEvent){
  if(event.kind==='DIRECT_HIT')return 110;
  if(event.kind==='ARMOR_BREAK')return 180;
  return 100;
}

export function buildBattleFxBatch(events:BattleFxEvent[],batchId:string,sourceAction:BattleFxSourceAction):BattleFxBatch {
  const ordered=[...events].sort((a,b)=>a.sequence-b.sequence);
  const seen=new Set<number>();
  const playback:BattleFxPlaybackEvent[]=[];
  let cursor=0;
  for(const event of ordered){
    if(seen.has(event.id))continue;
    seen.add(event.id);
    playback.push({
      ...event,
      playbackId:batchId+':'+event.id,
      batchId,
      atMs:cursor,
      lifetimeMs:event.kind==='ARMOR_BREAK'?520:430,
      impact:impactFor(event),
      shake:shakeFor(event),
      label:labelFor(event)
    });
    cursor+=intervalFor(event);
  }
  return {id:batchId,sourceAction,events:playback,durationMs:Math.max(180,cursor+80)};
}
