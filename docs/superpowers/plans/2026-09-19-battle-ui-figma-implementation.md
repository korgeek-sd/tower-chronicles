# Battle UI Figma → Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 《탑의 기록》 전투 화면을 Figma에 CURRENT/TARGET 구조로 설계하고, 상태/FX 명세를 React 19 + TypeScript + CSS 구현으로 연결해 GitHub Pages에서 검증한다.

**Architecture:** Figma를 시각 명세의 소스로 사용하되, 기존 전투 엔진과 `BattleFxQueue`는 그대로 재사용한다. 디자인 변경은 우선 `BattleScene.tsx`, `BattleScreen.tsx`, `battle.css`, 필요 시 `battleFxPresentation.ts`의 presentation 값에만 제한하고, 전투 계산·저장 스키마·보스 로직에는 손대지 않는다.

**Tech Stack:** Figma MCP, React 19, TypeScript, Vite 6, CSS, Node test runner, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-09-19-battle-ui-figma-design.md`

## Global Constraints

- save schema는 v21 유지.
- 전투 계산식, 보스 판정, 부활 파이프라인은 변경하지 않는다.
- 피격 흔들림은 전체 화면이 아니라 `player-figure` 또는 `monster-figure`에만 적용한다.
- 활 기본 공격의 엔진 의미는 1 Action / 2 Hits를 유지한다.
- 9F Reactive 시각 순서는 실제 collector sequence를 따른다.
- 기존 다크 판타지 픽셀아트 방향을 유지하고 네온/유광 스타일은 사용하지 않는다.
- `main` 브랜치는 수정하거나 병합하지 않는다.
- 구현은 `codex/v0.1.36-battle-fx` 계열 feature branch에서 진행한다.

## Review Focus

1. **전체 화면 흔들림 회귀** — 피격 시 `.battle-scene`, `.combat-stage`, 배경이 흔들리지 않고 대상 캐릭터 figure만 흔들리는지 확인한다.
2. **다중 타격 중복 제거 오류** — 동일 피해량의 활 2타가 서로 다른 playback ID로 모두 재생되는지 테스트한다.
3. **Reactive 순서 오류** — hit 1 → reactive counter → hit 2가 디자인과 실제 queue 순서에서 일치하는지 확인한다.
4. **FX/피해 숫자 겹침** — Actor FX와 DamageNumber가 동일 overlay에서 서로 가리거나 HUD를 침범하지 않는지 모바일 화면에서 확인한다.
5. **reduced motion 회귀** — `prefers-reduced-motion`에서 흔들림/팝 애니메이션은 제거되지만 정보성 FX/라벨은 여전히 인지 가능한지 확인한다.

---

### Task 1: Figma 작업 파일과 CURRENT 기준 화면 만들기

**Files:**
- External artifact: Figma file `Tower Chronicles — Battle UI`
- Reference: `src/components/battle/BattleScene.tsx`
- Reference: `src/components/battle/BattleScreen.tsx`
- Reference: `src/components/battle/battle.css`
- Reference: `src/components/battle/battleFxPresentation.ts`

**Interfaces:**
- Consumes: GitHub Pages 현재 전투 화면, 현재 React/CSS 구조
- Produces: Figma file key, CURRENT frame node id, 기본 페이지 구조

- [ ] **Step 1: 새 Figma Design 파일 생성**

Figma plan `team::1683137669287558155`에 `Tower Chronicles — Battle UI` 파일을 생성한다.

Expected:
- editor type: `design`
- 새 file key와 URL 확보

- [ ] **Step 2: Figma 파일 기본 구조 생성**

다음 페이지를 생성한다.

```text
00 Foundations
01 Components
02 Battle Screen
03 Battle States & FX
90 Dev Handoff
```

각 페이지 생성 후 반환된 page/node id를 기록한다.

- [ ] **Step 3: 현재 GitHub Pages 전투 화면을 CURRENT reference로 캡처**

Source URL:

```text
https://korgeek-sd.github.io/tower-chronicles/
```

전투 화면에 진입한 상태를 기준으로 첫 캡처를 생성하고 `02 Battle Screen` 아래에 `CURRENT / Battle Screen`으로 정리한다.

Expected:
- 현재 모바일 전투 레이아웃이 픽셀 기준으로 참조 가능
- 이미지/배경 asset이 Figma 안에 캡처되어 후속 TARGET 작성 시 reference로 사용 가능

- [ ] **Step 4: CURRENT 구조를 코드 컴포넌트에 매핑**

`90 Dev Handoff`에 다음 표를 작성한다.

```text
Battle/Scene        → BattleScene.tsx
Battle/Player       → PlayerLayer
Battle/Monster      → MonsterLayer
Battle/HUD          → CombatHud
Battle/ActorFx      → ActorFxLayer
Battle/DamageNumber → floating-number
Battle/ActionButton → BattleScreen action controls
```

- [ ] **Step 5: CURRENT 캡처와 실제 구현 구조 검증**

Figma screenshot과 GitHub Pages 렌더를 비교해 플레이어/몬스터 위치, HUD, 전투 카드 영역, FX overlay 위치가 기준점으로 충분한지 확인한다.

**Verification:** Figma screenshot에서 CURRENT frame이 현재 배포 화면과 동일한 주요 구조를 가진다.

---

### Task 2: Foundations와 재사용 가능한 전투 컴포넌트 설계

**Files:**
- External artifact: Figma `00 Foundations`, `01 Components`
- Reference: `src/components/battle/battle.css`
- Reference: `src/components/battle/BattleScene.tsx`

**Interfaces:**
- Consumes: Task 1의 Figma file key / CURRENT node
- Produces: 디자인 토큰, Battle 컴포넌트, variant set

- [ ] **Step 1: 기존 Figma 변수/스타일 존재 여부 조사**

대상 파일의 local variables, text styles, effect styles를 먼저 조사한다.

Expected:
- 새 파일이므로 기존 체계가 없다면 그 사실을 기록
- 존재할 경우 새 토큰을 중복 생성하지 않는다

- [ ] **Step 2: 전투 UI Foundations 생성**

최소 토큰 그룹:

```text
color/bg/battle
color/panel/iron
color/border/iron
color/text/primary
color/text/muted
color/accent/brass
color/hp/player
color/hp/enemy
color/fx/damage
color/fx/heal
color/fx/break

