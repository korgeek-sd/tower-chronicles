import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_T1_FLOORS,IRON_T1_MONSTERS,IRON_T1_MONSTER_BY_ID} from '../src/game/data/ironSpire.ts';
import {monsterFor,reward} from '../src/game/engine/drops.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave} from '../src/game/engine/expedition.ts';
import {graphicFor,backgroundFor} from '../src/game/data/graphics.ts';
import {createRepository} from '../src/storage/repository.ts';
import {TOWERS} from '../src/game/data/config.ts';

const names=(floor:number)=>IRON_T1_FLOORS[floor].normalPool.map(id=>IRON_T1_MONSTER_BY_ID[id].displayName);
const spawned=(floor:number)=>[0,.34,.67,.999].map(r=>monsterFor('ore',floor,()=>r).name);
test('철맥 01: 내부 ore id를 유지하며 공식 이름과 T1 철광석을 표시한다',()=>{assert.equal(TOWERS.ore.name,'철맥의 첨탑');assert.equal(TOWERS.ore.material,'철광석');});
test('철맥 02-06: 1~9층 구간별 정식 pool만 출현한다',()=>{for(const floors of [[1,2],[3,4],[5,6],[7,8],[9]])for(const floor of floors)for(const name of spawned(floor))assert.ok(names(floor).includes(name));assert.deepEqual(IRON_T1_FLOORS[1].normalPool,['goblin_miner','cave_rat']);assert.deepEqual(IRON_T1_FLOORS[3].normalPool,['goblin_miner','mine_bat','cave_rat']);assert.deepEqual(IRON_T1_FLOORS[5].normalPool,['mine_bat','goblin_carrier','goblin_miner']);assert.deepEqual(IRON_T1_FLOORS[7].normalPool,['goblin_carrier','goblin_overseer','mine_bat']);assert.deepEqual(IRON_T1_FLOORS[9].normalPool,['goblin_overseer','goblin_carrier']);});
test('철맥 07-09: 10층 일반 pool과 광산 오우거 metadata를 분리한다',()=>{const f=IRON_T1_FLOORS[10];assert.deepEqual(f.normalPool,['goblin_overseer','goblin_carrier','mine_bat']);assert.equal(f.bossId,'mining_ogre');assert.equal(IRON_T1_MONSTER_BY_ID[f.bossId!].displayName,'광산 오우거');assert.equal(f.normalPool.includes('mining_ogre'),false);for(const name of spawned(10))assert.notEqual(name,'광산 오우거');});
test('철맥 10: 여섯 몬스터의 역할과 그래픽 ID는 데이터로만 정의된다',()=>{assert.equal(IRON_T1_MONSTERS.length,6);assert.ok(IRON_T1_MONSTERS.every(m=>m.graphicId===m.id));assert.equal(IRON_T1_MONSTERS.filter(m=>m.boss).length,1);});
test('철맥 11: 빠른 적과 강한 감독관은 기존 스탯 값의 배율로만 표현된다',()=>{const miner=monsterFor('ore',3,()=>0),bat=monsterFor('ore',3,()=>.5),overseer=monsterFor('ore',7,()=>.5);assert.ok(bat.speed>miner.speed);assert.ok(overseer.hp>monsterFor('ore',7,()=>.99).hp);});
test('철맥 12: 몬스터 그래픽과 최신 T1 배경을 안전하게 조회한다',()=>{for(const m of IRON_T1_MONSTERS){const g=graphicFor('ore',{name:m.displayName});assert.equal(g?.image.idle,`assets/monsters/iron-t1/${m.id}.png`);}assert.equal(graphicFor('ore',{name:'알 수 없는 적'}),undefined);assert.equal(backgroundFor('ore',1),'assets/backgrounds/ore/t1.png');});
test('철맥 13-14: 처치 보상은 완성 장비 없이 기존 임시 Silver·철광석 흐름을 쓴다',()=>{const s=enter(initialState(),'ore',1);const items=s.items.length;reward(s,()=>.99);assert.equal(s.silver,0);assert.equal(s.materials.ore[0],0);assert.equal(s.expedition!.loot.silver,13);assert.equal(s.expedition!.loot.materials.ore[0],2);assert.deepEqual(s.expedition!.loot.items,{});assert.equal(s.items.length,items);assert.match(s.logs.at(-1)!,/고블린 광부.*철광석.*원정 임시 보관/);const home=leave(s);assert.equal(home.silver,13);assert.equal(home.materials.ore[0],2);});
test('철맥 15: 최신 v13 저장은 migration 없이 그대로 로드한다',()=>{const state=initialState();state.notice='v13 그대로';const raw=JSON.stringify(state),writes:string[]=[];const repo=createRepository({getItem:()=>raw,setItem:(k)=>void writes.push(k)});assert.deepEqual(repo.load(),state);assert.deepEqual(writes,[]);});




