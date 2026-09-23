# 탑의 기록 v0.1.42

《탑의 기록》(Tower Chronicles)은 네 개의 고대 탑을 중심으로 성장한 자유상업도시 노바르를 배경으로 하는 모바일 세로형 다크 판타지 수동 턴제 RPG 프로토타입입니다.

- 앱 버전: `0.1.42`
- 저장 스키마: `v22`
- 기술: React 19, TypeScript, Vite
- 저장: 브라우저 `localStorage`
- 현재 실제 플레이 가능 탑: `철맥의 첨탑`, `천광의 수정탑`
- 메인 저장 키: `tower-record-v1`
- production 일반 랜덤 이벤트: 없음 (`EVENT_CATALOG=[]`)

세계관과 시각 방향은 `WORLD-AND-ART-DIRECTION.md`, 최신 개발 상태는 `GPT-HANDOFF-v0.1.42.md`를 우선 확인합니다. 실제 동작이 문서와 충돌할 경우 production code와 자동 테스트가 우선입니다.

## v0.1.42 — 전투 가독성 + 탐사 생물록

이번 버전은 이미 존재하는 전투 정보를 플레이어가 읽을 수 있게 만들고, 조우한 개체를 영구 기록으로 남기는 업데이트입니다.

### 전투 가독성

전투 화면에서 다음 정보를 직접 확인할 수 있습니다.

- 확정된 Charge 준비 행동
- 확정된 Reactive 반격 준비
- 적 보호막 현재치 / 최대치 / 남은 턴
- 적 버프·디버프의 수치, 중첩, 남은 턴
- 적 고유 스킬 이름, 종류, 기본 쿨다운, 현재 남은 쿨다운
- AI의 다음 행동은 예측하지 않으며 이미 확정된 준비 행동만 경고

표시 계층은 `src/components/battle/combatIntel.ts`에서 엔진 상태를 읽어 presentation model로 변환합니다. 전투 계산과 AI 규칙 자체는 이 업데이트에서 변경하지 않았습니다.

### 탐사 생물록

거점에서 `탐사 생물록`에 진입할 수 있습니다.

현재 active catalog:

- 철맥의 첨탑: 일반 5 + 보스 5 = 10종
- 붉은 송곳니의 성소: 일반 5 + 보스 5 = 10종
- 천광의 수정탑: 일반 20 + 보스 5 = 25종
- 칼레온의 녹빛 첨탑: 아직 active 개체 없음
- 총 active catalog: 45종

정보 공개 단계:

- 미조우: 미확인 개체/보스로 표시
- 1회 조우: 이름, 외형, 출현층 공개
- 일반 개체 1회 처치: 스킬 이름 공개
- 일반 개체 3회 처치: 스킬 설명, 기본 대기시간, AI 조건 공개
- 보스 1회 처치: 전체 전투 정보 공개

진행도는 `GameState.bestiary`에 canonical monster id 기준으로 저장됩니다. QA/미등록 몬스터는 영구 생물록을 오염시키지 않습니다.

## 천광의 수정탑

천광의 수정탑은 v0.1.41부터 실제 전투 콘텐츠가 연결되어 있으며 v0.1.42에서 탑 선택 화면에서도 실제 입장이 가능해졌습니다.

### 일반 몬스터

총 20종이며 층이 올라갈수록 단순 패턴에서 복합 패턴으로 출현 풀이 확장됩니다.

저층에서는 기본 공격·보호막·방어 효과를 익히고, 중층부터 DOT와 Charge, 고층에서는 Reactive와 Stack 조건을 함께 상대합니다.

### 6~10F 보스

- 6F `백정갑주 거수`
- 7F `만광굴절 포식자`
- 8F `맥동광핵 증식체`
- 9F `천면결정수`
- 10F `천광심핵 모체`

모든 전투 패턴은 기존 Monster Combat Framework의 `damage`, `charge`, `reactive_prepare`, `effect`, Shield, DOT/HOT, stat modifier, stack, HP/status AI 조건 안에서 구현됩니다.

