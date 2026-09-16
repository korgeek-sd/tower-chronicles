# 탑의 기록 / Tower Chronicles — v0.1.30 인수인계 보고서

작성 기준: 로컬 작업 브랜치 `codex/v0.1.30-tower-structure`  
대상 프로젝트: `E:\ChatGPT\게임만들기\battle-redesign`

## 이번 업데이트의 목적

기존의 탑당 1~50층, 10층 단위 T1~T5 구조를 폐기하고 탑당 정확히 1~10층으로 압축했다.

신규 탑 구조는 다음과 같다.

| 층 | 구간 | PK 메타데이터 | 보스 구간 |
|---|---|---|---|
| 1~2F | 안전 구간 | `SAFE` / PK 불가 | 없음 |
| 3~5F | 일반 경쟁 구간 | `PK_ELIGIBLE` | 없음 |
| 6~10F | 보스 구간 | `PK_ELIGIBLE` | 보스 slot 존재 |

실시간 서버 PvP, localStorage 기반 가짜 PvP, 매칭 시스템은 추가하지 않았다. 현재 구현은 향후 서버 PvP가 층 메타데이터를 참조할 수 있도록 준비하는 범위다.

## 버전 및 저장 구조

- 앱 버전: `0.1.30`
- 저장 스키마: `v21`
- 메인 저장 키: `tower-record-v1` 유지
- 신규 백업 키: `tower-record-v1-before-tower-structure-v21`

스키마를 v21로 올린 이유는 단순 UI 변경이 아니라 아래 영구 저장 데이터의 의미가 바뀌었기 때문이다.

- 탑 입장권 배열: 탑별 50칸 → 10칸
- 진행도 `progress`: 최대 50 → 최대 10
- `highestReturned`: 최대 50 → 최대 10
- 진행 중 원정 및 최근 원정 결과의 floor/ticket 참조

v20 저장을 불러오면 원본 JSON은 백업 키에 한 번 보존하고 v21로 변환한다.

### v20 → v21 변환 정책

- 영구 재화, Silver, Gold, 장비, 아이템, 제작 상태, 포션, 프리셋은 삭제하거나 초기화하지 않는다.
- 각 탑의 입장권은 1~10F 구간만 유지하며, 기존 11~50F 입장권은 새 production 구조에 존재하지 않으므로 제외한다.
- `progress`, `highestReturned`, 최근 원정 결과의 floor는 최대 10으로 정규화한다.
- 진행 중 원정이 11F 이상이면 원정 HP, 원정 가방 포션, 임시 전리품, 킬 수와 장비 상태는 보존하고 floor만 10F로 정규화한다.
- 진행 중 원정의 보스 추적은 새 boss slot 구조와 불일치하지 않도록 초기화한다.
- 10F로 정규화된 진행 중 원정은 10F 일반 몬스터 및 해당 런타임 상태를 재생성한다.

## 중앙 규칙 구현 위치

### 탑 floor 및 PK 메타데이터

파일: `src/game/data/config.ts`

- `CONFIG.maxFloor = 10`
- `floorSafety(floor)`
  - 1~2F: `SAFE`
  - 3~10F: `PK_ELIGIBLE`
- `isValidTowerFloor(floor)`로 production floor 범위를 중앙 검증한다.
- 기존 `tierOf(floor)`는 탑 층과 장비 tier의 결합을 제거하기 위해 더 이상 floor band 계산에 사용하지 않는다. 현재 원정 재료 표시는 T1로 유지된다.

### 일반 몬스터 pool 및 난이도

파일: `src/game/data/ironSpire.ts`, `src/game/engine/drops.ts`

철맥의 첨탑 1~10F는 모두 아래 동일한 normal pool을 사용한다.

- `goblin_miner`
- `cave_rat`
- `mine_bat`
- `goblin_carrier`
- `goblin_overseer`

층마다 monster identity, 이름, 외형, AI, skill set을 바꾸지 않는다. `monsterFor()`가 floor 값을 기준으로 HP, 공격력, 방어력, 속도를 계산하므로 동일 ID의 런타임 스탯만 상승한다.

### 보스 구간

파일: `src/game/data/graphics.ts`, `src/game/data/ironSpire.ts`

- boss floor marker: `6, 7, 8, 9, 10`
- 6F slot: 쇄철턱 굴혈수
- 7F slot: 흑맥갑주 파쇄충
- 8F slot: 울림포식자
- 9F slot: 심층 권양감독체
- 10F slot: 철심 맥동체

중요: 현재 실제 monster definition, skill, 이미지까지 존재하는 보스는 기존 `mining_ogre` 하나뿐이다. 따라서 6~9F는 UI/구조상 boss slot으로 표시되지만 가짜 production monster를 만들지 않았고, 실제 조우 정의는 아직 연결되지 않았다. 10F의 현재 실제 보스 정의는 기존 광산 오우거(`mining_ogre`)다. 기획상 이름과 실제 정의가 다르므로, 향후 보스 콘텐츠를 추가할 때 10F 보스도 `철심 맥동체` 정의로 교체 또는 명확한 별칭 정책을 결정해야 한다.

