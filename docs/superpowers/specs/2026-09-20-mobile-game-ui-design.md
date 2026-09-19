# 《탑의 기록》 모바일 게임 UI 디자인 시스템 Spec

**문서 상태:** Draft for review  
**작성일:** 2026-09-20  
**대상:** React 19 + TypeScript + Vite 기반 《탑의 기록》 전체 모바일 UI  
**기준 브랜치:** `codex/v0.1.36-battle-fx`

---

## 1. 목적

《탑의 기록》의 UI를 "모바일 화면에 맞춘 웹페이지"가 아니라 **처음부터 모바일 게임으로 설계된 인터페이스**로 재구성한다.

이 문서의 목적은 앞으로 거점, 가방, 거래소, 조합, 제작, 장비, 원정 준비, 전투, 설정 등 모든 화면에서 동일하게 적용할 **레이아웃 규칙, 터치 규칙, 정보 계층, 내비게이션, 페이지 전환, Figma/React 연결 규칙**을 고정하는 것이다.

이번 UI 개편의 성공 기준은 단순히 세로 스크롤을 없애는 것이 아니다. 사용자가 휴대폰을 세로로 들었을 때 각 화면의 핵심 행동이 즉시 보이고, 글자와 버튼 크기가 유지되며, 긴 정보는 화면 축소가 아니라 탭·페이지·상세 패널로 분리되어야 한다.

---

## 2. 제품 원칙

### 2.1 Mobile Game First

모든 화면은 브라우저 문서가 아니라 **한 장의 게임 화면**으로 취급한다.

- 앱의 기본 기준은 세로형 스마트폰이다.
- 화면 높이는 `100dvh`를 사용한다.
- 페이지 전체의 세로 스크롤은 사용하지 않는다.
- 브라우저 주소창이 접히거나 펼쳐져도 현재 보이는 viewport 안에 UI가 유지되어야 한다.
- 데스크톱은 모바일 UI를 중앙에 표시하는 보조 환경이며 별도 데스크톱 전용 정보 구조를 만들지 않는다.

### 2.2 No Global Scale

**전체 UI 자동 축소는 금지한다.**

금지 대상:

- 화면 전체에 `transform: scale(...)` 적용
- 콘텐츠가 넘친다는 이유로 글씨와 버튼을 자동 축소
- React 자식을 임의로 분할한 뒤 남은 공간에 맞춰 축소
- 기기 높이에 따라 모든 요소의 크기를 비례 축소

현재의 `MobileScreenPager`에서 사용하는 자동 `scale()` 접근은 제거 대상이다.

공간이 부족할 때 해결 순서는 다음과 같다.

1. 부가 설명 제거 또는 축약
2. 화면 전용 탭으로 분리
3. 목록 페이지네이션
4. 상세 정보를 sheet/modal로 이동
5. 화면 자체를 다음 단계 화면으로 분리

### 2.3 One Screen, One Primary Purpose

한 화면에는 **주요 목적 하나**를 둔다.

예:

- 거점: 다음 행동 선택
- 가방: 보유 아이템 탐색
- 장비: 현재 장비 확인/교체
- 제작: 제작 대상 선택
- 거래소: 거래 상품 탐색
- 원정 준비: 원정 조건 설정
- 전투: 행동 선택
- 조합: 조합 정보/관리

한 화면 안에 여러 시스템의 전체 기능을 동시에 펼쳐놓지 않는다.

---

## 3. 기준 디바이스와 안전 영역

### 3.1 Reference Canvas

Figma 기준 프레임:

```text
390 × 844
Portrait
```

이는 절대 크기 고정값이 아니라 디자인 기준점이다.

### 3.2 Supported Viewport

우선 지원 범위:

```text
width: 320px ~ 480px
height: 640px ~ 1000px
portrait
```

### 3.3 Safe Area

다음 safe-area를 항상 고려한다.

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

상단 HUD와 하단 내비게이션의 실제 콘텐츠는 notch, gesture area와 겹치지 않아야 한다.

---

## 4. 전체 앱 셸

전투 이외의 기본 화면 구조:

```text
┌────────────────────────┐
│ Global HUD             │
│ 재화 / 상태 / 계정      │
├────────────────────────┤
│ Screen Header          │
│ 화면명 / 핵심 상태      │
├────────────────────────┤
│                        │
│ Screen Content         │
│ 화면별 핵심 기능        │
│                        │
├────────────────────────┤
│ Local Actions          │
│ 탭 / 페이지 / 주요 행동 │
├────────────────────────┤
│ Bottom Navigation      │
│ 거점 가방 거래소 ...    │
└────────────────────────┘
```

