import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {makeBoxMotes,boxMotePose,BOX_PARTICLE_COUNT,BOX_PARTICLE_CELL,PLUME_WIDTH,PLUME_HEIGHT,PLUME_FRAMES,PLUME_START,PLUME_DURATION,boxPlumePose} from '../src/components/inventory/boxPixelVfx';
test('six light, six shard and four sparkle tiles have clean transparent margins',()=>{
 const png=readFileSync('public/assets/ui/shop/adventurer_box_pixel_vfx_v1.png');
 assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),32);
 const data:Buffer[]=[];for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')data.push(png.subarray(i+8,i+8+n));i+=n+12;}
 const raw=inflateSync(Buffer.concat(data));const cell=BOX_PARTICLE_CELL;
 const frames:string[]=[];
 for(let i=0;i<BOX_PARTICLE_COUNT;i++){let pixels=0,signature='';
  for(let y=0;y<cell;y++)for(let x=0;x<cell;x++){const offset=(Math.floor(i/4)*cell+y)*129+1+(i%4*cell+x)*4;const a=raw[offset+3];assert.ok(a===0||a===255);if(a)pixels++;signature+=raw.subarray(offset,offset+4).toString('hex');}
  assert.ok(pixels>0&&pixels<32);frames.push(signature);
 }
 assert.equal(new Set(frames).size,16);
});
test('burst motes launch upward, increase with grade, and always expire',()=>{
 let previous=0;
 for(let rank=0;rank<5;rank++){
  const motes=makeBoxMotes(rank);
  const burst=motes.filter(m=>m.kind==='light'||m.kind==='debris'||m.kind==='spark');
  assert.ok(burst.length>previous);previous=burst.length;
  assert.ok(burst.every(m=>m.vy<0));
  assert.ok(motes.every(m=>m.tile>=0&&m.tile<16));
  assert.ok(motes.every(m=>boxMotePose(m,0,.65,2,0)===null));
  assert.ok(burst.some(m=>boxMotePose(m,2.4,.65,2,1)!==null));
  assert.ok(motes.every(m=>boxMotePose(m,4,.65,2,1)===null));
 }
});
test('chest scene uses pooled pixel sprites rather than round effects',()=>{
 const source=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 assert.ok(source.includes('new P.Sprite(tiles[m.tile])'));
 assert.ok(source.includes('boxMotePose(m,seconds,charge,burst,p)'));
 for(const token of ['.circle(','.ellipse(','waveViews','halo.tint','cracks.alpha'])assert.ok(!source.includes(token));
});

test('mana eruption is a distinct sixteen-frame pixel atlas with grounded origin',()=>{
 const png=readFileSync('public/assets/ui/shop/adventurer_box_mana_plume_v7.png');
 assert.equal(png.readUInt32BE(16),PLUME_WIDTH*4);assert.equal(png.readUInt32BE(20),PLUME_HEIGHT*4);
 const data:Buffer[]=[];for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')data.push(png.subarray(i+8,i+8+n));i+=n+12;}
 const raw=inflateSync(Buffer.concat(data)),width=PLUME_WIDTH*4;
 assert.equal(raw.length,(width+1)*PLUME_HEIGHT*4);
 const frames=Array.from({length:PLUME_FRAMES},(_,i)=>Buffer.concat(Array.from({length:PLUME_HEIGHT},(_,y)=>{const offset=(Math.floor(i/4)*PLUME_HEIGHT+y)*(width+1)+1+i%4*PLUME_WIDTH;return raw.subarray(offset,offset+PLUME_WIDTH);})));
 assert.equal(new Set(frames.map(f=>f.toString('base64'))).size,16);
 for(const f of frames)assert.ok(f.some(p=>p>0));
 assert.equal(boxPlumePose(0,0),null);
 assert.equal(boxPlumePose(PLUME_START+.04,0)?.frame,0);
 assert.equal(boxPlumePose(PLUME_START+PLUME_DURATION+.01,4),null);
 assert.ok(boxPlumePose(.6,4)!.scaleY>boxPlumePose(.6,0)!.scaleY);
});
test('supporting particles stay narrowly centered and magical embers never fall',()=>{
 for(let grade=0;grade<5;grade++){
  const p=makeBoxMotes(grade);
  assert.equal(p.filter(m=>m.kind==='spark').length,0);
  assert.ok(p.filter(m=>m.kind==='light').every(m=>Math.abs(m.vx)<=13&&m.gravity===0));
  assert.ok(p.filter(m=>m.kind==='ember').every(m=>Math.abs(m.vx)<=7&&m.gravity===0));
  assert.ok(p.filter(m=>m.kind==='debris').length<=4);
 }
 const source=readFileSync('src/components/inventory/PixiBoxStage.tsx','utf8');
 assert.ok(source.includes('boxPlumePose(seconds-burst,rank)'));
 assert.ok(source.includes('plume.texture=core.texture=plumeFrames[surge.frame]'));
 assert.ok(!source.includes('flash.alpha'));
});
