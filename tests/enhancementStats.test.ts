import test from 'node:test';
import assert from 'node:assert/strict';
import type {EnhancementLevel,GameState,Item,Weapon} from '../src/game/types.ts';
import {CONFIG,EQUIPMENT,WEAPONS} from '../src/game/data/config.ts';
import {ACCESSORY_ENHANCEMENT_VALUES,EQUIPMENT_STAT_ENHANCEMENT_STEP,equipmentStatMultiplier} from '../src/game/data/enhancement.ts';
import {accessoryPassive,equipmentContribution,equipmentStats} from '../src/game/engine/equipmentStats.ts';
import {initialState,stats} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {basicAttack} from '../src/game/engine/combat.ts';
import {resolveActorDirectHits} from '../src/game/engine/monsterSkills.ts';

const noCrit=()=>.99;
const item=(id:string,kind:string,enhancement:EnhancementLevel,tier=1):Item=>({id,kind,tier,enhancement});

function withWeapon(weapon:Weapon,enhancement:EnhancementLevel){
  const s=initialState();
  s.items.push(item('weapon',weapon,enhancement));
  s.equipped.weapon='weapon';
  return s;
}

function withAccessory(kind:'vampire'|'unyielding'|'berserker',enhancement:EnhancementLevel){
  const s=withWeapon('sword',0);
  s.items.push(item('accessory',kind,enhancement));
  s.equipped.accessory='accessory';
  return s;
}

test('ENHANCE STATS 01: numeric gear contributions gain exactly 10% per enhancement level',()=>{
  assert.equal(EQUIPMENT_STAT_ENHANCEMENT_STEP,.10);
  assert.deepEqual(([0,1,2,3] as EnhancementLevel[]).map(equipmentStatMultiplier),[1,1.1,1.2,1.3]);
});

test('ENHANCE STATS 02: weapon enhancement preserves the existing deterministic +10% contribution rule',()=>{
  for(const enhancement of [0,1,2,3] as EnhancementLevel[]){
    const s=withWeapon('sword',enhancement);
    const mult=equipmentStatMultiplier(enhancement);
    assert.equal(stats(s).attack,CONFIG.baseAttack+WEAPONS.sword.attack*mult);
    assert.equal(stats(s).defense,CONFIG.baseDefense+WEAPONS.sword.defense*mult);
  }
});

test('ENHANCE STATS 03: armor enhancement scales only its HP and defense contribution',()=>{
  const base=item('armor','armor',0),max=item('armor3','armor',3);
  assert.deepEqual(equipmentContribution(base),{hp:EQUIPMENT.armor.hp,attack:0,defense:EQUIPMENT.armor.defense,speed:0});
  assert.deepEqual(equipmentContribution(max),{hp:EQUIPMENT.armor.hp*1.3,attack:0,defense:EQUIPMENT.armor.defense*1.3,speed:0});
});

test('ENHANCE STATS 04: boots enhancement scales only HP and speed contribution',()=>{
  const base=item('boots','boots',0),max=item('boots3','boots',3);
  assert.deepEqual(equipmentContribution(base),{hp:EQUIPMENT.boots.hp,attack:0,defense:0,speed:EQUIPMENT.boots.speed});
  assert.deepEqual(equipmentContribution(max),{hp:EQUIPMENT.boots.hp*1.3,attack:0,defense:0,speed:EQUIPMENT.boots.speed*1.3});
});

test('ENHANCE STATS 05: identical tier/kind/enhancement always resolves identical stats regardless of item id',()=>{
  const s=initialState();
  s.items.push(item('a','armor',2,3),item('b','armor',2,3));
  const a=equipmentStats(s,{...s.equipped,armor:'a'}),b=equipmentStats(s,{...s.equipped,armor:'b'});
  assert.deepEqual(a,b);
});

test('ENHANCE STATS 06: accessory resolver returns the confirmed +0 through +3 passive magnitudes',()=>{
  for(const kind of ['vampire','unyielding','berserker'] as const){
    for(const enhancement of [0,1,2,3] as EnhancementLevel[]){
      assert.equal(accessoryPassive(item('x',kind,enhancement))?.value,ACCESSORY_ENHANCEMENT_VALUES[kind][enhancement]);
    }
  }
  assert.equal(accessoryPassive(item('armor','armor',3)),null);
});

test('ENHANCE STATS 07: +3 berserker uses 50% attack gain while the HP trigger remains 40%',()=>{
  let s=enter(withAccessory('berserker',3),'ore',1);
  const e=s.expedition!,base=stats(s,e.equipment);
  e.monster.hp=10_000;e.monster.currentHp=10_000;e.monster.defense=0;e.hp=base.hp*.40;
  const hit=resolveActorDirectHits(s,'player',1,1,true,noCrit);
  assert.equal(hit.incomingTotal,Math.floor(base.attack*1.50));
  assert.equal(accessoryPassive(s.items.find(i=>i.id==='accessory'))?.kind,'berserker');
});

test('ENHANCE STATS 08: +3 unyielding uses 36% reduction at 35% HP and does not widen the trigger',()=>{
  const low=enter(withAccessory('unyielding',3),'ore',1),high=enter(withAccessory('unyielding',3),'ore',1);
  for(const s of [low,high]){s.expedition!.monster.attack=50;s.expedition!.monster.defense=0;}
  low.expedition!.hp=stats(low,low.expedition!.equipment).hp*.35;
  high.expedition!.hp=stats(high,high.expedition!.equipment).hp*.36;
  const lowHit=resolveActorDirectHits(low,'monster',1,1,true,noCrit);
  const highHit=resolveActorDirectHits(high,'monster',1,1,true,noCrit);
  const defense=stats(low,low.expedition!.equipment).defense;
  assert.equal(lowHit.incomingTotal,Math.floor(Math.max(1,50*(1-.36)-defense)));
  assert.equal(highHit.incomingTotal,Math.floor(Math.max(1,50-defense)));
  assert.ok(lowHit.incomingTotal<highHit.incomingTotal);
});

test('ENHANCE STATS 09: +3 vampire heals 11% of post-shield basic-attack HP damage',()=>{
  let s=enter(withAccessory('vampire',3),'ore',1);
  const e=s.expedition!;
  e.monster.hp=10_000;e.monster.currentHp=10_000;e.monster.defense=0;e.hp=50;
  const dealt=Math.floor(stats(s,e.equipment).attack);
  s=basicAttack(s,noCrit);
  assert.equal(s.expedition!.hp,50+dealt*.11);
});
