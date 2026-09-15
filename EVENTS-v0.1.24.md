# 탑의 기록 v0.1.24 — 원정 이벤트 구현 보고

기준 원본: `E:/ChatGPT/게임만들기/battle-redesign`의 v0.1.23. 저장 스키마는 v16 → v17.
변경 전 소스·테스트·패키지·실행본은 `backups/before-v0.1.24`에 보존했다.

## 실행과 확인

- `play.html`: 실제 게임 최신 실행본. `dist`도 갱신한다.
- `event-preview.html`: 저장 데이터에 접근하지 않는 독립 샘플 UI. 기본은 버려진 광부의 가방이다. 선택 → 결과 → 다음 전투를 즉시 확인할 수 있다.
- 실제 원정에서 일반 샘플 이벤트를 시험하려면 주소 끝에 `?events=test`를 붙이고 **새 원정**을 시작한다. 이 원정은 test 모드를 저장하므로 새로고침에도 유지된다. 이후 일반 모드로 되돌리려면 쿼리를 제거하고 새 원정을 시작한다.
- 기본 production 일반 이벤트 목록은 비어 있다. 정식 탑 이벤트를 임의 확정하지 않기 위함이다. production의 기존 보스 조우는 공통 보스 이벤트로 작동한다.
- `event-qa.html`: 개발 서버 전용 UI 검증 페이지. `?long=1`, `?noPreview=1`, `?noArt=1`, `?brokenArt=1`, `?fixture=TEST_BOSS_EVENT` 등을 지원한다.

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `src/game/events/types.ts` | 정적 정의·선택·조건·효과와 원정 런타임 타입 |
| `src/game/events/catalog.ts` | 정식 이벤트 목록, 기존 보스용 공통 정의, 이미지 키 매핑 |
| `src/game/events/fixtures.ts` | 격리된 테스트 이벤트 5종 |
| `src/game/events/rng.ts` | 주입 가능한 RNG, 유효 범위 검사, 가중치 선택 |
| `src/game/events/selector.ts` | 조건 판정, 일반·보스 풀 분리, 중앙 조정값 |
| `src/game/events/service.ts` | 전투 후 판정·이벤트 선택·효과·결과·다음 조우 |
| `src/game/events/validation.ts` | 저장 런타임 정합성 검사 |
| `src/components/events/EventScreen.tsx`, `events.css` | 데이터 기반 모바일 이벤트 UI |
| `src/game/engine/combat.ts` | 승리 후 이벤트 서비스 호출, 이벤트 중 행동 차단 |
| `src/game/engine/expedition.ts` | 원정 이벤트 초기화, 도망 규칙을 지키는 공개 귀환 경로 |
| `src/game/engine/bossTracking.ts` | 기존 보스 데이터 조회 유지, 이전 조우 API 호환 처리 |
| `src/game/engine/effects.ts` | 전투 종료 시 BATTLE 효과 정리, EXPEDITION 확장점 유지 |
| `src/game/types.ts`, `engine/state.ts`, `src/storage/repository.ts` | 저장 v17, 안전 이전과 백업 |
| `src/main.tsx`, `components/battle/BattleScreen.tsx` | 이벤트 화면 연결, 저장 후 UI 전환, 옛 보스 모달 제거 |
| `tests/events.test.ts`, `tests/bossTracking.test.ts` | 이벤트·보스·정산·저장 자동 검증 |
| `tests/gearMastery.test.ts`, `tests/jobs.test.ts` | 변경된 공개 귀환 규칙과 최신 저장 기대값 반영 |
| `scripts/event-ui-qa.cjs`, `tests/EventQa.tsx` | 모바일·실제 앱 연결 브라우저 검증 |
| `scripts/event-preview.mjs` | 저장 없는 오프라인 샘플 실행본 제작 |

## 데이터 구조

`ExpeditionEventDefinition`은 `id`, 7종 `type`, `title`, `description`, `imageAssetKey`, `towerIds`, `tiers`, `floors`, `weight`, `conditions`, `choices`, 선택적 `rewardPreview`, `metadata`를 갖는다. 정의 객체에 실행 상태를 저장하지 않는다.

