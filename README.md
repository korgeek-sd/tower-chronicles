# 탑의 기록 v0.1.44

《탑의 기록》(Tower Chronicles)은 네 개의 고대 탑을 중심으로 성장한 자유상업도시 노바르를 배경으로 하는 모바일 세로형 다크 판타지 수동 턴제 RPG 프로토타입입니다.

- 앱 버전: `0.1.44`
- 저장 스키마: `v22`
- 기술: React 19, TypeScript, Vite
- 저장: 브라우저 `localStorage`
- 현재 실제 플레이 가능 탑: `철맥의 첨탑`, `붉은 송곳니의 성소`, `천광의 수정탑`
- 메인 저장 키: `tower-record-v1`

실제 동작이 문서와 충돌할 경우 production code와 자동 테스트가 우선입니다. 최신 개발 상태는 `GPT-HANDOFF-v0.1.44.md`를 확인합니다.

## v0.1.44 — 붉은 송곳니의 성소 개방 + 일반 몬스터 전투 패스

이번 버전에서 붉은 송곳니의 성소가 탑 선택 화면에서 실제 플레이 가능 상태가 되었습니다.

### 탑 구조

- 1~10F
- 1~2F: SAFE
- 3~10F: PK_ELIGIBLE metadata
- 6~10F: 보스 슬롯
- 1~10F 일반 몬스터는 동일한 5종 pool을 사용하고 층별 runtime stat scaling만 적용

### 일반 몬스터 5종

- `황야 멧돼지` — 방어 강화 + Charge
- `가시 자칼` — 송곳니 출혈 + 상처 대상 추격
- `썩은날 독수리` — 방어 약화 + 2연타
- `가죽 갉는 하이에나` — 출혈 누적 + 조건부 강타
- `무리 선봉` — Reactive 반격 + 공격 강화 + Charge

일반 몬스터는 기존 Monster Combat Framework의 `damage`, `charge`, `reactive_prepare`, `effect`만 사용합니다. 신규 전투 엔진이나 별도 phase 시스템은 추가하지 않았습니다.

### 6~10F 보스

- 6F `핏갈기 추적자`
- 7F `붉은턱 가죽포식자`
- 8F `송곳니 무리어미`
- 9F `성소 발톱주교`
- 10F `적아의 주인`

보스 5종은 기존 production 정의를 그대로 사용합니다. Charge, 출혈 stack, Reactive, Shield, debuff, HP 조건 AI를 조합합니다.

### 생물록

붉은 송곳니의 성소는 현재 총 10종이 탐사 생물록에 등록됩니다.

- 일반 5종
- 보스 5종

전체 active catalog는 여전히 45종입니다.

- 철맥의 첨탑: 10종
- 붉은 송곳니의 성소: 10종
- 천광의 수정탑: 25종
- 칼레온의 녹빛 첨탑: 0종

## 천광 6F 정식 명칭 수정

천광의 수정탑 6F 보스 표시명을 정식 명칭인 `백정갑주 균열거수`로 통일했습니다.

boss id `white_crystal_armor_behemoth`와 전투 데이터는 변경하지 않았으므로 저장 호환성에는 영향이 없습니다.

## v0.1.43 — 장비 강화 v1

공방에서 제작 장비를 최대 +3까지 강화할 수 있습니다.

| 시도 | 성공 | 유지 | 1단계 하락 | 파괴 |
| --- | ---: | ---: | ---: | ---: |
| +0 → +1 | 50% | 50% | 0% | 0% |
| +1 → +2 | 35% | 40% | 20% | 5% |
| +2 → +3 | 20% | 35% | 30% | 15% |

- 성공/실패 모두 비용 소모
- 하락은 정확히 1단계
- 파괴된 장비는 영구 삭제
- 원정 중 / starter 장비 강화 불가
- 무기·갑옷·신발: +1당 +0 기여도의 10% 증가
- 장신구: 패시브 수치 증가, 발동 조건 유지
- 강화 장비는 인벤토리·전투·거래소·저장에서 identity 유지

## 현재 Production 구현 상태

### 구현됨

- 철맥의 첨탑 1~10F
- 붉은 송곳니의 성소 1~10F
- 천광의 수정탑 1~10F
- 수동 1대1 턴제 전투
- Charge / Reactive / Shield / DOT / HOT / Stack / status AI
- 전투 가독성 UI
- 탐사 생물록 45종 + 영구 진행도
- 장비 제작 / 강화 / 장비 숙련도 / 인벤토리 / 프리셋
- 회복 포션 4종 + 선택형 회생 포션
- 로컬 거래소 / 조합 prototype
- JSON save export/import와 migration
- 데이터 기반 직업 전투 framework와 일부 COMBAT_READY 직업

### 아직 미구현 또는 콘텐츠 미완성

- 칼레온의 녹빛 첨탑 실제 몬스터 콘텐츠 및 입장 개방
- production 일반 랜덤 이벤트
- 실제 서버 PvP
- 온라인 서버 / 로그인 / DB / authoritative economy
- Gold Exchange
- 원정단 점령전
- 직능 등록 / 확률형 등록 서버 RNG
- 전체 직업의 실제 combat kit
- 천광 일부 전용 몬스터/보스 스프라이트 보강

## 저장

현재 저장 스키마는 `v22`입니다.

v0.1.44는 새로운 persisted field를 추가하지 않습니다. Red Fang은 이미 존재하던 tower/ticket/progress/bestiary 구조와 monster ids를 사용하므로 migration은 없습니다.

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

- `src/game/data/redFang.ts` — 붉은 송곳니 일반/보스 슬롯 데이터
- `src/game/data/redCombat.ts` — 붉은 송곳니 일반 몬스터 전투 정의
- `src/game/engine/monsterAi.ts` — MonsterDefinition registry와 AI
- `src/game/data/bestiary.ts` — 탐사 생물록 catalog
- `src/storage/repository.ts` — 저장 검증, migration, import/export
- `tests` — 자동 회귀 테스트
- `.github/workflows/ci.yml` — GitHub 자동 검증
- `.github/workflows/deploy-pages.yml` — GitHub Pages 배포
