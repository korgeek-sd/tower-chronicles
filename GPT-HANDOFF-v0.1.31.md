# 탑의 기록 / Tower Chronicles — v0.1.31 안정화 인수인계

작성 기준: GitHub branch `codex/v0.1.31-stabilization`  
기준 앱 버전: `0.1.31`  
저장 스키마: `v21`  
메인 저장 키: `tower-record-v1`

## 목적

v0.1.30의 10층 탑 구조 위에 이미 들어가 있던 철맥의 첨탑 6~10F 보스 구현을 정리하고, 현재 코드와 충돌하던 legacy 테스트/문서/저장 호환성을 정리해 v0.1.31을 다음 개발의 안정적인 기준점으로 만든다.

이번 안정화는 신규 대형 시스템 추가가 아니라 현재 구현의 정합성, 회귀 테스트, CI, 문서화에 초점을 둔다.

## 현재 철맥의 첨탑 구조

- 각 탑 최대 층: 10F
- 1~2F: `SAFE`
- 3~10F: `PK_ELIGIBLE` 메타데이터
- 실제 서버 PvP는 아직 미구현
- 철맥 1~10F 일반 몬스터 pool은 동일한 5종 사용
  - `goblin_miner` 고블린 광부
  - `cave_rat` 동굴 쥐
  - `mine_bat` 광산 박쥐
  - `goblin_carrier` 고블린 운반꾼
  - `goblin_overseer` 고블린 감독관
- 층별 난이도는 monster identity 교체가 아니라 runtime stat scaling으로 상승

## 철맥 6~10F production boss

- 6F `iron_maw_burrower` / 쇄철턱 굴혈수
  - Charge 준비 → 다음 자기 행동에 방출
- 7F `black_vein_armor_breaker` / 흑맥갑주 파쇄충
  - 전투 시작부터 `iron_armor`
  - 플레이어 direct hit마다 `fracture` 누적
  - 3중첩에서 갑주 제거 + `exposed_core`
  - DOT는 균열을 만들지 않음
- 8F `echo_devourer` / 울림포식자
  - `resonance` 누적
  - 3중첩 이상에서 조건부 Charge 우선
- 9F `deep_hoist_overseer` / 심층 권양감독체
  - Reactive counter 준비
  - direct hit에 1회 반응
  - DOT에는 반응하지 않음
  - Charge와 Reactive는 독립 상태
- 10F `iron_core_pulsator` / 철심 맥동체
  - Shield
  - 방어 저하 debuff
  - HP 50% 미만 조건부 Charge

보스 공격은 기존 공통 damage/death/revival pipeline을 사용한다.

## v0.1.31 안정화에서 정리한 내용

### 버전 표기

- `package.json`: 0.1.31
- `package-lock.json`: 0.1.31
- `src/storage/repository.ts` `APP_VERSION`: 0.1.31
- README: v0.1.31
- save schema는 v21 유지

새 persisted field를 추가하지 않았으므로 v22로 올리지 않는다.

### 7F 초기 갑주

보스 encounter 생성 시 `black_vein_armor_breaker`라면 플레이어의 첫 행동 전에 `iron_armor`를 적용한다.

따라서 7F의 의도된 흐름은:

`전투 시작 → 흑맥 갑주 활성 → 플레이어 direct hit → 균열 누적 → 3중첩에서 노출`

이다.

### 보스 회귀 테스트

`tests/ironBosses.test.ts`에서 다음을 검증한다.

1. 6~10F boss mapping과 MonsterDefinition validation
2. 6F Charge prepare / reload / discharge
3. 7F initial armor / direct-hit fracture / exposed transition
4. 7F DOT가 fracture를 만들지 않음
5. 8F resonance threshold와 Charge priority
6. 9F Reactive 1회 발동과 Charge 독립성
7. 9F DOT가 Reactive를 발동하지 않음
8. 10F Shield / debuff / low-HP Charge
9. boss lethal damage가 공통 revival decision pipeline으로 연결됨

