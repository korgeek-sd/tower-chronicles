import test from 'node:test';
import assert from 'node:assert/strict';
import type {GameState} from '../src/game/types.ts';
import {TOWERS} from '../src/game/data/config.ts';
import {CRYSTAL_NORMAL_POOL,CRYSTAL_T1_FLOORS,CRYSTAL_T1_MONSTER_BY_ID,CRYSTAL_BOSS_SLOTS,CRYSTAL_T1_MONSTERS} from '../src/game/data/crystalTower.ts';
import {CRYSTAL_MONSTER_DEFINITIONS} from '../src/game/data/crystalCombat.ts';
import {monsterFor} from '../src/game/engine/drops.ts';
import {bossIdFor,bossMonsterFor} from '../src/game/engine/bossTracking.ts';
import {monsterDefinitionById,validateMonsterDefinition} from '../src/game/engine/monsterAi.ts';
import {validateEffectDefinitions,activeShield,effectStacks} from '../src/game/engine/effects.ts';
import {initialState} from '../src/game/engine/state.ts';
import {enter} from '../src/game/engine/expedition.ts';
import {beginEncounter} from '../src/game/events/service.ts';
import {basicAttack,passPlayerTurn,resolveMonsterTurn} from '../src/game/engine/combat.ts';
import {graphicFor,backgroundFor} from '../src/game/data/graphics.ts';

const noEvent=()=>.99;

function bossState(floor:number):GameState {
 const base=initialState();
 base.tickets.gem[floor-1]=1;
 const entered=enter(base,'gem',floor),bossId=bossIdFor('gem',floor);
 assert.ok(entered.expedition);
 assert.ok(bossId);
 return beginEncounter(entered,noEvent,bossId);
}

test('CRYSTAL 01: 천광의 수정탑은 보석 자원과 20종 일반 몬스터 카탈로그를 사용한다',()=>{
 assert.equal(TOWERS.gem.name,'천광의 수정탑');
 assert.equal(TOWERS.gem.material,'보석');
 assert.equal(CRYSTAL_T1_MONSTERS.length,20);
 assert.equal(CRYSTAL_NORMAL_POOL.length,20);
 assert.equal(new Set(CRYSTAL_NORMAL_POOL).size,20);
});

test('CRYSTAL 02: 층이 오를수록 복합 패턴 몬스터가 단계적으로 풀에 추가된다',()=>{
 assert.deepEqual(CRYSTAL_T1_FLOORS[1].normalPool,CRYSTAL_NORMAL_POOL.slice(0,5));
 assert.ok(CRYSTAL_T1_FLOORS[3].normalPool.includes('crystal_needle_centipede'));
 assert.ok(CRYSTAL_T1_FLOORS[5].normalPool.includes('crystal_scale_serpent'));
 assert.ok(CRYSTAL_T1_FLOORS[8].normalPool.includes('fracture_claw_hunter'));
 assert.ok(CRYSTAL_T1_FLOORS[10].normalPool.includes('celestial_crystal_brute'));
 for(let floor=1;floor<=10;floor++)for(const id of CRYSTAL_T1_FLOORS[floor].normalPool)assert.ok(CRYSTAL_NORMAL_POOL.includes(id));
});

test('CRYSTAL 03: 일반 몬스터 20종과 보스 5종 정의가 기존 Monster Combat Framework 검증을 통과한다',()=>{
 assert.equal(CRYSTAL_MONSTER_DEFINITIONS.length,25);
 assert.deepEqual(validateEffectDefinitions(),[]);
 for(const definition of CRYSTAL_MONSTER_DEFINITIONS){
  assert.equal(monsterDefinitionById(definition.id)?.name,definition.name);
  assert.deepEqual(validateMonsterDefinition(definition),[]);
  for(const skill of definition.skills??[])assert.ok(['damage','charge','reactive_prepare','effect'].includes(skill.kind));
 }
});