### 4.1 Global HUD

Global HUD는 모든 비전투 화면에서 크기와 위치를 고정한다.

포함 정보:

- 게임 로고/간단한 현재 상태
- Silver
- Gold
- 필요 시 황금기록자 상태 또는 메뉴 진입 버튼

금지:

- 긴 설명
- 시스템 알림 여러 줄
- 화면별 세부 정보

### 4.2 Screen Header

각 화면의 정체성을 표시한다.

구성:

- 화면명
- 1개의 보조 정보
- 필요 시 뒤로가기

예:

```text
모험가의 가방
보유 28종
```

### 4.3 Screen Content

화면별 핵심 영역이다.

이 영역만 화면마다 구조가 달라진다.

### 4.4 Local Actions

해당 화면 안에서만 필요한 UI:

- 카테고리
- 페이지 번호
- 정렬
- 주요 확인/제작/입장 버튼

### 4.5 Bottom Navigation

현재 실제 내비게이션 순서를 유지한다.

```text
거점
가방
거래소
조합
제작
장비
```

규칙:

- 항상 화면 하단에 고정
- safe-area 포함
- 탭당 최소 터치 영역 44px 이상
- 현재 탭은 따뜻한 황동/갈색 accent
- 비활성 탭은 회갈색/철색
- 텍스트 + 아이콘
- 아이콘만으로 의미를 전달하지 않는다
- 탭 간 수직 구분선 허용
- 네온 glow 금지

---

## 5. 터치와 입력 규칙

### 5.1 Minimum Touch Target

주요 인터랙션 목표:

```text
최소 44 × 44 CSS px
권장 48 × 48 CSS px
```

텍스트나 아이콘 자체가 작더라도 실제 버튼 hit area는 이 기준을 충족해야 한다.

### 5.2 Spacing

인접 주요 터치 요소 사이 최소 시각 간격:

```text
6px 이상
권장 8px
```

### 5.3 Primary Action

한 화면에 동시에 강조되는 primary action은 원칙적으로 하나만 둔다.

예:

- 탐사 시작
- 제작
- 매수 주문
- 장착

보조 행동은 secondary 또는 icon action으로 낮춘다.

---

## 6. 타이포그래피

기준:

- 화면 제목: 20~24px
- 섹션 제목: 14~17px
- 기본 본문: 12~14px
- 보조 정보: 10~12px
- 매우 작은 메타 정보: 최소 9px

금지:

- 공간이 부족하다는 이유로 8px 이하의 핵심 정보 사용
- 자동 scale로 폰트 크기 감소
- 한 화면에 장문의 설명 문단 여러 개

설명문은 게임 플레이에 꼭 필요한 정보만 남기고, 세부 설명은 상세창으로 이동한다.

---

## 7. 시각 언어

### 7.1 Core Art Direction

《탑의 기록》의 UI 스타일:

- retro 2D dark fantasy
- 저채도
- 낡은 철
- 오래된 목재
- 가죽
- 양피지
- 닳은 황동
- 어두운 석재
- 억제된 붉은 갈색

### 7.2 금지 스타일

- neon blue/purple
- glossy mobile fantasy
- 과도한 glassmorphism
- 둥글고 밝은 SaaS 카드
- 현대적인 흰색 웹 대시보드
- 과도한 gradient
- 높은 채도의 보라/청록 accent

### 7.3 Hierarchy

시각 계층:

```text
1. Primary Action
2. 현재 선택/현재 상태
3. 핵심 수치
4. 목록 정보
5. 설명/세계관 문구
```

세계관 문구가 조작 요소보다 더 강하게 보여서는 안 된다.

---

## 8. 공통 컴포넌트

Figma와 React 양쪽에서 다음 이름을 기준으로 한다.

### 8.1 Layout

- `GameShell`
- `GlobalHud`
- `ScreenHeader`
- `ScreenContent`
- `BottomNav`
- `SafeAreaFrame`

### 8.2 Navigation

- `SegmentTabs`
- `CategoryTabs`
- `PageStepper`
- `BackButton`

### 8.3 Content

- `GamePanel`
- `ItemSlot`
- `ItemCard`
- `StatChip`
- `StatusBadge`
- `CurrencyChip`

### 8.4 Overlay

- `BottomSheet`
- `ConfirmModal`
- `TooltipPanel`
- `Toast`

### 8.5 Actions

- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `DangerButton`

---

## 9. 목록 처리 규칙

### 9.1 Vertical Page Scroll 금지

게임 메인 화면에서는 목록 때문에 body/main이 세로로 움직이지 않는다.

### 9.2 Pagination

긴 목록은 페이지 단위로 나눈다.

