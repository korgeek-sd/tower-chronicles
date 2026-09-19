# 탑의 기록 / Tower Chronicles — v0.1.32 탐험 이벤트 인수인계

작성 기준 브랜치: `codex/v0.1.32-exploration-events`  
기준 앱 버전: `0.1.32`  
저장 스키마: `v21` 유지

## 현재 목표와 상태

v0.1.32에서 production 탐험 이벤트 시스템의 첫 실제 콘텐츠 묶음을 구축했다. 공통 이벤트 6종과 철맥의 첨탑 전용 이벤트 5종을 production 선택 풀에 연결했고, 기존 이벤트 엔진·보스 조우·원정 임시 보상·사망 손실·저장 런타임 규칙은 유지한다.

기존 테스트/도구가 사용하던 `EVENT_CATALOG`은 공통 이벤트 6종의 호환 alias로 유지한다. 실제 production 선택에는 `PRODUCTION_EVENT_CATALOG = COMMON_EVENTS + ORE_EVENTS`를 사용한다.

## 공통 이벤트 6종

1. `sheltered_rest_niche` / 바람 막힌 휴식처
   - HP 85% 미만에서만 후보
   - 최대 HP의 25% 회복
2. `sealed_emergency_cache` / 봉인된 비상 보급함
   - 하급 회복 포션 1개를 원정 가방에 추가
3. `unclaimed_route_satchel` / 회수되지 않은 표식 주머니
   - 현재 탑·현재 티어 재료 2개 + Silver 10
4. `collapsed_haulway` / 무너진 운반로
   - 일반층 전용 위험 선택
   - 75% 화물 회수 / 25% 고정 피해 14
5. `surveyor_dead_drop` / 측량사의 비밀 보관함
   - Silver 22 또는 현재 탑 재료 3개 중 선택
6. `abandoned_guard_post` / 버려진 방호 거점
   - `defense_up`을 EXPEDITION scope로 적용

## 철맥의 첨탑 전용 이벤트 5종

모든 이벤트는 `towerIds:['ore']`를 사용하므로 다른 탑에서는 production 후보가 되지 않는다.

1. `ore_exposed_vein` / 드러난 철맥
   - 안전 채굴: 현재 티어 철맥 재료 3개
   - 깊은 채굴: 2/3 확률 재료 6 + Silver 12, 1/3 확률 최대 HP 12% 피해(최소 10)
2. `ore_derailed_cart` / 탈선한 광차
   - 일반층 전용
   - 회수 성공: 재료 4 + Silver 15
   - 실패: 최대 HP 10% 피해(최소 8)
3. `ore_clear_air_pocket` / 환기구의 맑은 공기
   - HP 90% 미만에서만 후보
   - 최대 HP 15% 회복 + `poison` 제거
4. `ore_stranded_surveyor` / 고립된 측량 탐사자
   - 하급 회복 포션 1개가 있어야 교환 선택 가능
   - 포션 1개 소비 → 현재 티어 재료 5 + Silver 25
5. `ore_reinforced_workbench` / 버려진 정비 작업대
   - 무기 정비: `attack_up` EXPEDITION scope
   - 방어구 정비: `defense_up` EXPEDITION scope

## 이벤트 데이터/효과 확장

v0.1.32 콘텐츠에서 다음 범용 계약을 실제 production 데이터에 사용한다.

- `TAKE_DAMAGE_RATIO`
- `HAS_POTION` / `MISSING_POTION`
- `CONSUME_POTION`
- `REMOVE_EFFECT`
- tower-specific `towerIds`

위 효과들은 기존 원정 상태만 수정하며 persisted root field를 새로 만들지 않는다. save schema는 계속 v21이다.

## 원정 보상 규칙

- 이벤트에서 얻는 Silver·재료는 기존 `expedition.loot` 임시 보관 규칙을 따른다.
- 이벤트에서 획득하거나 소비하는 회복 포션은 원정 가방을 기준으로 한다.
- 안전 귀환 시 임시 보상이 영구 재산으로 확정된다.
- 사망 시 이번 원정 임시 보상은 확정되지 않는다.
- 위험 이벤트의 outcome은 이벤트 출현 시 저장된 `randomValue`로 결정하므로 새로고침으로 재추첨할 수 없다.

## 이벤트 UI 패스

`src/components/events/EventScreen.tsx`와 `events.css`를 모바일 세로 화면 기준으로 정리했다.

- 이벤트 타입별 배지: 회복 / 보급 / 발견 / 위험 / 정비 / 특수 / 보스
- 공통 탐사 / 특정 탑 전용 / 보스 조우 scope 표시
- 이벤트 선택지를 아이콘 + 제목 + 설명 + 조건 상태가 포함된 단일 카드로 표시
- 보상 미리보기를 2열 카드로 표시하고 매우 좁은 화면에서는 1열로 전환
- 결과 화면에서 선택한 행동과 실제 결과 로그를 구분해서 표시
- 기존 접근성/브라우저 QA 계약인 `탐사 결과` heading 유지
- 전용 `imageAssetKey`가 있으면 해당 이미지를 우선 사용
- 전용 이벤트 그림이 없으면 `backgroundFor(tower,floor)`의 현재 탑 배경을 ambient art로 사용
- 배경 로딩도 실패하면 이벤트 타입 아이콘 기반 placeholder로 최종 fallback

따라서 철맥의 첨탑 전용 일러스트가 아직 없어도 production 화면에서는 철맥 배경을 사용한다. 추후 이벤트 전용 이미지를 제작해 `imageAssetKey`와 `EVENT_ASSETS`만 연결하면 UI 변경 없이 자동 교체된다.

## 자동 검증

현재 이벤트 관련 회귀 검증은 다음을 포함한다.

- 공통 catalog 6종 호환 계약
- 전체 production catalog 11종 ID 고유성 및 authoring validation
- 철맥 전용 이벤트가 `ore` 외 탑에서 후보가 되지 않음
- 철맥 광맥 안전/위험 분기와 persisted outcome
- 포션 조건 및 정확히 1개 소비
- 환기구 회복 + 독 제거
- 작업대 EXPEDITION scope 효과
- 기존 공통 위험 이벤트 고정 피해 14 회귀
- 전체 기존 전투/보스/저장 테스트

CI는 `npm test` → typecheck → production build → standalone build 순으로 검증한다.

## 다음 작업 권장 순서

1. 철맥 전용 이벤트 실제 모바일 시각 QA
2. 철맥 이벤트별 전용 일러스트 제작 및 `EVENT_ASSETS` 연결
3. 공통 6종 + 철맥 5종의 발생률·보상량·피해량 플레이 밸런스 조정
4. 붉은 송곳니 성소 전용 탐험 이벤트 catalog 추가
5. 이후 수정궁/칼레온 계열 탑 전용 이벤트 확장
