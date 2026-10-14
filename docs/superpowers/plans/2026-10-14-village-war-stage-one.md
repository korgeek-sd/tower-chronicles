# Village War Stage One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 서버의 수비 배치와 빈 전선 점령을 구현하고 중복 차감·동시 행동을 검증한다.

**Architecture:** 기존 선전포고를 참가 권한의 근거로 재사용하되 구형 점령전과 별도 테이블·RPC로 구현한다. 서버 트랜잭션이 배치·지갑·쿨타임·요청 영수증을 함께 관리하고 React 화면은 반환된 상태를 표시한다. 점수 정산과 자동 PvP 연결 전에는 새 공성전을 운영 활성화하지 않는다.

**Tech Stack:** React 19 / TypeScript / PostgreSQL 17 / Supabase RPC / Node test / PGlite / 실제 PostgreSQL 병렬 연결 검증.

**Spec:** `docs/superpowers/specs/2026-10-14-five-front-village-war.md`

## Global Constraints

- 11개 영지, 영지당 5전선, 전선당 수비자 1명.
- 배치 구간 `[시작-5분, 시작)`, 전투 구간 `[시작, 종료)`, 전쟁 60분.
- 토요일 22:00 KST 시작, 21:55 배치 시작. 구형 점령전 일정과 SQL은 변경하지 않는다.
- 빈 전선 점령은 도전권 1장, 개인 쿨타임 30초. 실패·중복 재시도에는 추가 차감 없음.
- 같은 캐릭터는 진행 중인 모든 영지를 합쳐 한 전선만 수비하며 수비 중 공격 불가.
- 캐릭터 세팅·권한·서버 시각은 서버에서 읽는다. 사냥·음식·활력과 공성전 상태를 분리한다.
- private 테이블 RLS와 직접 접근 금지. RPC는 활성 플레이 세션 검증.
- 잠금 충돌은 즉시 반환하고 공격을 대기열에 쌓지 않는다.
- 150점 조기 승리·전선당 분당 1점·자동 PvP·수비 보상은 2차 범위다. 1차만 완성된 상태에서 전체 공성전 완료로 보고하지 않는다.
- 모바일 320×568 / 375×640 / 430×740에서 주요 조작을 검증한다.

## Review Focus

- 배치 해제와 시작 경계의 경합: 시작 이후 길드장도 배치를 해제할 수 없어야 한다. Task 1 SQL 경계 테스트.
- 동일 요청 UUID를 다른 영지에 재사용: 저장된 결과를 혼동하지 않고 요청 충돌로 거절해야 한다. Task 2 영수증 테스트.
- 한 사람이 다른 영지 두 곳에 동시 점령: 한 요청만 성공하며 한 전선만 수비해야 한다. Task 4 병렬 테스트.
- 원래 수비자가 제거되고 같은 사람이 재배치: 교체 번호가 달라졌으므로 오래된 요청을 거절해야 한다. Task 2 버전 테스트.
- 응답 유실 후 계정 전환: 새 계정에서 기존 계정의 요청을 재실행하거나 상태를 표시하지 않아야 한다. Task 3 복구 테스트.

## File Structure

- `src/game/occupation/villageWarRules.ts`: 새 전쟁의 일정·단계 정의. 구형 rules.ts는 유지.
- `supabase/migrations/<CLI-generated>_village_war_stage_one.sql`: private 데이터·조회·배치·빈 전선 점령 RPC.
- `src/online/villageWar.ts`: 기존 선언 함수 유지, 새 타입·RPC 추가.
- `src/components/occupation/useVillageWarStageOne.ts`: 서버 조회·요청 UUID·재확인·계정 변경 관리.
- `src/components/occupation/VillageWarBattleScreen.tsx`: 실제 전선 및 배치 버튼 연결. 시안 데이터는 별도 모드 유지.
- `src/components/occupation/village-war-battle.css`: 단계별 모바일 배치 UI.
- `tests/villageWarStageOneRules.test.ts`, `tests/villageWarStageOneSql.test.ts`, `tests/villageWarStageOneUi.test.ts`: 규칙·DB·UI 검증.
- `tests/villageWarStageOneFixture.sql`: 로컬 검증 전용 사용자·길드·영지·지갑 fixture.
- `scripts/qa/villageWarConcurrency.mjs`: 테스트 DB에만 접속하는 실제 병렬 연결 검증.

