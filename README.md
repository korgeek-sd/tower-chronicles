# 탑의 기록 v0.1.31

《탑의 기록》(Tower Chronicles)은 네 개의 고대 탑을 중심으로 성장한 자유상업도시 노바르를 배경으로 하는 모바일 세로형 다크 판타지 수동 턴제 RPG 프로토타입입니다.

- 앱 버전: `0.1.31`
- 저장 스키마: `v21`
- 기술: React 19, TypeScript, Vite
- 저장: 브라우저 `localStorage`
- 현재 실제 플레이 가능 탑: `철맥의 첨탑` 1~10F
- 현재 production 일반 랜덤 이벤트: 없음 (`EVENT_CATALOG=[]`)

세계관과 시각 방향은 `WORLD-AND-ART-DIRECTION.md`를 기준으로 하며, 최신 구조 변경은 `GPT-HANDOFF-v0.1.30.md`와 v0.1.31 안정화 기록을 함께 확인합니다.

## v0.1.31 Iron Vein Boss Pass

철맥의 첨탑은 1~10F 구조이며 1~2F는 `SAFE`, 3~10F는 `PK_ELIGIBLE` 메타데이터를 사용합니다. 실제 서버 PvP는 아직 구현되지 않았습니다.

일반 몬스터는 1~10F 전체에서 같은 5종 pool을 사용하고, 층이 올라갈수록 runtime 스탯만 상승합니다.

- 고블린 광부
- 동굴 쥐
- 광산 박쥐
- 고블린 운반꾼
- 고블린 감독관

6~10F에는 다음 보스 slot과 production 전투 정의가 연결되어 있습니다.

- 6F `쇄철턱 굴혈수` — Charge
- 7F `흑맥갑주 파쇄충` — 흑맥 갑주, 균열 stack, 노출
- 8F `울림포식자` — 울림 stack 조건부 Charge
- 9F `심층 권양감독체` — Reactive counter + Charge
- 10F `철심 맥동체` — Shield + debuff + HP 조건 Charge

v0.1.31 안정화에서는 7F 보스가 플레이어의 첫 행동 전에 `흑맥 갑주`를 가진 상태로 시작하도록 production encounter를 보정하고, 6~10F 보스 회귀 테스트를 추가합니다.

## 포션

현재 canonical potion은 5종입니다.

- T1 `healing_lesser` — 하급 회복, 최대 HP 20%
- T2 `healing_standard` — 중급 회복, 최대 HP 35%
- T3 `healing_greater` — 상급 회복, 최대 HP 50%
- T4 `healing_supreme` — 최상급 회복, 최대 HP 75%
- T5 `revival` — 회생, 치명 피해 시 사용 여부 선택 후 최대 HP 30%로 전투 재개

회복량은 현재 provisional balance입니다. 일반 회복 포션은 원정당 합계 30개, 회생 포션은 1개까지 휴대합니다.

회생 포션은 자동 사용하지 않습니다. 다단타, DOT, Reactive, Charge, event damage의 lethal resolution에서 `pendingRevival`을 저장하고 선택 이후 남은 continuation만 재개합니다.

## 저장

메인 저장 키는 계속 `tower-record-v1`을 사용합니다.

현재 저장 스키마는 `v21`이며, v20의 50층 저장을 10층 구조로 이전합니다. 11~50F에 남아 있던 입장권 수량은 현재 migration code 기준으로 10F 입장권에 합산해 영구 자산을 조용히 삭제하지 않습니다.

주요 backup key:

- `tower-record-v1-before-manual-import`
- `tower-record-v1-before-potions-v20`
- `tower-record-v1-before-tower-structure-v21`

## 실제 구현 상태

### Production

- 철맥의 첨탑 1~10F
- 1~2F SAFE / 3~10F PK_ELIGIBLE metadata
- 1~10F 공통 일반 몬스터 pool + floor runtime scaling
- 6~10F 철맥 보스 definition / skill / AI / encounter mapping
- 수동 1대1 턴제 전투
- Charge / Reactive / Shield / stack threshold / status AI
- 회복 포션 4종 + 선택형 회생 포션
- 임시 원정 전리품과 생환 확정
- 장비 4슬롯, 제작, 숙련도, 인벤토리, 프리셋
- 로컬 거래소 / 조합 prototype
- JSON save export/import와 save migration

### 아직 미구현 또는 콘텐츠 미완성

- production 일반 랜덤 이벤트
- 실제 서버 PvP
- 붉은 송곳니 / 천광 / 칼레온 실제 전투 콘텐츠
- 확률형 장비 강화
- 사망 시 장비 파괴
- 25개 직업의 실제 combat kit
- 온라인 서버 / 로그인 / DB / authoritative economy

직업 25종은 현재 catalog만 존재하며 전투 kit는 `CATALOG_ONLY` 상태입니다.

## 개발 명령

```sh
npm ci
npm test
npm run typecheck
npm run build
node scripts/standalone.mjs
```

GitHub Actions는 Node.js 22.20.0에서 `npm test`, `typecheck`, production build를 자동 실행합니다.

### standalone asset 주의

`node scripts/standalone.mjs`는 `public/assets`를 루트 `assets`로 복사합니다. 과거 `.gitignore`의 `assets/` 규칙이 `public/assets`까지 제외할 수 있었기 때문에 v0.1.31 안정화에서 generated root `/assets/`만 ignore하도록 수정합니다.

따라서 로컬에 있는 `public/assets` 원본이 GitHub에 아직 올라오지 않았다면 CI에서는 standalone 검증을 건너뜁니다. source asset을 GitHub에 한 번 commit한 이후부터 standalone 검증도 자동 실행됩니다.

## 주요 구조

- `src/main.tsx` — 앱 상태와 화면 연결
- `src/game/data` — 탑, 몬스터, 밸런스, 그래픽 데이터
- `src/game/engine` — 전투, 원정, 효과, 보상, 제작
- `src/game/events` — 이벤트 engine / selector / catalog
- `src/game/jobs` — 직업 catalog와 runtime 기반
- `src/storage/repository.ts` — 저장 검증, backup, migration, import/export
- `src/components` — 전투, 이벤트, 인벤토리, 거래소, 조합 UI
- `tests` — 자동 회귀 테스트
- `.github/workflows/ci.yml` — GitHub 자동 검증

## 다음 콘텐츠 업데이트

v0.1.31 안정화 완료 후 다음 신규 콘텐츠 목표는 `v0.1.32 Exploration Events`입니다. 먼저 모든 탑에서 재사용 가능한 공통 이벤트 catalog를 정리한 뒤 각 탑 전용 이벤트를 확장합니다.