전용 몬스터 스프라이트는 아직 제작 전이므로 천광 일반 몬스터와 보스는 기존 수정 파수꾼 이미지를 placeholder로 사용합니다.

## 철맥의 첨탑

철맥의 첨탑은 1~10F 구조입니다.

- 1~2F: `SAFE`
- 3~10F: `PK_ELIGIBLE` 메타데이터
- 실제 서버 PvP는 아직 구현되지 않음

일반 몬스터 5종은 전 층 공통 pool을 사용하고 runtime 스탯만 층에 따라 상승합니다.

6~10F 보스:

- 6F `쇄철턱 굴혈수` — Charge
- 7F `흑맥갑주 파쇄충` — 갑주 / 균열 stack / 노출
- 8F `울림포식자` — 울림 stack 조건부 Charge
- 9F `심층 권양감독체` — Reactive counter + Charge
- 10F `철심 맥동체` — Shield + debuff + HP 조건 Charge

## 저장

현재 저장 스키마는 `v22`입니다.

v21 → v22에서는 탐사 생물록 영구 진행도를 추가합니다. 기존 v21 저장을 읽을 때 원본을 별도 backup key에 보존한 뒤 migration하며, 진행 중인 실제 canonical monster 조우가 있다면 해당 개체의 조우 기록 1회를 보존합니다.

주요 backup key:

- `tower-record-v1-before-bestiary-v22`
- `tower-record-v1-before-manual-import`
- 과거 버전별 migration backup key 유지

JSON save export/import도 현재 v22 상태를 검증합니다.

## 현재 Production 구현 상태

### 구현됨

- 철맥의 첨탑 1~10F
- 천광의 수정탑 1~10F
- 1~2F SAFE / 3~10F PK_ELIGIBLE metadata
- 철맥 일반 5종 + 보스 5종
- 천광 일반 20종 + 보스 5종
- 수동 1대1 턴제 전투
- Charge / Reactive / Shield / DOT / HOT / Stack / status AI
- 전투 가독성 UI와 적 전투 정보 패널
- 탐사 생물록 45종 catalog + 영구 진행도
- 회복 포션 4종 + 선택형 회생 포션
- 원정 임시 전리품과 생환 확정
- 장비 4슬롯, 제작, 장비 숙련도, 인벤토리, 프리셋
- 로컬 거래소 / 조합 prototype
- JSON save export/import와 save migration
- 데이터 기반 직업 전투 framework와 일부 COMBAT_READY 직업

### 아직 미구현 또는 콘텐츠 미완성

- 칼레온의 녹빛 첨탑 실제 몬스터 콘텐츠
- 붉은 송곳니의 성소의 플레이어 선택 탑 활성화 및 콘텐츠 확장
- production 일반 랜덤 이벤트
- 실제 서버 PvP
- 온라인 서버 / 로그인 / DB / authoritative economy
- Gold Exchange
- 원정단 점령전
- 직능 등록 / 확률형 등록 서버 RNG
- 전체 직업의 실제 combat kit
- 천광 전용 몬스터/보스 스프라이트

## 개발 명령

```sh
npm ci
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
```

GitHub Actions는 Node.js 22.20.0에서 테스트, TypeScript typecheck, production build, 가능한 경우 standalone 검증을 수행합니다.

## 주요 구조

- `src/main.tsx` — 앱 상태와 화면 연결
- `src/game/data` — 탑, 몬스터, 생물록, 밸런스, 그래픽 데이터
- `src/game/engine` — 전투, 원정, 효과, 생물록 진행도, 보상, 제작
- `src/game/events` — 이벤트 engine / selector / catalog
- `src/game/jobs` — 직업 catalog와 runtime
- `src/storage/repository.ts` — 저장 검증, backup, migration, import/export
- `src/components/battle` — 전투 UI와 Combat Intel
- `src/components/bestiary` — 탐사 생물록 UI
- `tests` — 자동 회귀 테스트
- `.github/workflows/ci.yml` — GitHub 자동 검증
- `.github/workflows/deploy-pages.yml` — GitHub Pages 배포