### Task 1: 이벤트 상태와 수비 배치

**Interfaces:**
- `villageWarWindow(now:number): {cycleKey:string; deploymentStartsAt:number; battleStartsAt:number; battleEndsAt:number; phase:'WAITING'|'DEPLOYMENT'|'BATTLE'|'ENDED'}`.
- RPC `get_village_war_state(lease args, p_town_id text) -> jsonb`: serverNow, eventId, phase, timestamps, ownerAssociationId, myAssociationId, myRole, tickets, nextAttackAt, myDefendingFront, fronts.
- fronts 배열의 항목: frontId, defenderUserId, defenderName, associationId, associationName, defenderEpoch, revision, hp, maxHp, mp, maxMp, occupiedAt.
- RPC `place_village_war_defender(lease args,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint)` 및 `remove_village_war_defender`는 `{state,result,replayed}` 반환.

- [ ] 경계와 권한 실패 테스트 작성: 21:54:59 배치 거절, 21:55 허용, 21:59:59 허용, 22:00 거절. 전선 0·6 거절, 비소유 길드 배치 거절, 멤버의 해제 거절, 길드장의 같은 길드 배치 해제 허용, 중복 수비 거절.
- [ ] `node --import ./tests/register.mjs --test tests/villageWarStageOneRules.test.ts tests/villageWarStageOneSql.test.ts`로 의도한 미구현 실패 확인.
- [ ] 새 일정 함수와 private owners/events/fronts/actor_state/receipts 구현. Supabase CLI 도움말 확인 후 migration new로 파일 생성. 서버 소유자가 없는 영지는 중립으로 처리. 기존 서버 장비·스킬 계산 함수와 저장 데이터 경로를 확인해 시작 시 고정 스냅샷 구성.
- [ ] 조회·배치·해제 RPC 구현. 시작 시 5개 전선을 잠근 뒤 세팅 고정, 미배치 전선은 중립 처리. 미래 단계 변경과 충돌하지 않는 잠금 순서 적용.
- [ ] 같은 명령으로 PASS 확인. DB 조회의 비공개 필드 노출·RLS·RPC 실행 권한 검사.
- [ ] 해당 규칙·SQL·테스트만 명시해 커밋.

### Task 2: 빈 전선 점령과 멱등성

**Interfaces:**
- `claim_empty_village_war_front(lease args,p_request_id uuid,p_town_id text,p_front_id int,p_expected_epoch bigint) -> {state,result,replayed}`.
- result: `{action:'CLAIM_EMPTY',frontId:number,defenderEpoch:number,ticketsSpent:1,cooldownUntil:string}`.
- 사업 규칙 오류: WAR_PHASE_INVALID, WAR_FRONT_BUSY, WAR_ACTOR_BUSY, WAR_DEFENDER_CHANGED, WAR_FRONT_NOT_EMPTY, WAR_ALREADY_DEFENDING, WAR_ATTACK_COOLDOWN, WAR_TICKETS_SHORT, WAR_REQUEST_CONFLICT.

- [ ] SQL 테스트 작성: 도전권 2→1, 점령자=공격자, 만HP·MP, 쿨타임+30초, epoch 증가. 동일 UUID 재호출은 같은 결과이며 잔액1 유지. 다른 payload의 UUID 재사용 거절. 잔액0·수비중·쿨타임·예상epoch 불일치 시 전체 상태 불변.
- [ ] Task 1 명령으로 해당 테스트가 FAIL함을 확인.
- [ ] 사용자·UUID 잠금 및 영수증 검사, 이벤트·사용자·전선·지갑 순서의 충돌 제어 구현. 특정 전선과 사용자에는 즉시 실패 가능한 잠금을 사용. 차감·스냅샷·개인 수비 상태·쿨타임·영수증을 원자적으로 기록.
- [ ] 점령 중 예외를 유도한 rollback 테스트와 같은 사용자 재배치 epoch 테스트를 추가하고 PASS 확인.
- [ ] Task 2의 SQL·테스트만 커밋.

### Task 3: 실제 화면과 요청 복구