### stale tests 정리

기존 `tests/ironSpire.test.ts` 등 과거 50층/층별 monster pool/광산 오우거 가정을 가진 테스트를 현재 10층 구조와 canonical boss에 맞게 정리했다.

과거 테스트 fixture가 현재 save validator와 충돌하던 부분은 legacy fixture helper를 도입해 필요한 historical version shape를 명시적으로 만든다.

### legacy 10F boss save 호환

v0.1.30 이전 저장 중 철맥 10F에 legacy `mining_ogre` pending boss/event reference가 남아 있을 수 있다.

v0.1.31 validator/migration은 이 historical reference를 현재 10F canonical boss 구조로 이전하는 과정에서 거부하지 않도록 compatibility path를 둔다.

신규 production encounter는 계속 `iron_core_pulsator`를 사용한다.

### CI

`.github/workflows/ci.yml`을 추가했다.

GitHub Actions Node.js 22.20.0 환경에서:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run build`

를 자동 실행한다.

`public/assets`가 GitHub에 versioned 되어 있을 때만 `node scripts/standalone.mjs`도 실행한다.

로컬 Windows Node 24에서 발생했던 `uv_os_get_passwd returned ENOMEM` 문제와 분리해, GitHub Linux + Node 22 환경에서 회귀 검증할 수 있도록 한다.

## asset / standalone 주의

게임 source code에는 보스 그래픽 경로가 연결돼 있지만 현재 GitHub 저장소만으로 실제 binary image 내용은 검증할 수 없다.

보스 경로:

- `assets/monsters/iron-bosses/iron_maw_burrower.png`
- `assets/monsters/iron-bosses/black_vein_armor_breaker.png`
- `assets/monsters/iron-bosses/echo_devourer.png`
- `assets/monsters/iron-bosses/deep_hoist_overseer.png`
- `assets/monsters/iron-bosses/iron_core_pulsator.png`

외부 원본 보관소 `E:\탑의 기록\일러스트`는 GitHub에서 접근할 수 없다.

따라서 v0.1.31의 마지막 수동 QA는 로컬 PC에서 다음을 확인한다.

- 각 보스가 올바른 전용 이미지로 표시되는지
- 이미지 clipping / transparency / pixel crispness
- 320×844
- 390×844
- Charge / Reactive / Shield / stack UI overlap
- `play.html` standalone asset resolution

## production 일반 이벤트 상태

`src/game/events/catalog.ts`의 `EVENT_CATALOG`은 여전히 빈 배열이다.

즉 v0.1.31에는 production 일반 랜덤 이벤트가 없다.

보스 encounter event와 DEV fixtures를 일반 production 랜덤 이벤트로 착각하지 않는다.

## 현재 미구현 / 후속 작업

- production 공통 랜덤 이벤트
- 실제 서버 PvP
- 장비 강화
- 사망 장비 파괴
- 붉은 송곳니 / 천광 / 칼레온 실제 전투 콘텐츠
- 25개 직업 실제 combat kit
- 온라인 server / DB / login / authoritative economy

## 다음 버전 권장

`v0.1.32 — Exploration Events`

우선 모든 탑에서 재사용할 수 있는 canonical 공통 이벤트 5~7종을 production `EVENT_CATALOG`에 추가하고, 이후 탑별 전용 이벤트로 확장한다.

## 완료 기준

v0.1.31 안정화 완료 판정은 다음을 만족할 때 한다.

- GitHub CI: npm test PASS
- GitHub CI: typecheck PASS
- GitHub CI: production build PASS
- save schema v21 유지
- 6~10F 보스 회귀 테스트 PASS
- legacy pending `mining_ogre` save compatibility PASS
- 로컬에서 보스 이미지 5종 확인
- 로컬 320×844 / 390×844 UI 확인
- 로컬 standalone asset 확인

GitHub에서 검증 가능한 코드/테스트/문서 안정화와 로컬 이미지/standalone 수동 QA를 구분해 보고한다.