`EventChoice`는 `id`, `label`, `description`, `icon`, `effects[]`, `conditions[]`, `outcomes[]`, `resultText`, `styleVariant`를 갖는다. 선택지 개수는 고정하지 않는다. SKIP은 선언 실수로 효과가 들어 있어도 효과와 추첨을 실행하지 않는다.

`EventEffect`는 HEAL_HP, ADD_POTION, ADD_TEMP_LOOT, ADD_EXPEDITION_SILVER, APPLY_EFFECT, REMOVE_EFFECT, START_BOSS_BATTLE, NO_EFFECT, TAKE_DAMAGE를 판별 가능한 union과 switch로 처리한다. 위험 선택은 가중치가 있는 `EventOutcome[]` 중 하나를 선택한다. 무관한 효과 타입을 추가하지 않았다.

`EventCondition`은 탑, 티어 범위, 층 범위, 일반/보스층, HP 비율 상·하한, 아이템 보유/미보유, CUSTOM 확장점을 지원한다. CUSTOM은 아직 등록기가 없으므로 false로 처리한다. 향후 JOB_ID 등을 이 union과 조건 평가기에 추가하면 된다. 이번에는 직업별 선택지를 만들지 않았다.

## 발생 판정과 보스 통합

1. 기존 전투 승리 보상을 먼저 `expedition.loot`에 지급한다.
2. `events.phase`가 BATTLE인 한 번의 승리만 POST_BATTLE로 이동한다.
3. 일반층은 일반 이벤트 발생 판정 후 조건에 맞는 가중치 풀을 선택한다.
4. 보스층에서는 기존 `bossIdFor`로 실제 보스 데이터가 있는지 확인하고 진행도를 1 올린다.
5. 보스 확률 = 기본 확률 + 진행도 × 증가량. 최대 진행도에서는 확률 1을 사용한다.
6. 보스 판정 성공 시 별도 BOSS 정의 풀을 사용하고, 맞는 정의가 없으면 기존 보스용 공통 이벤트를 사용한다.
7. 보스 판정이 실패하면 일반 이벤트 판정으로 이어진다. 둘 다 없으면 다음 일반 몬스터를 생성한다.

`bossEncounterProgress`는 새 필드를 중복 추가하지 않고 **기존 `bossTracking.progress`를 처치 수 단위로 재사용**한다. 기존 퍼센트 값은 v16 이전 시 0~100 비율을 새 최대 진행도에 맞게 변환한다.

`EVENT_BALANCE`의 일반 발생률 0.25, 보스 기본률 0.03, 처치당 추가율 0.02, 최대 20은 **개발 검증용 임시값**이다. 최종 밸런스로 확정하지 않았다. 최근 이벤트 1개를 일반 풀에서 제외하는 작은 반복 방지 확장점도 여기에 있다.

BOSS 이벤트가 **화면에 등장할 때** 진행도를 0으로 소비한다. 도전과 지나가기 모두 0을 유지한다. 새로고침해도 진행도는 복원되지 않는다. 보스를 잡았다는 `bossDefeated` 기록은 보스 재등장을 차단하지 않는다.

도전 → 결과 확인 → 기존 공통 Battle Engine의 PLAYER_TURN으로 보스전을 시작한다. 새로운 보스 AI나 전투 엔진을 만들지 않았다. 보스 승리 시 임시 보상, `bossKillCountThisExpedition` 증가, `bossTracking.bossDefeated=true`를 남기고 다음 일반 전투를 시작한다. 이때 추가 랜덤 이벤트를 굴리지 않는다.

`bossDefeated`는 이번 원정의 pending clear로 재사용한다. `leave`의 기존 생환 정산에서만 다음 티어 해금과 거래 자격에 반영한다. 이후 사망하면 확정하지 않는다. 도망 중 지속 피해로 적이 죽어도, 플레이어가 생존하면 보상 정산 후 귀환하며 새 이벤트를 열지 않는다.

### 폐기·호환 처리한 legacy 규칙