space/4
space/8
space/12
space/16

radius/panel
border/panel
```

값은 CURRENT 화면과 기존 `battle.css` 색을 기준으로 시작하고, TARGET에서 필요한 경우에만 조정한다.

- [ ] **Step 3: Battle/HUD 컴포넌트 생성**

Variant:

```text
side=player
side=monster
```

구성:
- 이름
- 현재 HP / 최대 HP
- HP bar
- optional title tag

Expected:
- 현재 `CombatHud` 구조와 1:1 매핑 가능

- [ ] **Step 4: Battle/ActorFx 컴포넌트 세트 생성**

Variant:

```text
slash
stab
arrow
magic_burst
heavy_hit
shield_hit
shield_cast
poison
bleed
armor_break
guard
haste
heal
```

FX는 캐릭터 artwork와 분리된 overlay component로 만든다.

- [ ] **Step 5: Battle/DamageNumber 컴포넌트 생성**

Variant:

```text
type=damage
type=heal
type=armor_break
type=shield
```

텍스트 예시:
- `-24`
- `+18`
- `갑주 파쇄`
- `보호막 12`

- [ ] **Step 6: Battle/Player, Battle/Monster shell 생성**

캐릭터 artwork 영역과 `ActorFx`, `DamageNumber` anchor를 분리한다.

Expected:
- shake 대상은 character artwork layer
- FX overlay는 shake 대상의 sibling/overlay
- 전체 Scene frame은 shake 대상이 아니다

- [ ] **Step 7: 컴포넌트 페이지 screenshot 검증**

잘린 텍스트, 과도한 대비, 픽셀아트와 맞지 않는 glossy effect가 없는지 확인한다.

**Verification:** 모든 핵심 Battle 컴포넌트가 독립 node/component로 존재하고 TARGET에서 재사용 가능하다.

---

### Task 3: TARGET 전투 화면과 상태/FX 시퀀스 설계

**Files:**
- External artifact: Figma `02 Battle Screen`, `03 Battle States & FX`
- Reference: `src/components/battle/battleFxPresentation.ts`
- Reference: `tests/battleFx.test.ts`

**Interfaces:**
- Consumes: Task 2 components/tokens
- Produces: TARGET screen node id, 상태별 frame node ids, 개발 handoff 값

- [ ] **Step 1: TARGET / Battle Screen 프레임 생성**

CURRENT와 동일한 모바일 기준 크기로 TARGET을 만든다.

원칙:
- 캐릭터 상대 배치는 유지
- HUD의 정보 계층만 더 명확하게
- FX 공간을 캐릭터 중심으로 확보
- 전투 카드 조작 영역은 기존 기능/순서를 유지
- dark iron / worn brass 시각 언어 유지

- [ ] **Step 2: Player Hit / Monster Hit 상태 생성**

각 상태에서:
- 대상 character artwork만 흔들림 표시
- 상대 캐릭터, HUD, background는 고정
- FX와 damage number anchor를 명확히 표시

- [ ] **Step 3: Bow Hit 1 / Bow Hit 2 상태 생성**

타이밍 annotation:

```text
Hit 1 = 0ms
Hit 2 = 110ms
```

두 hit가 독립 FX + 독립 damage label임을 표기한다.

- [ ] **Step 4: Reactive Counter 상태 시퀀스 생성**

순서:

```text
1. player hit 1 → monster
2. monster reactive counter → player
3. player hit 2 → monster
```

각 frame에 engine sequence와 target을 annotation으로 남긴다.

- [ ] **Step 5: Shield Hit / Armor Break / Heal / Boss Charge 상태 생성**

각 상태는 `BattleFxImpact` 이름과 동일한 명칭으로 관리한다.

- [ ] **Step 6: TARGET screenshot 검증**

CURRENT와 TARGET을 나란히 비교해:
- HUD 가독성
- 캐릭터 focal point
- FX 위치
- damage number 위치
- 모바일 safe spacing
을 확인한다.

**Verification:** Acceptance Criteria의 모든 상태가 Figma에서 독립적으로 확인 가능하다.

---

### Task 4: Figma Design Context를 코드 변경 명세로 변환

**Files:**
- Read: Figma TARGET node
- Read/Modify candidate: `src/components/battle/BattleScene.tsx`
- Read/Modify candidate: `src/components/battle/BattleScreen.tsx`
- Read/Modify candidate: `src/components/battle/battle.css`
- Read/Modify candidate: `src/components/battle/battleFxPresentation.ts`
- Test: `tests/battleFx.test.ts`

**Interfaces:**
- Consumes: TARGET node id + state node ids
- Produces: 실제 코드 변경 diff와 테스트 요구사항

- [ ] **Step 1: TARGET node의 Design Context 추출**

Figma에서 TARGET frame의:
- 레이아웃
- spacing
- color
- border
- typography
- asset references
를 읽는다.

- [ ] **Step 2: Figma 값과 현재 코드 매핑표 작성**

예:

```text
Figma Battle/HUD padding → .fighter-hud padding
Figma Player anchor       → .player-placement left/top
Figma Monster anchor      → .monster-placement left/top
Figma ActorFx size        → .actor-fx-layer .impact-fx width/height
Figma DamageNumber anchor → .actor-fx-layer .floating-number
```

- [ ] **Step 3: 엔진 변경이 필요한 항목을 거부하고 presentation 변경만 남긴다**

허용:
- CSS 치수/위치/색/테두리/타이밍
- React markup wrapper/class 정리
- `battleFxPresentation.ts`의 presentation-only lifetime/interval/impact mapping 조정

금지:
- damage formula
- save version
- boss AI
- inventory/economy
- combat outcome

**Verification:** 코드 변경 목록이 시각 표현 계층에만 머문다.

---

### Task 5: TARGET UI 구현 — 테스트 우선

**Files:**
- Modify: `src/components/battle/BattleScene.tsx`
- Modify: `src/components/battle/BattleScreen.tsx` only if TARGET hierarchy requires it
- Modify: `src/components/battle/battle.css`
- Modify: `src/components/battle/battleFxPresentation.ts` only if timing/presentation changes are confirmed
- Test: `tests/battleFx.test.ts`

**Interfaces:**
- Consumes: Task 4 code mapping
- Produces: TARGET-compatible React/CSS implementation

- [ ] **Step 1: 다중 타격/Reactive presentation 테스트를 먼저 고정**

기존 테스트를 유지하고 필요 시 다음 assertion을 추가한다.

```ts
test('bow hit sequence keeps two independent playback events', () => {
  // hit 1 / hit 2 must keep distinct playbackId and 110ms spacing
});