test('CRYSTAL 04: 6~10층 보스 슬롯은 정식 보스 5종에 연결된다',()=>{
 const expected=[
  [6,'white_crystal_armor_behemoth','백정갑주 균열거수'],
  [7,'myriad_refraction_predator','만광굴절 포식자'],
  [8,'pulsing_crystal_core_growth','맥동광핵 증식체'],
  [9,'thousand_face_crystal_beast','천면결정수'],
  [10,'celestial_core_matrix','천광심핵 모체']
 ] as const;
 for(const [floor,id,name] of expected){
  assert.equal(CRYSTAL_BOSS_SLOTS[floor].bossId,id);
  assert.equal(bossIdFor('gem',floor),id);
  assert.equal(bossMonsterFor(id,floor)?.name,name);
 }
 assert.equal(bossIdFor('gem',5),null);
});

test('CRYSTAL 05: 일반 조우는 층별 pool에서 실제 definition id와 스탯을 생성한다',()=>{
 const low=monsterFor('gem',1,()=>0);
 const high=monsterFor('gem',10,()=>.999);
 assert.equal(low.definitionId,'quartz_carapace_beetle');
 assert.ok(CRYSTAL_T1_FLOORS[10].normalPool.includes(high.definitionId!));
 assert.equal(low.name,CRYSTAL_T1_MONSTER_BY_ID[low.definitionId!].displayName);
 assert.ok(high.hp>low.hp);
 assert.ok(high.attack>low.attack);
});

test('CRYSTAL 06: 석영등갑충은 기존 SHIELD 효과 엔진만으로 결정막을 사용한다',()=>{
 let s=enter(initialState(),'gem',1);
 assert.equal(s.expedition!.monster.definitionId,'quartz_carapace_beetle');
 s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 const shield=activeShield(s.expedition!,'monster');
 assert.equal(shield?.effectId,'crystal_shell');
 assert.equal(shield?.currentShield,32);
});

test('CRYSTAL 07: 수정비늘 뱀은 기존 STACK 상태와 AI 조건으로 균열을 누적하고 파쇄교상을 선택한다',()=>{
 const base=initialState();base.tickets.gem[4]=1;
 let s=enter(base,'gem',5);
 s=beginEncounter(s,()=>.999);
 assert.equal(s.expedition!.monster.definitionId,'crystal_scale_serpent');
 s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'crystal_fracture'),1);
 s=passPlayerTurn(s,noEvent);
 s=resolveMonsterTurn(s);
 assert.equal(effectStacks(s.expedition!.playerEffects,'crystal_fracture'),2);
 s=passPlayerTurn(s,noEvent);
 const before=s.expedition!.hp;
 s=resolveMonsterTurn(s);
 assert.ok(s.expedition!.hp<before);
 assert.equal(effectStacks(s.expedition!.playerEffects,'crystal_fracture'),2);
});

test('CRYSTAL 08: 만광굴절 포식자는 기존 Reactive Prepared로 직접 피격 1회에 반격한다',()=>{
 let s=bossState(7);
 s.expedition!.phase='MONSTER_TURN';
 s=resolveMonsterTurn(s);
 assert.equal(s.expedition!.reactivePrepared.monster?.prepareSkillId,'myriad_stance');
 const hp=s.expedition!.hp;
 s=basicAttack(s,noEvent);
 assert.equal(s.expedition!.reactivePrepared.monster,null);
 assert.ok(s.expedition!.hp<hp);
});

test('CRYSTAL 09: 전용 아트가 오기 전에는 기존 수정 파수꾼 이미지를 placeholder로 사용한다',()=>{
 const normal=graphicFor('gem',{name:'석영등갑충'});
 const boss=graphicFor('gem',{name:'천광심핵 모체'});
 assert.equal(normal?.image.idle,'assets/monsters/gem/crystal_guardian_idle.png');
 assert.equal(boss?.image.idle,'assets/monsters/gem/crystal_guardian_idle.png');
 assert.equal(backgroundFor('gem',10),'assets/backgrounds/gem/t1.png');
});