- 승리 후 옛 `advanceBossTracking`을 호출하는 경로를 제거했다. 함수는 deprecated no-op으로 남아 이중 판정을 방지한다.
- `BOSS_TRACKING_BALANCE`는 과거 자료 호환용이며 실제 확률은 `EVENT_BALANCE`만 사용한다.
- 기존 `challengeBoss`/`declineBoss`는 같은 이벤트 resolver로 위임하는 deprecated 어댑터다.
- 전투 화면의 옛 보스 발견 모달을 제거했다.
- 조기 조우 거절 시 진행도를 보존하던 규칙과 보스 최초 처치 후 재조우 차단 규칙을 제거했다.
- 공개 `requestReturn`이 즉시 정산하던 우회 경로를 도망 행동에 맞췄다. 이벤트 대기·결과 화면에서는 작동하지 않는다.

## 이벤트 화면

첨부한 레퍼런스의 정보 순서를 실제 React UI로 반영했다. 제목 프레임 → 큰 이미지 → 짧은 설명 → 구분선 → 금색 주요 버튼/회색 지나가기 버튼 → 선택적 발견물 미리보기 순서다. 버튼 아래 부연 설명, 세로 배치, 4개 이상 선택, 긴 제목과 설명을 지원한다.

상단에는 현재 탑/층, 실제 HP, 원정 Silver, 휴대 포션 수를 보여 주고 기존 하단 메뉴를 유지한다. 이벤트 화면의 메뉴로 다른 화면에 다녀와도 원정의 이벤트 상태는 그대로다. 전투 화면을 새로 시작하거나 이벤트를 건너뛰는 버튼을 추가하지 않았다.

`rewardPreview`가 없으면 영역 전체를 생략한다. 있으면 데이터만큼 렌더링하며 확정 지급량으로 오인하지 않도록 설명한다. 결과 화면은 별도의 텍스트와 실제 변화 목록을 보여 주며 [계속]/[보스에게 향한다]로 이동한다. 원정 종료 시에는 기존 정산 화면을 사용한다.

이미지는 `EVENT_ASSETS` 키로 조회한다. 키 누락 또는 로딩 실패 시 중립적인 탐사 기록 placeholder로 대체한다. 참고 이미지를 게임에 넣지 않았고 새 AI 이미지도 생성하지 않았다. 가방 샘플의 그림은 **기존 철맥 T1 배경을 개발용으로 재사용**한다. 가방 전용 정식 일러스트는 아직 없다.

## 저장·재접속·중복 방지

`expedition.events`에 phase, mode, pendingEvent, sequence, recentEventIds, activeBossId, 원정 보스 처치 수를 저장한다. `pendingEvent`는 이벤트 ID, 인스턴스 ID, CHOICE/RESULT 상태, 선택 ID, 결과 ID, 결과 문장/변화 목록, 다음 전투 종류, 난수값을 저장한다.

- 출현 시 생성된 난수 ticket을 저장하므로 위험 결과는 선택 전후 reload로 다시 굴려지지 않는다.
- 인스턴스 번호는 기존 `nextId`에서 발급하여 이전 원정의 지연된 입력과도 충돌하지 않는다.
- CHOICE + 현재 인스턴스 ID + 유효한 선택지 조건이 일치할 때만 한 번 resolve한다.
- RESULT 상태를 먼저 고정한 복제본에 효과를 적용한다. 다시 resolve하면 원래 상태를 반환한다.
- React는 즉시 입력을 잠근다. 서비스가 만든 전체 결과를 repository에 저장한 후 화면을 갱신한다. 저장 실패 시 입력을 복구하고 오류를 보여 준다.
- 이벤트 화면은 직접 RNG나 보상 계산, 보스 진행도 변경을 하지 않는다.
- 이벤트 중 기본 공격·스킬·포션·도망·공개 귀환·적 턴 처리를 차단한다.
- 현재 정의가 제거된 이벤트는 보상 없이 지나가기만 제공한다.