## UI 변경

파일: `src/main.tsx`, `src/components/battle/BattleScreen.tsx`

- 탑 선택 카드의 최대 층 문구를 50층에서 10층으로 변경했다.
- floor selector는 1~10만 생성하고, 다음 층 버튼도 10F를 넘지 않는다.
- floor selector에 `SAFE · PK 불가`, `PK 가능 구간`, `보스 구간`을 표시한다.
- 전투 화면은 `/ 10F`를 표시하고, 1~2F SAFE / 3~5F PK 가능 / 6~10F 보스 구간 문구를 표시한다.
- 전투 route의 6~10F marker는 보스 slot으로 표시한다.

## 보상·이벤트·제작·장비 처리

- 다음 층 입장권 드롭은 `CONFIG.maxFloor`를 기준으로 하므로 10F에서는 11F 입장권을 만들지 않는다.
- 원정 전리품 ticket 배열과 영구 ticket 배열은 10칸이다.
- 이벤트의 `BOSS_FLOOR`와 `FLOOR_TYPE` 조건은 기존 `% 10 === 0` 대신 중앙 `isBossFloor()`를 사용한다.
- 장비 T1~T5, 제작 tier, 장비 숙련도 tier는 유지한다. 탑 floor와 장비 tier를 다시 1:1로 연결하지 않았다.
- 장비 숙련도 보상은 1~10F 범위에서 점진적으로 증가하도록 별도 floor position 계산을 사용한다.
- 현재 authored production event catalog는 비어 있으며 새 이벤트를 추가하지 않았다.
- 포션 v0.1.29 구조 및 회생 선택창은 변경하지 않았다.

## 실제 변경 파일

- `README.md`
- `package.json`, `package-lock.json`
- `src/main.tsx`
- `src/components/battle/BattleScreen.tsx`
- `src/game/types.ts`
- `src/game/data/config.ts`
- `src/game/data/graphics.ts`
- `src/game/data/ironSpire.ts`
- `src/game/engine/state.ts`
- `src/game/engine/exploration.ts`
- `src/game/engine/expedition.ts`
- `src/game/engine/drops.ts`
- `src/game/engine/loot.ts`
- `src/game/engine/gearMastery.ts`
- `src/game/events/selector.ts`
- `src/storage/repository.ts`
- `tests/tower-structure.test.ts`

## 검증 결과

- `tsc --noEmit`: 성공
- Vite production build: 성공
- `node scripts/standalone.mjs`: 성공, `play.html` 및 `assets/` 생성
- `git diff --check` (`core.autocrlf=true` 기준): 성공

자동 테스트는 실행을 시도했지만, Node 24.19.0 환경에서 `tsx`의 임시 경로 처리 중 다음 시스템 오류가 발생해 테스트 본문 전에 중단됐다.

```text
uv_os_get_passwd returned ENOMEM (not enough memory)
```

이는 테스트 assertion 실패가 아니라 현재 Windows Node 런타임의 계정/메모리 조회 단계 오류다. 환경이 정상화되면 다음 순서로 전체 회귀 검증이 필요하다.

```sh
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
git -c core.autocrlf=true diff --check
```

## 새 테스트 범위

`tests/tower-structure.test.ts`에 아래 계약을 추가했다.

1. max floor = 10
2. 1F 진입 가능, 10F는 ticket이 있을 때 진입 가능, 11F는 `INVALID`
3. 1~2F SAFE 및 3~10F PK eligibility metadata
4. 철맥 1F/5F/9F/10F normal pool 동일성
5. 동일 monster ID의 floor 1과 10 런타임 스탯 상승
6. 6~10F boss slot marker
7. v20 50층 저장의 v21 정규화와 repository load

## 현재 Git 상태

- branch: `codex/v0.1.30-tower-structure`
- 기준 커밋: `8226e2b feat: overhaul potions and add revival decision flow`
- 이번 변경은 아직 로컬 작업 트리에 있으며 커밋 및 GitHub push는 하지 않았다.
- GitHub push는 사용자의 이전 요청에 따라 대기 상태다.

## 다음 구현 권장 순서

1. 테스트 실행 환경의 Node `ENOMEM` 문제를 해결한 뒤 전체 회귀 테스트를 실행한다.
2. 철맥 6~10F 보스 5종의 실제 monster definition, AI/skill, 이미지와 조우 이벤트를 추가한다.
3. 10F의 기획 이름 `철심 맥동체`와 기존 실제 정의 `광산 오우거`의 정합성을 결정한다.
4. 다른 세 탑에도 tower-wide normal pool, floor scaling, 6~10F boss slot 구조를 실제 콘텐츠와 함께 적용한다.
5. 서버 PvP가 도입되면 `floorSafety()` 메타데이터를 서버 권위 입장·매칭 규칙에 연결한다.
