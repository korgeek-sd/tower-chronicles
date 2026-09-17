import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {KALEON_NORMAL_POOL,KALEON_BOSS_SLOTS,kaleonFloorContent} from '../src/game/data/kaleonSpire';
import {MONSTER_GRAPHICS,backgroundFor} from '../src/game/data/graphics';
import {monsterFor} from '../src/game/engine/drops';
import {bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking';
import {contentReady} from '../src/game/engine/exploration';

test('KALEON T1: floors 1-10 share the authored normal pool and 6-10 have bosses',()=>{
 for(let floor=1;floor<=10;floor++){
  const content=kaleonFloorContent(floor);
  assert.deepEqual(content.normalPool,KALEON_NORMAL_POOL);
  const slot=KALEON_BOSS_SLOTS[floor as keyof typeof KALEON_BOSS_SLOTS];
  assert.equal(content.bossId,slot?.bossId);
  assert.equal(contentReady('kaleon',floor),true);
 }
});

test('KALEON T1: normal monster generation uses Kaleon definitions',()=>{
 assert.equal(monsterFor('kaleon',1,()=>0).definitionId,'verdant_penitent');
 assert.equal(monsterFor('kaleon',10,()=>.999).definitionId,'stigmata_reaper');
});

test('KALEON T1: boss slots resolve to playable boss monsters',()=>{
 for(const [floorText,slot] of Object.entries(KALEON_BOSS_SLOTS)){
  const floor=Number(floorText);
  assert.equal(bossIdFor('kaleon',floor),slot.bossId);
  const boss=bossMonsterFor(slot.bossId,floor);
  assert.ok(boss);
  assert.equal(boss.definitionId,slot.bossId);
  assert.equal(boss.name,slot.name);
 }
 assert.equal(bossIdFor('kaleon',5),null);
});

test('KALEON T1: every combat art asset and background is checked in',()=>{
 const graphics=MONSTER_GRAPHICS.filter(g=>g.tower==='kaleon');
 assert.equal(graphics.length,10);
 for(const graphic of graphics){
  assert.ok(graphic.image.idle);
  assert.ok(existsSync(`public/${graphic.image.idle}`),`${graphic.id}: missing ${graphic.image.idle}`);
 }
 const background=backgroundFor('kaleon',1);
 assert.equal(background,'assets/backgrounds/kaleon/t1.webp');
 assert.ok(existsSync(`public/${background}`));
});
