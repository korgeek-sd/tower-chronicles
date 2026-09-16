# 탑의 기록 / Tower Chronicles — v0.1.32 탐험 이벤트 인수인계

작성 기준 브랜치: `codex/v0.1.32-exploration-events`  
기준 앱 버전: `0.1.32`  
저장 스키마: `v21` 유지

## 목표

v0.1.31까지 비어 있던 production `EVENT_CATALOG`에 모든 탑에서 재사용할 수 있는 공통 탐험 이벤트를 먼저 공급한다. 기존 이벤트 엔진, UI, 저장 런타임과 보스 조우 흐름은 유지한다.

## 추가한 공통 이벤트

1. `sheltered_rest_niche` / 바람 막힌 휴식처
   - HP 85% 미만에서만 후보
   - 최대 HP의 25% 회복
2. `sealed_emergency_cache` / 봉인된 비상 보급함
   - 하급 회복 포션 1개를 원정 가방에 추가
3. `unclaimed_route_satchel` / 회수되지 않은 표식 주머니
   - 현재 탑·현재 티어 재료 2개와 Silver 10
4. `collapsed_haulway` / 무너진 운반로
   - 일반층 전용 위험 선택
   - 75% 화물 회수, 25% 고정 피해 14
5. `surveyor_dead_drop` / 측량사의 비밀 보관함
   - Silver 22 또는 현재 탑 재료 3개 중 선택
6. `abandoned_guard_post` / 버려진 방호 거점
   - `defense_up`을 EXPEDITION scope로 적용

모든 보상은 기존 원정 임시 보관 및 생환 정산 규칙을 따른다. 사망하면 임시 보상은 확정되지 않는다.

## 구현 원칙

- 모든 이벤트는 `towerIds`를 생략해 전 탑 공통으로 사용한다.
- DEV fixture는 production catalog에 섞지 않는다.
- 보스 이벤트는 기존 별도 pool을 유지한다.
- 위험 결과는 이벤트 출현 시 저장된 `randomValue`를 사용하므로 새로고침으로 재추첨되지 않는다.
- 전용 일러스트가 없는 이벤트는 중립 placeholder를 사용한다.
- persisted field를 추가하지 않았으므로 save schema는 v21을 유지한다.

## 자동 검증

`tests/events.test.ts`에 다음 회귀 검증을 추가한다.

- production catalog가 정확히 6종이며 ID가 유일함
- fixture와 BOSS 이벤트가 production 일반 pool에 섞이지 않음
- 실제 production 승리 후 canonical 이벤트가 열림
- 회복 이벤트 HP 조건과 최대 HP clamp
- 위험 이벤트의 저장 ticket 기반 성공·부상 분기

## 다음 작업

- 이벤트 6종의 모바일 화면 QA
- 전용 공통 이벤트 일러스트 제작 및 `EVENT_ASSETS` 연결
- 발생률·보상량·피해량 플레이 밸런스 조정
- 이후 철맥의 첨탑 전용 이벤트를 별도 catalog로 확장
