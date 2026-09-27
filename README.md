# 탑의 기록 v0.1.56

《탑의 기록》(Tower Chronicles)은 네 개의 고대 탑을 중심으로 성장한 자유상업도시 노바르를 배경으로 하는 모바일 세로형 다크 판타지 수동 턴제 RPG 프로토타입입니다.

- 앱 버전: `0.1.56`
- 저장 스키마: `v22`
- 기술: React 19, TypeScript, Vite
- 저장: 브라우저 local cache + Supabase revisioned cloud save
- 현재 실제 플레이 가능 탑: `철맥의 첨탑`, `붉은 송곳니의 성소`, `천광의 수정탑`
- 메인 저장 키: `tower-record-v1`

실제 동작이 문서와 충돌할 경우 production code, Supabase production schema와 자동 테스트가 우선입니다.

## v0.1.56 — 거래소 UI V3 · Figma 레퍼런스 보정

Figma Community의 Crypto Trading App UI Kit의 실제 Market / Coin page / Buy / Sell 프레임을 분석해 거래소의 정보 위계와 입력 흐름을 2차 보정했습니다.

- 시장 목록을 카드형 시세 리스트로 정리
- 실제 최근 체결가를 이용한 미니 가격 추이선 추가
- 상세 화면 상단에 최근 체결가와 변동률을 크게 표시
- 최저 판매가 / 최고 구매가를 보조 시세로 정리
- 주문장 기능과 서버 권위 지정가 주문 로직은 그대로 유지
- 수량 입력에 10 / 25 / 50 / 75 / MAX 비율 프리셋 추가
- 최근 체결 추이의 저가 / 고가 / 현재가 표시
- 700px / 620px 이하와 360px 이하 모바일 압축 규칙 보강
- Figma의 암호화폐 이미지/아이콘 에셋은 가져오지 않고 기존 Glyph와 CSS만 사용

## v0.1.55 — 거래소 UI V2

- 거래소 상단 구조를 `시장 / 내 주문 / 보관함` 3탭으로 단순화
- 구매/판매를 목록 단계에서 분리하지 않고 아이템 상세 주문서 안으로 이동
- 시장 목록에서 최저 판매가(ASK), 최고 구매가(BID), 보유 수량을 동시에 표시
- 카테고리 필터와 페이지 이동을 추가해 7개 초과 품목도 접근 가능
- 아이템 상세에 통합 주문장, 수량 기반 depth bar, 최근 체결 3건, 매수/매도 주문서를 한 화면에 배치
- 내 주문에 부분 체결 진행률 표시
- 보관함 상단에 판매대금/구매물품 합계와 모두 수령 버튼 제공
- 온라인 서버 거래소와 로컬 거래소가 같은 정보 구조를 사용
- 700px / 620px 이하 높이와 360px 이하 폭에 별도 모바일 압축 규칙 적용
- 외부 UI 이미지 에셋 없이 CSS/기존 Glyph만 사용

## v0.1.54 — 직능등록 V1 완료

- 서버 권위 직능등록 RNG: C 51% / B 30% / A 13% / SR 5% / SSR 1%
- 1회 100 Gold, 10+1 1,000 Gold
- SR/SSR 집중 열람 50:50, 천장·실패 보정 없음
- 직능 기록 10 해금 / 30 ★★ / 60 ★★★
- ★★★ 초과 기록은 등급별 잔여 기록으로 변환
- 잔여 기록 → 원하는 직능 기록 +1 교환
  - C 5 / B 10 / A 20 / SR 50 / SSR 160
  - 등급 공용 한도: C 10/주, B 8/주, A 5/주, SR 2/주, SSR 1/월
- 잔여 기록 30 → 협회 추천장 1장, 주 3회
- 주간 초기화는 월요일 00:00 KST, SSR 월간 초기화는 매월 1일 00:00 KST
- 직능등록 화면에 등록 / 직능기록 / 확률정보 탭 제공

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
- 온라인 거래소 / 로컬 조합 prototype
- Google 로그인 / revisioned cloud save / active session lock
- 서버 권위 경제 / 거래소 / 원정 / 전투 / 탐사 / 제작 / 강화
- 서버 권위 직능등록 / 기록 성장 / 잔여 기록 교환 / 협회 추천장 변환
- JSON save export/import와 migration
- 데이터 기반 직업 전투 framework와 일부 COMBAT_READY 직업

### 아직 미구현 또는 콘텐츠 미완성

- 칼레온의 녹빛 첨탑 실제 몬스터 콘텐츠 및 입장 개방
- production 일반 랜덤 이벤트
- 실제 서버 PvP
- Gold Exchange
- 원정단 점령전
- 전체 직업의 실제 combat kit
- 천광 일부 전용 몬스터/보스 스프라이트 보강

## 저장

현재 저장 스키마는 `v22`입니다.

v0.1.54는 클라이언트 저장 스키마를 변경하지 않습니다. 직능 기록·잔여 기록·추천장·교환 한도는 Supabase private schema의 서버 권위 데이터로 저장됩니다.

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
