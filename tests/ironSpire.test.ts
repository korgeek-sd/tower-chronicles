import test from 'node:test';
import assert from 'node:assert/strict';
import {IRON_BOSS_REWARDS,IRON_BOSS_SLOTS,IRON_NORMAL_POOL,IRON_T1_FLOORS} from '../src/game/data/ironSpire.ts';
import {graphicFor} from '../src/game/data/graphics.ts';
import {bossIdByName,bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking.ts';
import {basicAttack} from '../src/game/engine/combat.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {initialState} from '../src/game/engine/state.ts';
import {COMBAT,TOWERS} from '../src/game/data/config.ts';

test('철맥의 첨탑은 1~10층의 일반 전투 풀을 일관되게 사용한다',()=>{
  assert.equal(TOWERS.ore.name,'철맥의 첨탑');
  assert.equal(TOWERS.ore.material,'철광석');
  for(let floor=1;floor<=10;floor++)assert.deepEqual(IRON_T1_FLOORS[floor].normalPool,IRON_NORMAL_POOL);
});

test('6~10층은 서로 다른 보스와 전투 이미지로 연결된다',()=>{
  for(const [floorText,slot] of Object.entries(IRON_BOSS_SLOTS)){
    const floor=Number(floorText),boss=bossMonsterFor(slot.bossId,floor),graphic=graphicFor('ore',{name:slot.name});
    assert.equal(bossIdFor('ore',floor),slot.bossId);
    assert.equal(bossIdByName(slot.name),slot.bossId);
    assert.equal(boss?.definitionId,slot.bossId);
    assert.equal(graphic?.image.idle,`assets/monsters/iron-bosses/${slot.bossId}.png`);
  }
  assert.equal(bossIdFor('ore',5),null);
});

test('심층 보스일수록 내구도와 보상 수치가 높아진다',()=>{
  const ids=Object.values(IRON_BOSS_SLOTS).map(slot=>slot.bossId);
  const bosses=ids.map((id,index)=>bossMonsterFor(id,index+6)!);
  for(let index=1;index<bosses.length;index++){
    assert.ok(bosses[index].hp>bosses[index-1].hp);
    assert.ok(bosses[index].attack>bosses[index-1].attack);
    assert.ok(IRON_BOSS_REWARDS[ids[index]].silverBonus>IRON_BOSS_REWARDS[ids[index-1]].silverBonus);
  }
});

test('보스 처치 보상은 원정 가방에만 누적되고 일반 처치보다 많다',()=>{
  const floor=6,id=IRON_BOSS_SLOTS[floor].bossId;
  const prepared=initialState();
  prepared.tickets.ore[floor-1]=1;
  let state=enter(prepared,'ore',floor);
  state=beginEncounter(state,()=>0,id);
  state.expedition!.monster.currentHp=1;
  const defeated=basicAttack(state,()=>.999);
  const loot=defeated.expedition!.loot,reward=IRON_BOSS_REWARDS[id];
  assert.equal(defeated.silver,0);
  assert.equal(loot.silver,COMBAT.silverBase+floor*COMBAT.silverPerFloor+reward.silverBonus);
  assert.equal(loot.materials.ore[0],COMBAT.materialAmount+reward.materialBonus);
  assert.ok(defeated.logs.some(line=>line.includes('보스 전리품')));
});
