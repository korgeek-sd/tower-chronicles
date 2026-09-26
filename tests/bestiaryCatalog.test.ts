import test from 'node:test';
import assert from 'node:assert/strict';
import {BESTIARY_ENTRIES,bestiaryEntriesForTower,bestiaryEntryById,bestiaryFloorLabel} from '../src/game/data/bestiary.ts';
import {graphicFor} from '../src/game/data/graphics.ts';

test('BESTIARY CATALOG 01: active catalog contains all authored entries across four towers',()=>{
 assert.equal(BESTIARY_ENTRIES.length,55);
 assert.equal(new Set(BESTIARY_ENTRIES.map(entry=>entry.id)).size,55);
 assert.equal(bestiaryEntriesForTower('ore').length,10);
 assert.equal(bestiaryEntriesForTower('leather').length,10);
 assert.equal(bestiaryEntriesForTower('gem').length,25);
 assert.equal(bestiaryEntriesForTower('kaleon').length,10);
});

test('BESTIARY CATALOG 02: legacy mining ogre is not exposed as an active bestiary entry',()=>{
 assert.equal(bestiaryEntryById('mining_ogre'),undefined);
});

test('BESTIARY CATALOG 03: boss slots map to exact authored floors',()=>{
 const bosses=BESTIARY_ENTRIES.filter(entry=>entry.boss);
 assert.equal(bosses.length,20);
 for(const entry of bosses){
  assert.equal(entry.floorMin,entry.floorMax);
  assert.ok(entry.floorMin>=6&&entry.floorMin<=10);
 }
 assert.equal(bestiaryEntryById('celestial_core_matrix')?.floorMin,10);
 assert.equal(bestiaryFloorLabel(bestiaryEntryById('celestial_core_matrix')!),'10F');
});

test('BESTIARY CATALOG 04: Crystal Tower normal ranges are derived from real floor pools',()=>{
 const quartz=bestiaryEntryById('quartz_carapace_beetle')!;
 const serpent=bestiaryEntryById('crystal_scale_serpent')!;
 const brute=bestiaryEntryById('celestial_crystal_brute')!;
 assert.deepEqual([quartz.floorMin,quartz.floorMax],[1,5]);
 assert.deepEqual([serpent.floorMin,serpent.floorMax],[5,10]);
 assert.deepEqual([brute.floorMin,brute.floorMax],[9,10]);
 assert.equal(bestiaryFloorLabel(brute),'9F ~ 10F');
});

test('BESTIARY CATALOG 05: every active entry resolves a graphics record even when art is a placeholder',()=>{
 for(const entry of BESTIARY_ENTRIES)assert.ok(graphicFor(entry.tower,{name:entry.name}),entry.tower+'/'+entry.name);
});
