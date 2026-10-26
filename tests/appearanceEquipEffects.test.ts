import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPEARANCE_RARITIES,APPEARANCES} from '../src/game/data/cosmetics.ts';
import {
 APPEARANCE_EQUIP_EFFECTS,
 APPEARANCE_EQUIP_EFFECT_IDS,
 appearanceEquipEffectValue,
 formatAppearanceEquipEffect,
 type AppearanceEquipEffectId,
} from '../src/game/data/appearanceEquipEffects.ts';
import {HUNT_EQUIPMENT_RATES} from '../src/game/hunting/equipmentDrops.ts';

test('all 16 planned, equip-only appearance effects have unique IDs and sensible tiers',()=>{
 const ids=APPEARANCE_EQUIP_EFFECT_IDS;
 assert.equal(ids.length,16);
 assert.equal(new Set(ids).size,16);
 for(const id of ids){
  const effect=APPEARANCE_EQUIP_EFFECTS[id];
  assert.ok(effect.label.length>0);
  assert.ok(['percent','percentage_point','flat_mp','relative_percent'].includes(effect.unit));
  assert.ok(['combat','hunting_rewards'].includes(effect.scope));
  let previous=0;
  for(const rarity of APPEARANCE_RARITIES){
   const base=appearanceEquipEffectValue(id,rarity,1);
   assert.ok(base>0,id+':'+rarity);
   assert.ok(base>=previous,id+':'+rarity+' must not drop for higher rarity');
   assert.equal(appearanceEquipEffectValue(id,rarity,0),0);
   assert.equal(appearanceEquipEffectValue(id,rarity,6),0);
   assert.ok(appearanceEquipEffectValue(id,rarity,5)>=base);
   previous=base;
  }
 }
});
test('MP, XP, silver and equipment drop proposals follow agreed upgrade preview',()=>{
 assert.equal(appearanceEquipEffectValue('max_mp','SSR',1),50);
 assert.equal(appearanceEquipEffectValue('max_mp','SSR',5),75);
 assert.equal(appearanceEquipEffectValue('hunting_exp','SSR',5),7.5);
 assert.equal(appearanceEquipEffectValue('hunting_silver','SSR',5),7.5);
 assert.deepEqual(APPEARANCE_RARITIES.map(r=>appearanceEquipEffectValue('hunting_equipment_drop',r,1)),[2,4,6,8,10]);
 assert.deepEqual(APPEARANCE_RARITIES.map(r=>appearanceEquipEffectValue('hunting_equipment_drop',r,5)),[3,6,9,12,15]);
 assert.equal(APPEARANCE_EQUIP_EFFECTS.hunting_equipment_drop.unit,'relative_percent');
 assert.match(formatAppearanceEquipEffect('hunting_equipment_drop','SSR',1),/기존 확률 대비/);
 assert.match(formatAppearanceEquipEffect('crit_chance','SSR',1),/5%p/);
 assert.match(formatAppearanceEquipEffect('max_mp','SSR',5),/75 MP/);
 assert.match(formatAppearanceEquipEffect('mp_cost_reduction','SSR',1),/-8%/);
 assert.equal(appearanceEquipEffectValue('attack','SSR',2),5.5);
 assert.equal(appearanceEquipEffectValue('attack','SSR',4),6.75);
 assert.equal(appearanceEquipEffectValue('attack','SSR',1),5);
});
test('registering effect definitions alone does not assign them to appearances or change hunt drops',()=>{
 const ids=new Set<AppearanceEquipEffectId>(APPEARANCE_EQUIP_EFFECT_IDS);
 assert.equal(ids.size,16);
 assert.ok(APPEARANCES.filter(a=>a.id!=='default').every(a=>a.proposedBonus?.stat==='attack'));
 const sourceFiles=['src/game/data/cosmetics.ts','src/game/hunting/model.ts','src/game/hunting/equipmentDrops.ts','src/game/hunting/catalogCombat.ts','src/game/engine/equipmentStats.ts'];
 for(const path of sourceFiles){
  const source=readFileSync(path,'utf8');
  assert.doesNotMatch(source,/from ['"].*appearanceEquipEffects/,'candidate effects must remain unassigned: '+path);
 }
 assert.deepEqual(HUNT_EQUIPMENT_RATES.plains,[13000,2000,0,0,0]);
 assert.deepEqual(HUNT_EQUIPMENT_RATES.ruins,[13000,4500,1600,350,116]);
});
