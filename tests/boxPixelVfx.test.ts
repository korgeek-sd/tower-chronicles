import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBoxMotes,boxMotePose,BOX_PARTICLE_COUNT,BOX_PARTICLE_CELL} from '../src/components/inventory/boxPixelVfx';
test('production atlas is the exact approved 32x32 transparent sixteen-tile image',()=>{
 const png=readFileSync('public/assets/ui/shop/box_pixel_particles_16.png');
 assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);
 assert.equal(png[25],6);assert.equal(BOX_PARTICLE_COUNT,16);assert.equal(BOX_PARTICLE_CELL,8);
 assert.equal(createHash('sha256').update(png).digest('hex'),'dc842c4c0dd9e4f72f5bc1202d278071fe79fcb10a3ee9f12d302295506be345');
});
test('burst motes launch upward in staggered waves, grow with grade, and expire',()=>{
 let previous=0;const used=new Set<number>();
 for(let rank=0;rank<5;rank++){
  const motes=makeBoxMotes(rank),burst=motes.filter(m=>m.kind==='light'||m.kind==='debris'||m.kind==='spark');
  assert.ok(burst.length>previous);previous=burst.length;
  assert.ok(burst.every(m=>m.vy<0));
  assert.ok(motes.every(m=>m.tile>=0&&m.tile<16));
  assert.ok(motes.every(m=>boxMotePose(m,0,.65,2,0)===null));
  assert.ok(burst.some(m=>boxMotePose(m,2.4,.65,2,1)!==null));
  assert.ok(motes.every(m=>boxMotePose(m,4,.65,2,1)===null));
  assert.ok(motes.filter(m=>m.kind==='spark').length<=1);
  assert.ok(motes.filter(m=>m.kind==='light').every(m=>m.tile>=2&&m.tile<=7&&Math.abs(m.vx)<=35&&m.gravity===0));
  assert.ok(motes.filter(m=>m.kind==='debris').every(m=>m.tile>=8&&m.tile<=11));
  assert.ok(motes.filter(m=>m.kind==='ember').every(m=>[0,1,14,15].includes(m.tile)&&m.gravity===0));
  motes.forEach(m=>used.add(m.tile));
 }
 assert.ok(used.has(14)&&used.has(15));
});
test('the opening stage draws only chest meshes and approved pooled particle sprites',()=>{
 const source=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 assert.ok(source.includes('box_pixel_particles_16.png'));
 assert.ok(source.includes('new P.Sprite(tiles[m.tile])'));
 assert.ok(source.includes('boxMotePose(m,seconds,charge,burst,p)'));
 for(const token of ['new P.Graphics','prizeTex','prize.alpha','reward.kind','plumeURL','boxPlumePose','flash.alpha','waveViews','halo.tint','cracks.alpha'])assert.ok(!source.includes(token),token);
 const dialog=readFileSync('src/components/inventory/AdventurerBoxDialog.tsx','utf8');
 assert.ok(dialog.includes('EquipmentArt'));assert.ok(dialog.includes('feedback={reveal} onStatus='));
});
