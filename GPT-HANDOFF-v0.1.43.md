# GPT HANDOFF — Tower Chronicles v0.1.43

기준 앱 버전: `0.1.43`  
저장 스키마: `v22`  
메인 저장 키: `tower-record-v1`

## 1. 이번 버전 목적

v0.1.43은 **장비 강화 v1**을 실제 플레이 루프에 연결한 업데이트다.

핵심 목표:

1. 기존 `Item.enhancement`를 실제 강화 시스템으로 사용
2. 강화 단계에 따라 장비 성능을 deterministic하게 반영
3. 성공 / 유지 / 하락 / 파괴의 확률형 결과 구현
4. Silver와 탑 재료를 장기 성장 소모처로 연결
5. 강화 장비가 인벤토리, 거래소, 저장을 오가도 identity를 보존

신규 persisted field는 없다. 저장 스키마는 v22를 유지한다.

## 2. 강화 확률 — 확정

각 행은 별도의 실패 후 2차 판정이 아니라 **한 번의 전체 결과 분포**다.

| 시도 | 성공 | 유지 | 하락 | 파괴 |
| --- | ---: | ---: | ---: | ---: |
| +0 → +1 | 50% | 50% | 0% | 0% |
| +1 → +2 | 35% | 40% | 20% | 5% |
| +2 → +3 | 20% | 35% | 30% | 15% |

하락은 정확히 1단계다.

파괴 시:
- 장비를 `GameState.items`에서 영구 제거
- 장착 중이면 해당 슬롯 자동 해제
- 비용 반환 없음

공통:
- 성공/실패 모두 비용 소모
- 원정 중 강화 불가
- starter 지급 검 강화 불가
- 최대 +3
- 보호권 없음
- 실패 스택/천장 없음
- 복구 없음
- 계승 없음
- 랜덤 옵션 없음

## 3. 강화 비용 — provisional

T1 기준:

- +0→+1: 100 Silver / 재료 4
- +1→+2: 250 Silver / 재료 8
- +2→+3: 600 Silver / 재료 16

티어 배수:

- T1 ×1
- T2 ×2
- T3 ×3
- T4 ×4
- T5 ×5

재료:

- 무기 → 동일 티어 철광석
- 갑옷 / 신발 → 동일 티어 가죽
- 장신구 → 동일 티어 보석

이 비용 숫자는 확정 밸런스가 아니다. `src/game/data/enhancement.ts`만 수정해 조정하도록 설계했다.

## 4. 장비 강화 성능

numeric 장비는 +0 기여도의 10%씩 강화 단계마다 증가한다.

- +0 ×1.0
- +1 ×1.1
- +2 ×1.2
- +3 ×1.3

적용:

- 무기: 공격 / 방어 기여도
- 갑옷: HP / 방어 기여도
- 신발: HP / 공격속도 기여도

같은 kind / tier / enhancement이면 item id와 관계없이 같은 성능이다.

## 5. 장신구 강화 — 확정

| 장신구 | +0 | +1 | +2 | +3 |
| --- | ---: | ---: | ---: | ---: |
| 흡혈 | 8% | 9% | 10% | 11% |
| 불굴 | 30% | 32% | 34% | 36% |
| 광전사 | 40% | 43% | 46% | 50% |

발동 조건은 강화로 바뀌지 않는다.

- 불굴: HP 35% 이하
- 광전사: HP 40% 이하
- 흡혈: 기존 post-shield 직접 HP 피해 기준

## 6. 코드 구조

Data:
- `src/game/data/enhancement.ts`

Engine:
- `src/game/engine/enhancement.ts`
- `src/game/engine/equipmentStats.ts`

UI:
- `src/components/enhancement/EnhancementScreen.tsx`
- `EnhancementItemCard.tsx`
- `EnhancementPreview.tsx`
- `EnhancementConfirm.tsx`
- `presentation.ts`
- `enhancement.css`

주요 API:

```ts
enhancementQuote(state, itemId)
resolveEnhancementOutcome(level, roll)
enhanceEquipment(state, itemId, rng)
equipmentContribution(item)
equipmentStats(state, equipment)
accessoryPassive(item)
```

## 7. 확률 판정

`resolveEnhancementOutcome`은 부동소수점 누적 오차가 확률 경계를 넘기지 않도록 1,000,000 scale의 정수 경계를 사용한다.

RNG 입력 범위는 `0 <= roll < 1`.

UI에서 RNG를 굴리지 않는다. 실제 결과는 engine에서만 판정한다.

## 8. UI

공방에서 `장비 강화` 화면으로 진입한다.

표시:

- 보유 장비
- 현재 / 다음 강화 단계
- 현재 / 다음 성능
- 성공 / 유지 / 하락 / 파괴 확률
- Silver 비용
- 동일 티어 재료 비용과 보유량
- 파괴 위험 경고

파괴 가능 강화는 확인 modal에서 파괴 확률과 영구 삭제 위험을 다시 표시한다.

## 9. 거래소 및 저장 호환

강화 장비는 개별 `Item`으로 거래한다.

매도 주문의 `MarketOrder.gear` escrow는:
- kind
- tier
- enhancement
- id

를 그대로 보존한다.

장비가 인벤토리에서 빠져 있어도 거래소 catalog가 escrow metadata를 사용해 `Tn 장비 +강화` 이름을 복원한다.

개별 장비 주문 수량은 1개로 제한한다.

현재 save validator는 market escrow gear도 Item 구조와 enhancement 0~3을 검증한다.

## 10. 저장 버전

`GameState.version = 22` 유지.

이유:
- `Item.enhancement: 0|1|2|3`는 이미 기존 저장 구조에 존재
- 신규 영구 필드 없음
- migration 불필요

`APP_VERSION`만 0.1.43으로 상승한다.

## 11. v0.1.43 PR sequence

- PR #11 — enhancement rules
- PR #12 — enhancement stats
- PR #13 — enhancement engine
- PR #14 — enhancement UI
- PR #15 — inventory / market / save compatibility
- PR #16 — release integration

## 12. 회귀 검증

반드시 유지:

- +0→+1 success / keep 경계
- +1→+2 success / keep / downgrade / destroy 경계
- +2→+3 success / keep / downgrade / destroy 경계
- 파괴 장비 자동 해제
- starter 차단
- 원정 중 차단
- Silver / material 부족 atomic 차단
- material family / tier 비용
- 무기 / 갑옷 / 신발 deterministic 강화 성능
- 장신구 +0~+3 실제 전투 반영
- 인벤토리 설명
- market escrow 등록 / 취소 / 체결
- v22 저장 roundtrip

Release gate:

```sh
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
```
