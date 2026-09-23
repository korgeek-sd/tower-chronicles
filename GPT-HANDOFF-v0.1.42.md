# GPT HANDOFF — Tower Chronicles v0.1.42

기준 앱 버전: `0.1.42`  
저장 스키마: `v22`  
메인 저장 키: `tower-record-v1`

## 1. 이번 버전의 목적

v0.1.42는 신규 전투 규칙을 추가하는 버전이 아니다.

목표는 두 가지다.

1. 이미 엔진에 존재하는 Monster Combat 상태를 플레이어가 읽을 수 있게 한다.
2. 플레이어가 조우한 몬스터를 영구적인 `탐사 생물록` 기록으로 남긴다.

전투 계산과 Monster AI 선택 규칙은 기존 framework를 유지한다.

## 2. 실제 플레이 가능 탑

`PLAYABLE_TOWERS`:

- `ore` — 철맥의 첨탑
- `gem` — 천광의 수정탑

현재 잠김:

- `leather` — 붉은 송곳니의 성소
- `kaleon` — 칼레온의 녹빛 첨탑

붉은 송곳니의 성소는 일부 content/boss data가 repository에 존재하지만 현재 탑 선택에서는 잠겨 있다.

## 3. 천광의 수정탑

v0.1.41에서 추가된 content를 v0.1.42에서 실제 탑 선택 화면에 연결했다.

일반 몬스터 20종, 6~10F 보스 5종.

보스:

- 6F 백정갑주 거수
- 7F 만광굴절 포식자
- 8F 맥동광핵 증식체
- 9F 천면결정수
- 10F 천광심핵 모체

층별 일반 pool은 저층의 단순 pattern에서 중·고층의 DOT / Charge / Reactive / Stack 조합으로 확장된다.

전투 구현은 기존 `MonsterDefinition` 안의 다음 기능만 사용한다.

- damage
- charge
- reactive_prepare
- effect
- Shield
- DOT / HOT
- stat modifier
- stack
- SELF/TARGET HP condition
- effect presence/absence
- effect stack threshold

몬스터 ID별 engine branch는 추가하지 않았다.

천광 전용 monster/boss sprite는 아직 없다. 기존 crystal guardian art를 placeholder로 사용한다.

## 4. 전투 가독성

신규 presentation layer:

- `src/components/battle/combatIntel.ts`
- `MonsterIntentBanner.tsx`
- `CombatEffectStrip.tsx`
- `MonsterSkillPanel.tsx`

표시 항목:

- 확정된 Charge 준비 행동
- 확정된 Reactive 반격 준비
- 적 상태효과
- stack 수
- 남은 duration
- Shield 현재치 / 최대치
- monster skill 기본 cooldown / 현재 남은 cooldown

중요한 규칙:

**AI의 미래 행동은 예측해서 표시하지 않는다.**

Charge가 이미 `preparedActionId`에 들어갔거나 Reactive가 실제 prepared runtime에 들어간 경우만 경고한다.

## 5. 탐사 생물록 catalog

canonical catalog:

`src/game/data/bestiary.ts`

현재 active entry 총 45종.

- 철맥의 첨탑 10
- 붉은 송곳니의 성소 10
- 천광의 수정탑 25
- 칼레온의 녹빛 첨탑 0

legacy 광산 오우거는 active bestiary에서 제외한다.

일반 몬스터 출현층은 실제 floor pool을 읽어 계산한다.
보스 출현층은 실제 boss slot을 사용한다.

## 6. 탐사 생물록 저장

v22 신규 persisted field:

```ts
bestiary: {
  entries: Record<string, {
    encounters: number;
    defeats: number;
  }>
}
```

기록 기준은 display name이 아니라 canonical `monster.definitionId`.

QA / 미등록 monster id는 영구 기록하지 않는다.

조우 기록:

- 최초 원정 encounter
- 다음 일반 encounter
- boss encounter

처치 기록:

- 공통 `defeatMonster` path

따라서 direct hit, DOT 등 실제 처치 경로가 달라도 최종 처치 기록은 하나의 path를 사용한다.

## 7. 정보 공개 단계

일반 개체:

- UNKNOWN — 미확인
- ENCOUNTERED — 1회 이상 조우: 이름 / 외형 / 출현층
- DEFEATED — 1회 이상 처치: skill 이름
- MASTERED — 3회 이상 처치: skill 설명 / cooldown / AI 조건

보스:

- 조우 전 UNKNOWN
- 조우 후 ENCOUNTERED
- 1회 처치 시 MASTERED

UI는 `MonsterDefinition`, `aiRules`, `EFFECTS`에서 실제 데이터를 읽는다.
스킬 설명을 별도 UI catalog에 중복 작성하지 않는다.

## 8. 저장 migration

현재 schema: v22.

v21 → v22:

- `bestiary` 빈 state 추가
- 진행 중인 canonical monster encounter가 있으면 해당 id의 encounter 1회 보존
- 원본 save를 `tower-record-v1-before-bestiary-v22`에 backup
- migration 후 v22 validation

기존 main save key는 변경하지 않는다.

## 9. UI

거점에 `탐사 생물록` 진입 버튼이 있다.

생물록은:

- 탑별 tab
- 전체 발견 수
- 탑별 발견 수
- 미확인 silhouette
- 조우/처치 수
- 단계별 skill information
- 칼레온 준비 중 상태

를 표시한다.

하단 navigation slot은 추가하지 않았다.

## 10. 주요 파일

- `src/game/data/crystalTower.ts`
- `src/game/data/crystalCombat.ts`
- `src/game/data/bestiary.ts`
- `src/game/engine/bestiary.ts`
- `src/components/battle/combatIntel.ts`
- `src/components/bestiary/BestiaryScreen.tsx`
- `src/components/bestiary/presentation.ts`
- `src/storage/repository.ts`

## 11. 자동 검증

관련 regression:

- Crystal Tower content / boss mapping
- MonsterDefinition validation
- Combat Intel
- Bestiary catalog
- Bestiary progress
- v21 → v22 migration
- Bestiary disclosure UI
- save export/import
- existing combat / market / crafting / job regressions

Release gate:

```sh
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
```

GitHub CI와 Pages workflow 결과를 release merge 후 확인한다.

## 12. 다음 작업 후보

현재 v0.1.42 범위에는 포함하지 않는다.

- 천광 전용 20 일반 + 5 boss art 교체
- 붉은 송곳니의 성소 일반 pool 20종 확장
- 칼레온의 녹빛 첨탑 실제 content 설계/구현
- 탑별 고유 drop / boss reward
- server/account/DB 전환