**Interfaces:**
- online 타입 `VillageWarStageOneState`는 Task 1 조회 응답과 동일 필드를 사용.
- online 함수 `getVillageWarState(lease:GameplayLease,townId:string):Promise<VillageWarStageOneState>`.
- 함수 `placeVillageWarDefender`, `removeVillageWarDefender`, `claimEmptyVillageWarFront`는 `(lease,request:{id:string;townId:string;frontId:number;expectedEpoch:number})`를 받고 Task 2 결과 형태를 반환.
- `useVillageWarStageOne(lease:GameplayLease|null,userId:string|null,townId:string)` 반환: state,busy,error,pending,refresh,place,remove,claim,retry.

- [ ] UI 테스트 작성: 배치 단계에 자기 배치와 길드장 해제, 전투 단계에 빈 전선 점령, 수비중·쿨타임·권한 부족 시 disabled. 수비자가 있는 전선은 실제 PvP 연결 전 비활성. 중립 전선에는 예시 길드·HP 표시 없음.
- [ ] `node --import ./tests/register.mjs --test tests/villageWarStageOneUi.test.ts`로 FAIL 확인.
- [ ] 타입·RPC 어댑터·훅 구현. pending UUID를 계정별로 저장하고 미확인 요청을 재확인. 중복 클릭은 busy로 차단. 계정 변경·화면 전환 이후 응답을 취소/무시하고 최신 서버 상태만 반영.
- [ ] 기존 5전선 화면에 실제 상태 연결. 새 단계는 내부 검증 모드에서만 활성화하고 운영 공성전은 전체 규칙 완성 전 활성화하지 않음. 시안 데이터와 실데이터를 명확히 분리.
- [ ] 응답 유실·동일 UUID 재시도·계정 전환 테스트 PASS 확인. 모바일 3크기에서 키보드·오류·재확인·버튼 위치를 실제 브라우저로 검증.
- [ ] `npm run build` 성공 확인 후 UI·online·tests 변경만 커밋.

### Task 4: 실제 병렬 DB 검증과 출시 경계

**Interfaces:**
- `scripts/qa/villageWarConcurrency.mjs`는 전용 `VILLAGE_WAR_TEST_DATABASE_URL`만 사용하고 별도의 명시적 테스트 DB 표식이 없는 DB는 거절한다. 실제 사용자 계정·운영 도전권을 변경하지 않는다.
- 실제 다중 연결 드라이버는 현재 의존성에 없으면 고정 버전의 테스트 전용 pg를 추가. fixture와 새 migration으로 격리 DB 구성.

- [ ] 같은 빈 전선의 다른 사용자 요청 두 개, 한 사용자의 다른 전선 요청 두 개, 동일 UUID 요청 두 개를 서로 다른 DB 연결에서 동시에 보내는 재현 테스트 작성. 잠금을 유지한 연결과 공격 연결로 NOWAIT 거절을 확실히 재현.
- [ ] 잠금·멱등성 구현이 없거나 의도적으로 제거된 테스트 DB에서 재현 테스트 FAIL 확인.
- [ ] 테스트 fixture·병렬 스크립트 구현. 성공자 1명·총 차감1장·수비전선1개·영수증1개·실패한 요청의 쿨타임 없음 검증. 전선 변경과 오류 rollback도 검증.
- [ ] `node scripts/qa/villageWarConcurrency.mjs` 결과 PASS 확인. 테스트 DB 사용이 불가능하면 병렬 검증 미완료를 명시하고 운영 활성화하지 않는다. PGlite 단일 연결 통과를 동시성 통과라고 보고하지 않는다.
- [ ] `npm test`, `npm run build`, `git diff --check` 실행. 기존 사냥·구형 점령전·선전포고·거래소 회귀 없음 확인.
- [ ] DB 관련 스킬의 보안 검토 및 advisors 확인 후 검증된 migration을 운영에 적용할지 실행 단계에서 결정. 1차만으로 전체 공성전 활성화 금지. 변경된 파일만 커밋하고 CI 결과 확인.

## Next Implementation Unit

이 계획 완료 후 동일 확정 설계의 자동 PvP·점수 시간 적분·150점 및 60분 종료 판정·50% 수비 보상·실제 전투 기록을 별도 계획으로 구현한다. 임의 고정 피해나 클라이언트 점수를 대체 기능으로 공개하지 않는다.