권장 기본값:

- 인벤토리 슬롯: 기기 높이에 따라 12~20칸
- 거래소 상품: 4~6행
- 직업 카드: 4~6개
- 장비 후보: 4~6개
- 조합원/로그: 4~6행

PageStepper:

```text
← 이전     2 / 5     다음 →
```

### 9.3 Internal Horizontal Scroll

가로 카테고리 탭은 제한적으로 허용한다.

허용 예:

- 인벤토리 카테고리
- 제작 분야

단, 현재 선택 탭은 항상 화면에 보이도록 자동 정렬한다.

---

## 10. 상세 정보 규칙

목록에서 하나를 선택했을 때 전체 화면을 길게 확장하지 않는다.

우선순위:

1. BottomSheet
2. Detail Screen
3. ConfirmModal

예:

인벤토리:

```text
아이템 슬롯 선택
→ BottomSheet
→ 아이템명 / 등급 / 효과 / 장착
```

거래소:

```text
상품 선택
→ 상품 상세 화면
→ 호가 / 주문
```

---

## 11. 화면별 구조

## 11.1 거점

목적:

**다음 행동을 빠르게 선택한다.**

기본 구조:

```text
Global HUD
↓
현재 캐릭터 요약
- 외형
- 무기
- HP / 공격 / 방어
↓
큰 Primary Card
[탑으로 떠나기]
↓
Quick Actions
직업 / 외형 / 저장 / 숙련
↓
Bottom Nav
```

현재의 긴 "원정의 순환" 설명과 여러 wide-link를 세로로 쌓는 방식은 제거한다.

## 11.2 가방

목적:

**아이템을 빠르게 찾고 확인한다.**

구조:

```text
Screen Header
검색 / 정렬
Category Tabs
4-column Item Grid
PageStepper
Bottom Nav
```

아이템 상세는 BottomSheet.

절대 금지:

- 아이템 수에 따라 화면 길이 증가
- grid 전체 세로 스크롤

## 11.3 장비

목적:

**현재 장비 상태를 한눈에 보고 교체한다.**

기본 화면:

```text
        무기

갑옷   캐릭터   장신구

        신발
```

추가:

- 핵심 전투 수치 3~4개
- 슬롯 선택 → 해당 장비 목록 sheet 또는 sub-screen
- 장비 숙련도는 별도 tab/detail

현재처럼 장비 카테고리별 모든 아이템을 한 페이지에 연속 출력하지 않는다.

## 11.4 제작

목적:

**무엇을 제작할지 선택하고 필요한 재료를 확인한다.**

구조:

```text
분야 Tabs
등급 Selector
보유 재료
Recipe Cards 2~4개
PageStepper
Primary Craft Action
```

사용자 표시 용어는 재료/제작 단계에서 가능한 한 **등급**을 사용한다.

한 페이지에 모든 제작법을 출력하지 않는다.

## 11.5 거래소

목적:

**상품 탐색과 주문을 분리한다.**

Browse:

```text
상품 / 내 주문 / 내 거래
검색
카테고리
상품 4~6행
PageStepper
```

상품 Detail:

```text
상품 정보
최근 가격 / 최고 매수 / 최저 매도
간결한 호가
매수 / 매도 Tabs
주문 입력
Primary Action
```

차트와 거래 내역이 필요할 경우 별도 "통계" 화면 또는 tab으로 분리한다.

## 11.6 조합

조합 미가입:

```text
조합 소개
가입/창설 선택
등록 조합 일부
PageStepper
```

조합 가입 후:

```text
조합 요약
공지
조합원 / 활동 / 관리 Tabs
콘텐츠 영역
```

조합원, 활동 기록, 관리 폼을 동시에 세로로 나열하지 않는다.

## 11.7 원정 준비

현재 가장 정보량이 많은 화면 중 하나이므로 3-tab 구조로 분리한다.

```text
[원정] [장비] [소모품]
```

원정 tab:

- 탑
- 목표 층
- 입장 허가증
- 위험도
- 시작 버튼

장비 tab:

- 장비 4슬롯
- 프리셋

소모품 tab:

- 포션 휴대량
- 회생 포션
- 가방 제한

Primary `탐사 시작`은 각 tab에서 접근 가능하되 최종 validation은 동일하다.

## 11.8 직업

25개 직업을 한 번에 세로 출력하지 않는다.

구조:

```text
희귀도 Tabs
Job Card 4~6개
PageStepper
선택된 직업 Detail
```

## 11.9 외형 / 칭호

```text
[외형] [칭호]
```

각 tab은 grid/list + page 구조.

## 11.10 저장 관리

