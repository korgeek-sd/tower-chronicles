import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../src/game/engine/state.ts';
import {reward} from '../src/game/engine/drops.ts';
import {rollIronEnhancementStoneDrop} from '../src/game/data/equipmentDrops.ts';

const sequence=(...values:number[])=>{let i=0;return()=>values[Math.min(i++,values.length-1)]??0;};

test('STONE DROP 01: Iron normal floor chances rise from 12% to 38%',()=>{
 assert.equal(rollIronEnhancementStoneDrop(1,false,sequence(.119,0)),1);
 assert.equal(rollIronEnhancementStoneDrop(1,false,sequence(.12,0)),0);
 assert.equal(rollIronEnhancementStoneDrop(10,false,sequence(.379,.99)),3);
 assert.equal(rollIronEnhancementStoneDrop(10,false,sequence(.38,.99)),0);
});

test('STONE DROP 02: normal drop quantity scales by floor without exceeding three stones',()=>{
 assert.equal(rollIronEnhancementStoneDrop(4,false,sequence(0,.99)),1);
 assert.equal(rollIronEnhancementStoneDrop(7,false,sequence(0,.29)),1);
 assert.equal(rollIronEnhancementStoneDrop(7,false,sequence(0,.30)),2);
 assert.equal(rollIronEnhancementStoneDrop(8,false,sequence(0,.49)),1);
 assert.equal(rollIronEnhancementStoneDrop(8,false,sequence(0,.50)),2);
 assert.equal(rollIronEnhancementStoneDrop(9,false,sequence(0,.84)),2);
 assert.equal(rollIronEnhancementStoneDrop(9,false,sequence(0,.85)),3);
});

test('STONE DROP 03: Iron bosses 6F through 10F guarantee fixed enhancement stones',()=>{
 assert.deepEqual([6,7,8,9,10].map(floor=>rollIronEnhancementStoneDrop(floor,true,()=>.999)),[3,4,5,7,10]);
});

test('STONE DROP 04: combat reward stores stones only in expedition temporary loot',()=>{
 const s=initialState();
 s.expedition={
  tower:'ore',floor:1,kills:0,
  loot:{silver:0,materials:{ore:[0,0,0,0,0],leather:[0,0,0,0,0],gem:[0,0,0,0,0],kaleon:[0,0,0,0,0]},tickets:{ore:Array(10).fill(0),leather:Array(10).fill(0),gem:Array(10).fill(0),kaleon:Array(10).fill(0)},skillBooks:{},items:{},equipment:[]},
  events:{activeBossId:null},
  equipment:{...s.equipped},
  monster:{definitionId:'goblin_miner'},
 } as any;
 reward(s,()=>.99,()=>.99,sequence(.01,0));
 assert.equal(s.expedition!.loot.items.enhancement_stone,1);
 assert.equal(s.lootItems.enhancement_stone??0,0);
 assert.match(s.logs.at(-1)??'',/강화석/);
});
