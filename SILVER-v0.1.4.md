# Silver 전환 v0.1.4

## 변경 결과

- 최신 저장 상태는 `version: 4`, 영구 일반 화폐는 `silver`입니다.
- 원정 임시 전리품과 마지막 원정 결과도 `loot.silver`를 사용합니다.
- 몬스터 보상 설정은 `silverBase: 10`, `silverPerFloor: 3`이며 기존 수량을 유지합니다.
- 헤더, 전투 로그, 전리품, 귀환·사망 결과는 `Silver`로 통일했습니다.
- WebMCP 상태 조회와 귀환 응답도 `silver` 키를 반환합니다.
- Premium Gold 필드는 추가하지 않았습니다.

## 저장 이전

localStorage 메인 키 `tower-record-v1`은 유지합니다.

이전 순서는 다음과 같습니다.

- v1 → 기존 v2 변환 → 기존 v3 변환 → 신규 v4 변환
- v2 → 기존 v3 변환 → 신규 v4 변환
- v3 → 신규 v4 변환
- v4 → 검증 후 그대로 로드

v3에서 v4로 바꿀 때 다음 세 위치만 1:1로 이름을 변경합니다.

- `gold` → `silver`
- `expedition.loot.gold` → `expedition.loot.silver`
- `lastExpedition.loot.gold` → `lastExpedition.loot.silver`

진행 중 원정의 HP, 몬스터 HP, 시간, 처치 수, 포션, 장비 고정값, 귀환 예약과 숙련도는 유지합니다. 원정 임시 Silver를 영구 Silver와 합산하지 않습니다.

직접 v3 저장을 처음 이전하기 전에 원문을 `tower-record-v1-before-silver-v4`에 한 번만 백업합니다. 이전이나 백업 쓰기가 실패하면 메인 저장을 덮어쓰지 않습니다. v4에는 일반 화폐 의미의 `gold` 필드가 함께 존재할 수 없습니다.

## 검증

- 기존 테스트 75개 유지
- Silver 신규 테스트 13개 추가
- 총 88개 테스트 통과
- TypeScript 타입 검사 통과
- Vite 배포 빌드 통과

프로젝트의 최신 런타임과 화면에는 일반 화폐 의미의 `gold` 또는 `골드`가 남아 있지 않습니다. `src/storage/repository.ts`와 저장 이관 테스트에 남은 `gold`는 v1/v2/v3 데이터를 읽고 검증하기 위한 과거 형식입니다. README의 Premium Gold 언급은 향후 별도 화폐와 현재 Silver를 구분하는 설명입니다.