기능이 적으므로 한 화면에 유지한다.

- 내보내기
- 불러오기
- 현재 버전
- 짧은 경고

장문의 설명은 제거하거나 modal 도움말로 이동.

---

## 12. 전투 화면

전투는 별도 immersive screen으로 유지한다.

필수:

- `100dvh`
- 페이지 스크롤 없음
- 전투 배경/HUD/행동 덱 한 화면
- 피격 시 캐릭터만 흔들림
- BattleFxQueue presentation 유지
- 활 2타 시각적 분리
- Reactive 실제 sequence 유지

전투 UI는 일반 `GameShell`의 콘텐츠 레이아웃을 따르지 않아도 된다.

---

## 13. 이벤트 화면

이벤트는 전투와 마찬가지로 immersive sub-screen으로 취급한다.

구조:

```text
Event HUD
Event Art
Event Story
Choices
Rewards / Result
```

한 화면에 들어가지 않는 긴 서사 텍스트를 만들지 않는다.

이벤트 설명이 긴 경우 텍스트를 축약하거나 단계형 event page로 나눈다.

페이지 전체 스크롤은 사용하지 않는다.

---

## 14. 반응형 규칙

### 14.1 Width 대응

320~359px:

- gutter 8~10px
- 4열 인벤토리 유지 가능 여부 확인
- 버튼 텍스트 축약 허용
- 설명 문구 우선 제거

360~419px:

- 기본 레이아웃

420~480px:

- gutter 확대
- 콘텐츠 폭만 넓어지고 버튼/폰트를 과도하게 키우지 않는다

### 14.2 Height 대응

640~719px:

- 부가 설명 제거
- 행 수 감소
- 페이지당 아이템 수 감소

720~899px:

- 기본

900px 이상:

- 같은 정보 구조 유지
- 빈 공간은 artwork/spacing으로 사용
- 한 페이지에 더 많은 정보를 강제로 추가하지 않는다

---

## 15. 상태와 피드백

모든 화면은 최소 다음 상태를 디자인한다.

- default
- selected
- disabled
- locked
- loading
- empty
- error
- success

### 15.1 Empty State

빈 상태는 짧아야 한다.

예:

```text
보유한 스킬북이 없습니다.
```

긴 튜토리얼 설명을 empty state에 넣지 않는다.

### 15.2 Toast

짧은 작업 결과:

- 장착 완료
- 제작 시작
- 주문 등록
- 저장 완료

화면 구조를 밀어내지 않고 overlay로 표시한다.

---

## 16. 접근성

- 주요 터치 영역 44px 이상
- 색만으로 상태를 구분하지 않는다
- selected/locked 상태는 아이콘/텍스트/테두리를 함께 사용
- contrast가 너무 낮은 장식 텍스트를 핵심 정보에 사용하지 않는다
- `prefers-reduced-motion` 지원
- 이미지 버튼에 접근 가능한 label 제공
- modal/sheet 열릴 때 focus 관리
- dismiss 가능한 overlay는 명확한 닫기 동작 제공

---

## 17. Figma 규칙

파일:

```text
Tower Chronicles — Mobile UI
```

Starter 3-page 제한을 고려해 페이지를 다음처럼 구성한다.

```text
00 Foundations + Components
01 Core Screens
02 Flows + Dev Handoff
```

### 17.1 Foundations

Variables:

- colors
- spacing
- border
- typography
- safe-area
- component sizes

### 17.2 Components

모든 공통 UI를 Component / Variant로 만든다.

예:

```text
BottomNavItem/state=default|active
GameButton/type=primary|secondary|danger
ItemSlot/state=default|selected|equipped|locked
PageStepper/state=middle|first|last
Tab/state=default|active|disabled
```

### 17.3 Screen Naming

```text
SCREEN/Home
SCREEN/Inventory
SCREEN/Equipment
SCREEN/Crafting
SCREEN/Market
SCREEN/Association
SCREEN/ExpeditionPrep
SCREEN/Battle
```

상태:

```text
SCREEN/Inventory/ItemSelected
SCREEN/Market/ProductDetail
SCREEN/ExpeditionPrep/Consumables
```

---

## 18. React/CSS 아키텍처

### 18.1 제거 대상

- `MobileScreenPager`의 자동 React child grouping
- `FitPage`
- `ResizeObserver` 기반 전체 콘텐츠 scale
- 페이지마다 DOM 길이에 의존하는 layout
- body/main vertical scrolling

### 18.2 추가 대상

권장 구조:

