# GPT HANDOFF — Tower Chronicles v0.1.44

기준 앱 버전: `0.1.44`  
저장 스키마: `v22`  
메인 저장 키: `tower-record-v1`

## 1. 이번 버전 목적

v0.1.44는 **붉은 송곳니의 성소 실제 개방 + 일반 몬스터 전투 패스** 업데이트다.

핵심 목표:

1. 붉은 송곳니의 성소를 탑 선택에서 실제 플레이 가능하게 개방
2. 기존 일반 몬스터 5종에 production MonsterDefinition 연결
3. 기존 6~10F 보스 콘텐츠와 일반 전투를 하나의 실제 플레이 루프로 연결
4. 기존 생물록 10종과 탑 진행/입장권/보스 추적 구조를 그대로 활용
5. 저장 스키마를 늘리지 않고 v22 호환 유지

## 2. 플레이 가능 탑

`PLAYABLE_TOWERS`:

```ts
['ore','leather','gem']
```

현재 플레이 가능:

- 철맥의 첨탑
- 붉은 송곳니의 성소
- 천광의 수정탑

잠김:

- 칼레온의 녹빛 첨탑

## 3. 붉은 송곳니 일반 몬스터

1~10F는 동일한 5종 normal pool을 사용한다. 층에 따라 runtime stat만 증가하며 monster id, 외형, skill set, AI identity는 바뀌지 않는다.

### 황야 멧돼지
- 거친가죽 버티기
  - defense_up
- 황야 돌진
  - Charge
  - multiplier 1.75

### 가시 자칼
- 가시교상
  - damage
  - fang_wound 적용
- 피냄새 추격
  - fang_wound 대상 우선
  - multiplier 1.45

### 썩은날 독수리
- 흙먼지 날갯짓
  - weaken 적용
- 부리연격
  - 2 hits
  - hit multiplier .72

### 가죽 갉는 하이에나
- 가죽뜯기
  - fang_wound 누적
- 포식흥분
  - HP 55% 미만에서 attack_up
- 찢는교상
  - fang_wound 2 stacks 이상에서 우선
  - multiplier 1.6

### 무리 선봉
- 선봉 반격 자세
  - DIRECT_HIT_RECEIVED Reactive
- 선봉 반격
  - multiplier .68
- 선봉 포효
  - attack_up
- 송곳니 돌파
  - Charge
  - multiplier 1.9

신규 effect type은 추가하지 않았다.

## 4. 붉은 송곳니 보스

기존 production 보스 5종을 그대로 사용한다.

- 6F 핏갈기 추적자
- 7F 붉은턱 가죽포식자
- 8F 송곳니 무리어미
- 9F 성소 발톱주교
- 10F 적아의 주인

boss ids:

- bloodmane_tracker
- redjaw_hide_eater
- fang_pack_matriarch
- sanctuary_talon_bishop
- lord_of_red_fang

## 5. 생물록

붉은 송곳니 active catalog:

- 일반 5
- 보스 5
- 총 10

전체 active catalog는 45종을 유지한다.

## 6. 코드 구조

Data:
- `src/game/data/redFang.ts`
- `src/game/data/redCombat.ts`

Engine integration:
- `src/game/engine/monsterAi.ts`
- `src/game/engine/drops.ts`
- `src/game/engine/bossTracking.ts`

UI access:
- `src/game/data/config.ts`의 `PLAYABLE_TOWERS`
- `src/main.tsx`는 data-driven tower registry를 사용하므로 별도 leather 하드코딩 없음

## 7. 천광 보스 이름 정정

6F 보스의 정식 명칭은:

**백정갑주 균열거수**

기존 잘못된 표시명 `백정갑주 거수`를 production slot, MonsterDefinition, 테스트에서 수정했다.

boss id:
`white_crystal_armor_behemoth`

id와 전투 패턴은 바뀌지 않았다.

## 8. 저장

`GameState.version = 22` 유지.

이유:
- leather tower state는 기존부터 존재
- ticket/progress/material/bestiary 구조도 기존부터 존재
- 신규 persisted field 없음
- Red Fang monster ids와 boss ids도 기존 catalog를 사용

v22 → v23 migration은 만들지 않는다.

## 9. v0.1.44 PR sequence

- PR #17 — Red Fang Sanctuary access
- PR #18 — Red Fang regular monster combat pass
- PR #19 — Crystal 6F canonical boss name fix
- PR #20 — v0.1.44 release integration

## 10. 회귀 검증

반드시 유지:

- PLAYABLE_TOWERS = ore / leather / gem
- kaleon locked
- Red Fang 1~10F 공통 normal pool
- Red Fang regular definition 5개 모두 validation clean
- regular encounter canonical runtime id
- fang_wound / weaken / multi-hit / Reactive / Charge 작동
- 6~10F Red Fang boss mapping 유지
- leather bestiary 10종 유지
- save schema v22 유지
- 백정갑주 균열거수 canonical 표시명 유지

Release gate:

```sh
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
```
