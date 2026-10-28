import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {IRON_NORMAL_POOL} from '../src/game/data/ironSpire.ts';
import {HUNT_MAPS} from '../src/game/hunting/model.ts';
import {HUNT_MONSTERS} from '../src/game/hunting/encounters.ts';

// Previous iron-tower sprite revisions not referenced by authored encounters or saved-run fallback art.
const retiredIronSprites=[
 'deep_hoist','deep_overseer','hollow_minecart','iron_carrier','muan_miner','mutant_rat',
 'ore_sorter','tunnel_blocker','vein_cutter','vein_probe','waste_compactor'
] as const;

test('orphaned retired iron tower sprites are removed without affecting registered tower compatibility images',()=>{
 for(const id of retiredIronSprites){
  assert.ok(!IRON_NORMAL_POOL.includes(id),'obsolete sprite is still in the normal monster pool: '+id);
  assert.equal(existsSync(new URL('../public/assets/monsters/iron-t1/'+id+'.png',import.meta.url)),false,id);
 }
 for(const id of IRON_NORMAL_POOL){
  assert.equal(existsSync(new URL('../public/assets/monsters/iron-t1/'+id+'.png',import.meta.url)),true,id);
 }
});

test('current hunting encounter registry retains five maps and fifty monsters',()=>{
 assert.equal(HUNT_MAPS.length,5);
 assert.equal(HUNT_MAPS.reduce((sum,map)=>sum+HUNT_MONSTERS[map.id].length,0),50);
 for(const map of HUNT_MAPS)for(const monster of HUNT_MONSTERS[map.id]){
  assert.ok(existsSync(new URL('../public/'+monster.image,import.meta.url)),monster.id);
 }
});
