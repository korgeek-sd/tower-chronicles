import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_BOSS_SLOTS,IRON_NORMAL_POOL,IRON_T1_FLOORS,IRON_T1_MONSTERS,IRON_T1_MONSTER_BY_ID} from '../src/game/data/ironSpire.ts';
import {monsterFor,reward} from '../src/game/engine/drops.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter,leave} from '../src/game/engine/expedition.ts';
import {graphicFor,backgroundFor} from '../src/game/data/graphics.ts';
import {bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking.ts';
import {createRepository} from '../src/storage/repository.ts';
import {TOWERS} from '../src/game/data/config.ts';

const spawned=(floor:number)=>[0,.2,.4,.6,.8,.999].map(r=>monsterFor('ore',floor,()=>r));

test('철맥 01: 내부 ore id를 유지하며 공식 이름과 철광석 자원을 표시한다',()=>{
 assert.equal(TOWERS.ore.name,'철맥의 첨탑');
 assert.equal(TOWERS.ore.material,'철광석');
});

test('철맥 02: 1~10층은 동일한 일반 몬스터 5종 pool을 사용한다',()=>{
 assert.deepEqual(IRON_NORMAL_POOL,['goblin_miner','cave_rat','mine_bat','goblin_carrier','goblin_overseer']);
 for(let floor=1;floor<=10;floor++)assert.deepEqual(IRON_T1_FLOORS[floor].normalPool,IRON_NORMAL_POOL);
 for(const floor of [1,3,6,10])for(const monster of spawned(floor))assert.ok(IRON_NORMAL_POOL.includes(monster.definitionId!));
});

test('철맥 03: 일반 몬스터 identity는 유지되고 층에 따라 runtime 스탯만 상승한다',()=>{
 const one=monsterFor('ore',1,()=>0),ten=monsterFor('ore',10,()=>0);
 assert.equal(one.definitionId,'goblin_miner');
 assert.equal(ten.definitionId,one.definitionId);
 assert.equal(ten.name,one.name);
 assert.ok(ten.hp>one.hp);
 assert.ok(ten.attack>one.attack);
 assert.ok(ten.defense>one.defense);
});

test('철맥 04: 6~10층 boss slot은 다섯 신규 보스로 고정되고 일반 pool과 분리된다',()=>{
 const expected=[
  [6,'iron_maw_burrower','쇄철턱 굴혈수'],
  [7,'black_vein_armor_breaker','흑맥갑주 파쇄충'],
  [8,'echo_devourer','울림포식자'],
  [9,'deep_hoist_overseer','심층 권양감독체'],
  [10,'iron_core_pulsator','철심 맥동체']
 ] as const;
 for(const [floor,id,name] of expected){
  assert.equal(IRON_T1_FLOORS[floor].bossId,id);
  assert.equal(bossIdFor('ore',floor),id);
  assert.equal(bossMonsterFor(id,floor)?.name,name);
  assert.equal(IRON_T1_FLOORS[floor].normalPool.includes(id),false);
 }
 assert.equal(bossIdFor('ore',5),null);
});

test('철맥 05: legacy 광산 오우거는 호환 데이터로 남지만 현재 6~10F boss slot에는 사용되지 않는다',()=>{
 const legacy=IRON_T1_MONSTER_BY_ID.mining_ogre;
 assert.equal(legacy?.displayName,'광산 오우거');
 assert.equal(legacy?.boss,true);
 assert.equal(Object.values(IRON_BOSS_SLOTS).some(slot=>slot.bossId==='mining_ogre'),false);
 assert.equal(Object.values(IRON_T1_FLOORS).some(floor=>floor.bossId==='mining_ogre'),false);
});

test('철맥 06: 일반 몬스터와 보스 그래픽 경로를 canonical id로 조회한다',()=>{
 for(const id of IRON_NORMAL_POOL){
  const monster=IRON_T1_MONSTER_BY_ID[id];
  const graphic=graphicFor('ore',{name:monster.displayName});
  assert.equal(graphic?.image.idle,`assets/monsters/iron-t1/${id}.png`);
 }
 for(const slot of Object.values(IRON_BOSS_SLOTS)){
  const graphic=graphicFor('ore',{name:slot.name});
  assert.equal(graphic?.image.idle,`assets/monsters/iron-bosses/${slot.bossId}.png`);
 }
 assert.equal(graphicFor('ore',{name:'알 수 없는 적'}),undefined);
 assert.equal(backgroundFor('ore',10),'assets/backgrounds/ore/t1.png');
});

test('철맥 07: legacy 몬스터 카탈로그는 5 normal + 1 compatibility boss 구성을 유지한다',()=>{
 assert.equal(IRON_T1_MONSTERS.filter(monster=>!monster.boss).length,5);
 assert.equal(IRON_T1_MONSTERS.filter(monster=>monster.boss).length,1);
 assert.ok(IRON_T1_MONSTERS.every(monster=>monster.graphicId===monster.id));
});

test('철맥 08: 처치 보상은 원정 임시 Silver·철광석에 적립되고 생환 시 확정된다',()=>{
 const s=enter(initialState(),'ore',1),items=s.items.length;
 reward(s,()=>.99);
 assert.equal(s.silver,0);
 assert.equal(s.materials.ore[0],0);
 assert.equal(s.expedition!.loot.silver,13);
 assert.equal(s.expedition!.loot.materials.ore[0],2);
 assert.deepEqual(s.expedition!.loot.items,{});
 assert.equal(s.items.length,items);
 assert.match(s.logs.at(-1)!,/철광석.*원정 임시 보관/);
 const home=leave(s);
 assert.equal(home.silver,13);
 assert.equal(home.materials.ore[0],2);
});

test('철맥 09: 현재 v21 저장은 migration 없이 그대로 로드한다',()=>{
 const state=initialState();state.notice='v21 그대로';
 const raw=JSON.stringify(state),writes:string[]=[];
 const repo=createRepository({getItem:()=>raw,setItem:(key)=>void writes.push(key)});
 assert.deepEqual(repo.load(),state);
 assert.deepEqual(writes,[]);
});