test('reactive sequence preserves engine emission order', () => {
  // monster, player, monster target order must not be reordered by UI batching
});
```

- [ ] **Step 2: 테스트를 실행해 현재 기준 통과 여부 확인**

Run:

```bash
npm test
```

Expected: PASS before visual-only implementation starts.

- [ ] **Step 3: BattleScene markup을 TARGET structure에 맞춰 최소 수정**

원칙:
- `ActorFxLayer` 유지
- `PlayerLayer` / `MonsterLayer` 유지
- hit animation key는 `playbackId` 기준 유지
- scene-wide shake class 추가 금지

- [ ] **Step 4: battle.css를 Figma TARGET token/spacing에 맞춘다**

반드시 보존:

```css
.player-figure.is-hit.shake-light
.monster-figure.is-hit.shake-light
.player-figure.is-hit.shake-normal
.monster-figure.is-hit.shake-normal
.player-figure.is-hit.shake-heavy
.monster-figure.is-hit.shake-heavy
```

그리고 `.battle-scene`, `.combat-stage`, `.scene-background`에는 hit shake animation을 추가하지 않는다.

- [ ] **Step 5: reduced-motion 동작 확인**

```css
@media(prefers-reduced-motion:reduce)
```

에서:
- motion animation은 제거
- 정보성 label/FX 자체는 읽을 수 있게 유지

- [ ] **Step 6: 테스트 실행**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 7: 구현 커밋**

```bash
git add src/components/battle tests/battleFx.test.ts
git commit -m "feat: align battle UI with Figma target"
```

---

### Task 6: GitHub Pages 배포와 Figma 시각 QA

**Files:**
- Existing workflow: `.github/workflows/pages.yml`
- External artifact: Figma `90 Dev Handoff`

**Interfaces:**
- Consumes: Task 5 commit
- Produces: 배포 URL + QA 결과 + 최종 Figma handoff

- [ ] **Step 1: GitHub Actions CI 확인**

확인 항목:
- tests
- typecheck
- production build

Expected: 모두 success.

- [ ] **Step 2: GitHub Pages deploy 확인**

URL:

```text
https://korgeek-sd.github.io/tower-chronicles/
```

Expected: TARGET UI가 feature branch 배포본에 반영된다.

- [ ] **Step 3: 배포된 전투 화면을 Figma에 IMPLEMENTED reference로 다시 캡처**

`02 Battle Screen`에:

```text
CURRENT
TARGET
IMPLEMENTED
```

세 프레임을 나란히 둔다.

- [ ] **Step 4: TARGET vs IMPLEMENTED 시각 QA**

검증:
- 캐릭터 위치
- HUD 높이/패딩
- FX 중심점
- damage label 위치
- bow 2-hit 시간차
- Reactive 시퀀스
- 캐릭터-only shake
- reduced motion

- [ ] **Step 5: 90 Dev Handoff에 최종 상태 기록**

기록:
- Figma TARGET node id
- 구현 commit SHA
- GitHub Actions run URL
- GitHub Pages URL
- 알려진 시각 차이 0개 또는 남은 차이

- [ ] **Step 6: 최종 검증 후 완료 보고**

완료 선언은 실제 Actions 성공과 Pages 배포 확인 뒤에만 한다.