```text
src/components/mobile/
  GameShell.tsx
  GlobalHud.tsx
  BottomNav.tsx
  ScreenHeader.tsx
  PageStepper.tsx
  BottomSheet.tsx
  SegmentTabs.tsx
  mobile-shell.css
```

화면별 컴포넌트가 직접 pagination state와 표시 개수를 관리한다.

### 18.3 Pagination State

페이지 번호는 UI state다.

- save schema에 저장하지 않는다.
- 화면을 벗어나면 page 1로 초기화 가능.
- item selection/detail state 역시 기본적으로 local UI state.

게임 영구 데이터와 UI navigation state를 분리한다.

---

## 19. 기존 게임 로직 보호 규칙

UI 개편으로 변경하면 안 되는 것:

- save schema v21
- 전투 계산식
- BattleFx collector sequence
- boss AI
- 부활 파이프라인
- 아이템 수량
- 제작 비용
- 재료 드롭
- 거래소 체결 로직
- 조합 데이터 모델
- 원정 보상 확정 규칙

UI는 기존 데이터를 **다르게 표현하고 탐색하게 하는 계층**이다.

---

## 20. 구현 우선순위

다음 순서로 진행한다.

```text
1. Global GameShell
2. Bottom Navigation
3. Home / 거점
4. Inventory / 가방
5. Equipment / 장비
6. Craft / 제작
7. Market / 거래소
8. Expedition Prep / 원정 준비
9. Association / 조합
10. Jobs / 직업
11. Cosmetics
12. Settings
13. Event screen
14. Battle final polish
```

각 화면은 다음 화면으로 넘어가기 전에 실제 휴대폰 viewport에서 검증한다.

---

## 21. Acceptance Criteria

전체 UI 개편은 아래 조건을 모두 만족해야 한다.

### Global

- [ ] 320×640 이상 세로형 viewport에서 body/page 세로 스크롤이 없다.
- [ ] 전체 UI에 자동 `scale()`이 적용되지 않는다.
- [ ] Global HUD + 화면 콘텐츠 + Bottom Nav가 현재 viewport 안에 들어간다.
- [ ] 주요 버튼의 실제 hit area가 44px 이상이다.
- [ ] safe-area를 침범하지 않는다.
- [ ] 화면마다 primary purpose가 하나다.

### Lists

- [ ] 인벤토리, 거래소, 장비, 직업 등 긴 목록은 페이지네이션 또는 tab으로 처리된다.
- [ ] 사용자가 목록 끝을 보기 위해 세로 swipe할 필요가 없다.
- [ ] 페이지 전환 시 현재 페이지와 전체 페이지 수를 확인할 수 있다.

### Detail

- [ ] 아이템 상세는 sheet/detail screen에서 열린다.
- [ ] 상세 정보가 목록의 높이를 늘리지 않는다.

### Visual

- [ ] 저채도 dark fantasy 스타일을 유지한다.
- [ ] 네온/glossy SaaS 스타일이 없다.
- [ ] 현재 선택 상태와 primary action이 명확하다.

### Engineering

- [ ] save schema 변경 없음.
- [ ] 기존 game engine tests 통과.
- [ ] mobile UI tests 추가.
- [ ] `npm test` 통과.
- [ ] `npm run typecheck` 통과.
- [ ] `npm run build` 통과.
- [ ] GitHub Pages 모바일 실기기 검증 완료.

---

## 22. Reference Basis

디자인 판단 시 다음 자료를 참고하되 그대로 복제하지 않는다.

- Apple Human Interface Guidelines — Designing for Games
- Apple WWDC game UI layout guidance
- Android accessibility / touch target guidance
- Game UI Database
- Interface In Game
- Figma Community dark RPG UI systems

레퍼런스는 **정보 구조, 터치 영역, 계층, 모바일 화면 구성**을 참고하는 용도이며 시각 요소를 복제하지 않는다.

---

## 23. 결정 사항 요약

이 spec이 승인되면 다음 사항은 기본 규칙으로 고정한다.

1. 《탑의 기록》은 mobile-game-first UI다.
2. body/main vertical scroll은 사용하지 않는다.
3. 전체 화면 자동 scale은 사용하지 않는다.
4. 긴 목록은 page/tab/detail로 분리한다.
5. 각 화면은 전용 정보 구조를 가진다.
6. Global HUD와 Bottom Nav는 공통 shell로 관리한다.
7. 전투와 이벤트는 immersive screen 예외로 관리한다.
8. UI 개편은 게임 엔진과 save schema를 변경하지 않는다.
9. Figma component naming과 React component naming을 가능한 한 대응시킨다.
10. 화면 하나를 완성할 때마다 실제 모바일 viewport에서 검증한 뒤 다음 화면으로 넘어간다.
