import test from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {HUNT_MAPS,initialHuntingState,resolveHunt} from '../src/game/hunting/model';
import {HuntingScreen} from '../src/components/hunting/HuntingScreen';import{initialState}from'../src/game/engine/state';
test('five regions include both ends of confirmed integer silver ranges and defeat pays zero',()=>{
 const ranges=[[1000,1200],[1600,2000],[2500,3100],[3800,4600],[5500,6500]];
 for(const [i,map]of HUNT_MAPS.entries()){
  const run=(rng:number,attack=10000)=>resolveHunt(initialHuntingState(0),map.id,{hp:10000,attack,defense:10000},attack?['heavy']:[],0,()=>rng).result;
  assert.equal(run(0).silver,ranges[i][0]);assert.equal(run(.999999).silver,ranges[i][1]);
  for(const rng of [.1,.5,.9]){const r=run(rng);assert.ok(Number.isInteger(r.silver)&&r.silver>=ranges[i][0]&&r.silver<=ranges[i][1]);}
  assert.equal(run(.5,0).silver,0);
 }
});
test('region preview shows range rather than guaranteed silver amount',()=>{
 const html=renderToStaticMarkup(React.createElement(HuntingScreen,{game:initialState(),hunting:initialHuntingState(0),now:0,busy:false,onHunt:()=>{},onSettings:()=>{}}));
 assert.ok(html.includes('1,000~1,200'));
});