저장 v16 → v17 이전은 HP, 포션, 재산, 임시 전리품, 장비, 직업, 원정 층, 조합 등 기존 데이터를 보존한다. 기존 진행 중 보스전과 보스 발견 대기도 인식한다. 이전 저장은 `tower-record-v1-before-events-v17`에 한 번 백업하고, 검증·백업 성공 후 메인 저장을 교체한다. 원래 `tower-record-v1` 저장 키를 유지한다.

## DEV fixture와 이후 콘텐츠 추가

회복·보급·위험·발견·보스 샘플 5개를 `fixtures.ts`에만 둔다. production 일반 목록에 섞지 않는다. 이 샘플은 정식 세계관 콘텐츠가 아니다. 회생 포션은 어떤 fixture에도 넣지 않았다.

현재 v0.1.23의 포션 코드는 health/regen/attack/defense/haste 구조다. 이 업데이트는 기존 health 회복 포션을 보급 가방에 추가하는 방식으로 연결했다. 사용자가 정한 하급~최상급/회생 5종 체계 전체 개편은 수행하지 않았다.

정식 이벤트 추가 방법:

1. `catalog.ts`의 EVENT_CATALOG에 고유 ID와 정의를 추가한다.
2. towerIds/tiers/floors/conditions로 출현 범위를 정하고 weight와 choices를 지정한다.
3. `public/assets/events` 등에 그림을 넣고 EVENT_ASSETS에 키를 등록한다.
4. 확정 보상은 effects, 위험 분기는 outcomes, 선택적 안내는 rewardPreview로 선언한다.
5. 이미 지원하는 조건·효과를 사용하면 React 화면이나 resolver는 수정할 필요가 없다. 보스 이벤트도 BOSS 타입으로 별도 풀에 들어간다.

## 검증 결과

- TypeScript: `tsc --noEmit` 성공.
- 프로덕션 빌드: `vite build` 성공, `play.html` 재생성.
- 이벤트 전용 테스트 30개 통과.
- 전체 테스트 204개: 182 성공 / 22 실패.
- 변경 전 백업을 동일 환경에서 다시 실행: 175개 중 144 성공 / 31 실패.
- 남은 실패 22개는 모두 변경 전 실패 목록에도 있던 항목이다. 새 실패 이름은 0개다. 자세한 대조는 `qa-v0.1.24/test-comparison.json`, 전체 원문은 `validation-v0.1.24-tests.tap`을 참고한다.
- 남은 실패는 옛 tick 자동전투/초 단위 포션/구버전 저장 기대값 등이며, 통과했다고 표시하지 않았다.
- 보스 재조우·진행도 소비·귀환은 이번 규칙으로 관련 기존 테스트를 갱신했다. 직업 저장 테스트의 최신 스키마 기대값도 17로 갱신했다.
- 모바일/실제 앱 Playwright 시나리오 16개 통과, 브라우저 실행 오류 0개. 오프라인 play.html 실행과 event-preview.html 선택→결과→전투도 별도로 통과.
- Playwright + 별도 headless Edge에서 320px, 390×844, 긴 내용, 4개 선택, 미리보기 없음, 이미지 실패·누락, 실제 게임 선택/결과 reload, 전투 승리→이벤트 정지, 보스 도전/지나가기 연결을 확인했다. 수치·스크린샷은 `qa-v0.1.24`에 저장했다.
- lint script는 package.json에 없어 실행하지 않았다. 이 PC는 npm 명령이 없어 scripts에 적힌 TypeScript/Node test/Vite 실행기를 번들 Node로 직접 실행했다. pnpm runner는 자체 캐시 권한 문제로 시작하지 못해 사용하지 않았다.

## 남은 TODO

- 탑별 정식 이벤트·일러스트와 확정 확률/가중치 작성.
- 준비 중인 다른 탑/티어의 보스 콘텐츠는 기존 보스 데이터 조회 경로에 추가해야 한다.
- 기존 자동전투 시대 테스트 22개를 최신 수동 턴제 규칙과 대조하여 정리.
- 포션 등급 체계 전환은 별도 업데이트로 처리.
- JOB_ID/CUSTOM 조건, 서버 권위형 RNG·정산은 확장점만 마련했으며 이번 범위에서는 구현하지 않았다.
