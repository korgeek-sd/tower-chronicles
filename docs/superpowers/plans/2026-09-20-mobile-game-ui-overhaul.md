# 《탑의 기록》 Mobile Game UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 《탑의 기록》의 모든 주요 화면을 웹페이지형 세로 레이아웃에서 320×640 이상 세로형 스마트폰에서 스크롤 없이 동작하는 전용 모바일 게임 UI로 재구성한다.

**Architecture:** 기존 게임 엔진과 save schema v21은 유지하고 presentation/navigation 계층만 교체한다. 공통 \`GameShell\`이 Global HUD, 화면별 content slot, Bottom Navigation을 고정하고, 각 화면은 자체 tab/page/detail state를 관리한다. 현재 임시 대응인 \`MobileScreenPager\`, \`FitPage\`, \`ResizeObserver\` 기반 전체 scale은 모든 표준 화면이 새 구조로 이관된 뒤 제거한다.

**Tech Stack:** React 19.1, TypeScript 5.8, Vite 6.4, CSS, Node test runner, React DOM server rendering, Figma MCP, GitHub Actions, GitHub Pages

**Spec:** \`docs/superpowers/specs/2026-09-20-mobile-game-ui-design.md\`

## Global Constraints

- 앱의 기본 기준은 세로형 스마트폰이며 화면 높이는 \`100dvh\`를 사용한다.
- 우선 지원 viewport는 width 320px~480px, height 640px~1000px이다.
- 페이지 전체의 세로 스크롤을 사용하지 않는다.
- 전체 UI 자동 \`transform: scale(...)\`을 사용하지 않는다.
- 주요 인터랙션 hit area는 최소 44×44 CSS px, 권장 48×48 CSS px이다.
- 인접 주요 터치 요소의 시각 간격은 최소 6px, 권장 8px이다.
- 한 화면에는 primary action을 원칙적으로 하나만 둔다.
- 화면 제목 20~24px, 섹션 제목 14~17px, 기본 본문 12~14px, 보조 정보 10~12px, 핵심 정보는 8px 이하로 줄이지 않는다.
- Bottom Navigation 순서는 \`거점 / 가방 / 거래소 / 조합 / 제작 / 장비\`를 유지한다.
- safe-area는 \`env(safe-area-inset-top/right/bottom/left)\`를 반영한다.
- Figma 기준 frame은 390×844 portrait다.
- 저채도 retro 2D dark fantasy, 낡은 철/목재/가죽/양피지/황동/석재 시각 언어를 유지한다.
- neon blue/purple, glossy mobile fantasy, 과도한 glassmorphism, 밝은 SaaS 카드 스타일을 금지한다.
- save schema v21, 전투 계산식, BattleFx collector sequence, boss AI, 부활 파이프라인, 아이템 수량, 제작 비용, 드롭, 거래 체결, 조합 데이터 모델, 원정 보상 확정 규칙은 변경하지 않는다.
- UI pagination/detail selection은 local UI state이며 save schema에 저장하지 않는다.
- 전투와 이벤트는 일반 \`GameShell\`의 standard content layout을 사용하지 않는 immersive screen이다.
- 각 화면을 실제 모바일 viewport에서 검증한 뒤 다음 화면으로 넘어간다.
- \`main\` 브랜치는 이 계획 실행 중 직접 수정/병합하지 않는다.

## Review Focus

1. **320×640 / 브라우저 UI가 큰 기기:** Global HUD, content, local actions, Bottom Nav가 겹치거나 잘리지 않아야 하며 body/page scroll이 생기면 안 된다. Task 2와 Task 14에서 viewport invariant를 테스트한다.
2. **필터/카테고리 변경 후 pagination:** 현재 page index가 새 pageCount 범위를 벗어나 빈 화면이 되지 않아야 한다. Task 1의 \`clampPageIndex\`와 각 목록 화면 테스트로 고정한다.
3. **BottomSheet/Modal:** 열릴 때 background action이 실행되지 않고 닫기 버튼/ESC-equivalent 동작이 명확해야 하며 focusable control이 44px 이상이어야 한다. Task 2와 Task 4에서 검증한다.
4. **원정 중 잠금 상태:** 장비/직업/외형/프리셋처럼 기존에 원정 중 변경이 금지된 행동은 새 UI에서도 그대로 disabled/locked여야 한다. Task 5, Task 8, Task 10에서 엔진 상태와 UI 상태를 함께 테스트한다.
5. **immersive 예외 회귀:** Battle/Event가 standard shell의 header/nav/pagination에 싸이지 않아야 하고 BattleFx/Reactive/2-hit 순서도 유지되어야 한다. Task 12와 Task 13에서 검증한다.

---

## File Structure Locked by This Plan

### New shared mobile UI files

\`\`\`text
src/components/mobile/
  GameShell.tsx            # standard vs immersive shell
  GlobalHud.tsx            # logo / Silver / Gold / premium entry
  BottomNav.tsx            # six fixed bottom tabs
  ScreenHeader.tsx         # title / supporting info / back action
  SegmentTabs.tsx          # local tab group
  PageStepper.tsx          # previous / page index / next
  BottomSheet.tsx          # item/equipment detail overlay
  mobilePagination.ts      # pure pagination + viewport-band helpers
  useViewportHeight.ts     # visualViewport/innerHeight adapter
  navigation.ts            # AppPage and nav metadata
  mobile-shell.css         # safe-area, sizing, shared mobile primitives
\`\`\`

### New/expanded screen modules

\`\`\`text
src/components/home/
  HomeScreen.tsx
  home.css

src/components/expedition/
  TowerSelectScreen.tsx
  ExpeditionPrepScreen.tsx
  ExpeditionResultScreen.tsx
  expedition-mobile.css

src/components/equipment/
  EquipmentScreen.tsx
  equipment-mobile.css

src/components/craft/
  CraftScreen.tsx
  CraftMasteryScreen.tsx
  craft-mobile.css

src/components/cosmetics/
  CosmeticsScreen.tsx
  cosmetics-mobile.css

src/components/skills/
  SkillsScreen.tsx
  skills-mobile.css

src/components/premium/
  PremiumScreen.tsx
  premium-mobile.css
\`\`\`

### Existing modules to refactor

\`\`\`text
src/main.tsx
src/style.css
src/pixel-ui.css

src/components/inventory/InventoryScreen.tsx
src/components/inventory/InventoryGrid.tsx
src/components/inventory/InventoryDetailSheet.tsx
src/components/inventory/inventory.css
src/components/inventory/item-slots.css

src/components/market/MarketScreen.tsx
src/components/market/MarketStatistics.tsx
src/components/market/market.css

src/components/association/AssociationScreen.tsx
src/components/association/association.css

src/components/JobsScreen.tsx
src/components/SaveManagement.tsx

src/components/events/EventScreen.tsx
src/components/events/events.css

src/components/battle/BattleScreen.tsx
src/components/battle/BattleScene.tsx
src/components/battle/battle.css
src/components/battle/immersive.css
\`\`\`

### Remove after cutover

\`\`\`text
src/components/MobileScreenPager.tsx
\`\`\`

### Tests

\`\`\`text
tests/mobilePagination.test.ts
tests/mobileShell.test.ts
tests/homeMobile.test.ts
tests/inventoryMobile.test.ts
tests/equipmentMobile.test.ts
tests/craftMobile.test.ts
tests/marketMobile.test.ts
tests/expeditionMobile.test.ts
tests/secondaryScreensMobile.test.ts
tests/eventMobile.test.ts
tests/mobileViewport.test.ts
tests/battleUi.test.ts
\`\`\`

---

### Task 1: Mobile Pagination and Viewport Utilities

**Files:**
- Create: \`src/components/mobile/mobilePagination.ts\`
- Create: \`src/components/mobile/useViewportHeight.ts\`
- Create: \`tests/mobilePagination.test.ts\`

**Interfaces:**
- Produces:
  - \`type ViewportBand = 'compact'|'standard'|'tall'\`
  - \`type PagedSurface = 'inventory'|'market'|'equipment'|'jobs'|'association'|'cosmetics'|'skills'|'recipes'\`
  - \`viewportBand(height:number): ViewportBand\`
  - \`pageSizeFor(surface:PagedSurface,height:number): number\`
  - \`clampPageIndex(index:number,itemCount:number,pageSize:number): number\`
  - \`pageSlice<T>(items:readonly T[],index:number,pageSize:number): T[]\`
  - \`useViewportHeight(): number\`

- [ ] **Step 1: Write failing pagination tests**

\`\`\`ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  viewportBand,pageSizeFor,clampPageIndex,pageSlice,
} from '../src/components/mobile/mobilePagination';

test('viewport bands match the mobile spec',()=>{
  assert.equal(viewportBand(640),'compact');
  assert.equal(viewportBand(719),'compact');
  assert.equal(viewportBand(720),'standard');
  assert.equal(viewportBand(899),'standard');
  assert.equal(viewportBand(900),'tall');
});

test('surface page sizes shrink instead of scaling the UI',()=>{
  assert.equal(pageSizeFor('inventory',640),12);
  assert.equal(pageSizeFor('inventory',800),16);
  assert.equal(pageSizeFor('inventory',950),20);
  assert.equal(pageSizeFor('market',640),4);
  assert.equal(pageSizeFor('market',800),5);
  assert.equal(pageSizeFor('market',950),6);
  assert.equal(pageSizeFor('recipes',640),2);
  assert.equal(pageSizeFor('recipes',800),3);
  assert.equal(pageSizeFor('recipes',950),4);
});

test('page index clamps after filtering shrinks a collection',()=>{
  assert.equal(clampPageIndex(4,5,4),1);
  assert.equal(clampPageIndex(2,0,4),0);
});

test('pageSlice never leaks items from adjacent pages',()=>{
  assert.deepEqual(pageSlice([1,2,3,4,5],0,2),[1,2]);
  assert.deepEqual(pageSlice([1,2,3,4,5],2,2),[5]);
});
\`\`\`

- [ ] **Step 2: Run the test and verify RED**

Run:

\`\`\`bash
npm test -- --test-name-pattern="viewport bands|surface page sizes|page index clamps|pageSlice"
\`\`\`

Expected: FAIL because \`mobilePagination.ts\` does not exist.

- [ ] **Step 3: Implement pagination helpers**

\`\`\`ts
export type ViewportBand='compact'|'standard'|'tall';
export type PagedSurface=
  |'inventory'|'market'|'equipment'|'jobs'
  |'association'|'cosmetics'|'skills'|'recipes';

export function viewportBand(height:number):ViewportBand{
  if(height<720)return 'compact';
  if(height<900)return 'standard';
  return 'tall';
}

const SIZES:Record<PagedSurface,Record<ViewportBand,number>>={
  inventory:{compact:12,standard:16,tall:20},
  market:{compact:4,standard:5,tall:6},
  equipment:{compact:4,standard:5,tall:6},
  jobs:{compact:4,standard:5,tall:6},
  association:{compact:4,standard:5,tall:6},
  cosmetics:{compact:6,standard:8,tall:10},
  skills:{compact:3,standard:4,tall:5},
  recipes:{compact:2,standard:3,tall:4},
};

export function pageSizeFor(surface:PagedSurface,height:number){
  return SIZES[surface][viewportBand(height)];
}

export function clampPageIndex(index:number,itemCount:number,pageSize:number){
  const pageCount=Math.max(1,Math.ceil(itemCount/Math.max(1,pageSize)));
  return Math.min(Math.max(0,index),pageCount-1);
}

export function pageSlice<T>(items:readonly T[],index:number,pageSize:number){
  const safe=clampPageIndex(index,items.length,pageSize);
  return items.slice(safe*pageSize,safe*pageSize+pageSize);
}
\`\`\`

Create \`useViewportHeight.ts\`:

\`\`\`ts
import {useEffect,useState} from 'react';

function currentViewportHeight(){
  if(typeof window==='undefined')return 844;
  return Math.round(window.visualViewport?.height??window.innerHeight);
}

export function useViewportHeight(){
  const [height,setHeight]=useState(currentViewportHeight);
  useEffect(()=>{
    const update=()=>setHeight(currentViewportHeight());
    window.addEventListener('resize',update);
    window.visualViewport?.addEventListener('resize',update);
    return()=>{
      window.removeEventListener('resize',update);
      window.visualViewport?.removeEventListener('resize',update);
    };
  },[]);
  return height;
}
\`\`\`

- [ ] **Step 4: Run tests**

Run:

\`\`\`bash
npm test
npm run typecheck
\`\`\`

Expected: PASS.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/components/mobile/mobilePagination.ts src/components/mobile/useViewportHeight.ts tests/mobilePagination.test.ts
git commit -m "feat: add mobile UI pagination primitives"
\`\`\`

---

### Task 2: Figma Foundations + Shared Mobile Game Shell Components

**Files:**
- External: Figma file \`Tower Chronicles — Mobile UI\`
- Create: \`src/components/mobile/navigation.ts\`
- Create: \`src/components/mobile/GameShell.tsx\`
- Create: \`src/components/mobile/GlobalHud.tsx\`
- Create: \`src/components/mobile/BottomNav.tsx\`
- Create: \`src/components/mobile/ScreenHeader.tsx\`
- Create: \`src/components/mobile/SegmentTabs.tsx\`
- Create: \`src/components/mobile/PageStepper.tsx\`
- Create: \`src/components/mobile/BottomSheet.tsx\`
- Create: \`src/components/mobile/mobile-shell.css\`
- Create: \`tests/mobileShell.test.ts\`

**Interfaces:**
- Produces:
  - \`type AppPage\` with existing route IDs
  - \`BOTTOM_NAV_ITEMS\`
  - \`GameShell({mode,game,currentPage,onNavigate,children})\`
  - \`ScreenHeader({title,meta,onBack})\`
  - \`SegmentTabs<T>({items,value,onChange,label})\`
  - \`PageStepper({page,pageCount,onPage})\`
  - \`BottomSheet({open,title,onClose,children})\`

- [ ] **Step 1: Build Figma foundations before composing screens**

In \`Tower Chronicles — Mobile UI\`, use Starter-compatible three-page structure:

\`\`\`text
00 Foundations + Components
01 Core Screens
02 Flows + Dev Handoff
\`\`\`

Create/bind variables:

\`\`\`text
color/bg/base
color/bg/panel
color/border/iron
color/text/primary
color/text/muted
color/accent/brass
color/state/danger
color/state/success

space/4
space/8
space/12
space/16
size/touch-min = 44
size/touch-preferred = 48
size/nav-height = 76
radius/panel
border/panel
\`\`\`

Create Figma variants:

\`\`\`text
BottomNavItem/state=default|active
GameButton/type=primary|secondary|danger
PageStepper/state=first|middle|last
SegmentTab/state=default|active|disabled
ItemSlot/state=default|selected|equipped|locked
\`\`\`

Take screenshots after foundation/components creation and verify no text clipping.

- [ ] **Step 2: Write failing shared shell tests**

Use \`react-dom/server\` so no browser test dependency is added.

\`\`\`ts
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PageStepper} from '../src/components/mobile/PageStepper';
import {BottomNav} from '../src/components/mobile/BottomNav';

test('PageStepper exposes current page and disables boundaries',()=>{
  const html=renderToStaticMarkup(React.createElement(PageStepper,{
    page:0,pageCount:3,onPage:()=>{},
  }));
  assert.match(html,/1 \\/ 3/);
  assert.match(html,/disabled/);
  assert.match(html,/다음/);
});

test('BottomNav marks the current destination',()=>{
  const html=renderToStaticMarkup(React.createElement(BottomNav,{
    current:'inventory',onNavigate:()=>{},
  }));
  assert.match(html,/aria-current="page"/);
  assert.match(html,/가방/);
});
\`\`\`

- [ ] **Step 3: Create navigation metadata**

\`\`\`ts
export type AppPage=
  'home'|'towers'|'floor'|'battle'|'inventory'|'equipment'|'craft'|
  'mastery'|'skills'|'jobs'|'cosmetics'|'premium'|'market'|
  'association'|'settings';

export const BOTTOM_NAV_ITEMS=[
  {page:'home',label:'거점',icon:'home'},
  {page:'inventory',label:'가방',icon:'inventory'},
  {page:'market',label:'거래소',icon:'market'},
  {page:'association',label:'조합',icon:'association'},
  {page:'craft',label:'제작',icon:'craft'},
  {page:'equipment',label:'장비',icon:'equipment'},
] as const;
\`\`\`

- [ ] **Step 4: Implement shared components**

\`GameShell.tsx\` must branch explicitly:

\`\`\`tsx
export function GameShell({
  mode,game,currentPage,onNavigate,children,
}:{
  mode:'standard'|'battle'|'event';
  game:GameState;
  currentPage:AppPage;
  onNavigate:(page:AppPage)=>void;
  children:React.ReactNode;
}){
  if(mode!=='standard'){
    return <div className={'game-shell immersive '+mode}>{children}</div>;
  }
  return <div className="game-shell standard">
    <GlobalHud game={game} onPremium={()=>onNavigate('premium')}/>
    <div className="game-shell-content">{children}</div>
    <BottomNav current={currentPage} onNavigate={onNavigate}/>
  </div>;
}
\`\`\`

\`PageStepper.tsx\`:

\`\`\`tsx
export function PageStepper({page,pageCount,onPage}:{
  page:number;pageCount:number;onPage:(page:number)=>void;
}){
  return <div className="page-stepper" aria-label="페이지 이동">
    <button type="button" disabled={page<=0} onClick={()=>onPage(page-1)}>← 이전</button>
    <span>{page+1} / {Math.max(1,pageCount)}</span>
    <button type="button" disabled={page>=pageCount-1} onClick={()=>onPage(page+1)}>다음 →</button>
  </div>;
}
\`\`\`

\`BottomSheet.tsx\` must use a fixed overlay and 44px close control; no internal page growth.

- [ ] **Step 5: Add shared CSS invariants**

\`\`\`css
html,body,#root{height:100%;overflow:hidden}
body{margin:0;overscroll-behavior:none}
.game-shell{width:min(100%,620px);height:100dvh;margin:0 auto;overflow:hidden}
.game-shell.standard{
  display:grid;
  grid-template-rows:auto minmax(0,1fr) auto;
}
.game-shell-content{min-height:0;overflow:hidden;padding:12px 14px}
.global-hud{padding-top:max(8px,env(safe-area-inset-top))}
.bottom-nav{
  min-height:76px;
  padding-bottom:max(8px,env(safe-area-inset-bottom));
  display:grid;
  grid-template-columns:repeat(6,minmax(0,1fr));
}
.bottom-nav button,.page-stepper button,.segment-tabs button{
  min-width:44px;
  min-height:44px;
}
.bottom-sheet-backdrop{position:fixed;inset:0;z-index:40}
.bottom-sheet{position:absolute;left:0;right:0;bottom:0;max-height:min(58dvh,520px)}
\`\`\`

There must be **no** \`transform:scale(\` in \`mobile-shell.css\`.

- [ ] **Step 6: Run tests**

\`\`\`bash
npm test
npm run typecheck
npm run build
\`\`\`

Expected: PASS.

- [ ] **Step 7: Commit**

\`\`\`bash
git add src/components/mobile tests/mobileShell.test.ts
git commit -m "feat: add mobile game shell components"
\`\`\`

---

### Task 3: Home, Tower Selection, and Expedition Result Screens

**Files:**
- Create: \`src/components/home/HomeScreen.tsx\`
- Create: \`src/components/home/home.css\`
- Create: \`src/components/expedition/TowerSelectScreen.tsx\`
- Create: \`src/components/expedition/ExpeditionResultScreen.tsx\`
- Create: \`src/components/expedition/expedition-mobile.css\`
- Create: \`tests/homeMobile.test.ts\`
- Read: current \`src/main.tsx:121-132\`

**Interfaces:**
- \`HomeScreen({game,onNavigate})\`
- \`TowerSelectScreen({game,onChooseTower})\`
- \`ExpeditionResultScreen({result,notice,onInventory,onNextExpedition})\`

- [ ] **Step 1: Write SSR tests for one-purpose layouts**

\`\`\`ts
test('home exposes one expedition CTA and four quick actions',()=>{
  const html=renderToStaticMarkup(React.createElement(HomeScreen,{
    game:initialState(),onNavigate:()=>{},
  }));
  assert.equal((html.match(/탑으로 떠나기/g)||[]).length,1);
  for(const label of ['직업','외형','저장','숙련'])assert.match(html,new RegExp(label));
  assert.doesNotMatch(html,/원정의 순환/);
});

test('tower selection keeps four towers but only ore enabled',()=>{
  const html=renderToStaticMarkup(React.createElement(TowerSelectScreen,{
    game:initialState(),onChooseTower:()=>{},
  }));
  assert.match(html,/철맥의 첨탑/);
  assert.match(html,/붉은 송곳니의 성소/);
});
\`\`\`

- [ ] **Step 2: Implement HomeScreen**

Use \`stats(game)\` and \`weaponOf(game)\` inside the screen so \`main.tsx\` no longer owns presentation calculations.

Layout:

\`\`\`tsx
<>
  <ScreenHeader title="거점" meta="다음 원정을 준비하세요"/>
  <section className="home-character-card">...</section>
  <button className="game-button primary" onClick={()=>onNavigate('towers')}>
    {game.expedition?'원정으로 돌아가기':'탑으로 떠나기'}
  </button>
  <div className="home-quick-actions">...</div>
</>
\`\`\`

Quick actions route to \`jobs/cosmetics/settings/mastery\`.

- [ ] **Step 3: Implement TowerSelectScreen**

Use one card per tower but keep card height fixed and text short. Disabled towers remain visible as \`준비 중\`; do not hide locked content.

- [ ] **Step 4: Implement ExpeditionResultScreen**

Keep one result summary, one primary action \`영구 보관함 확인\`, one secondary \`다음 원정 준비\`. Do not render the old page-long receipt.

- [ ] **Step 5: Create Figma screens**

Create:

\`\`\`text
SCREEN/Home
SCREEN/TowerSelect
SCREEN/ExpeditionResult
\`\`\`

Verify at 390×844 and 320×640. For 320×640, remove decorative copy before reducing font sizes.

- [ ] **Step 6: Run tests and commit**

\`\`\`bash
npm test
npm run typecheck
git add src/components/home src/components/expedition tests/homeMobile.test.ts
git commit -m "feat: add mobile home and expedition entry screens"
\`\`\`

---

### Task 4: Inventory — Fixed Grid + Pagination + Bottom Sheet

**Files:**
- Modify: \`src/components/inventory/InventoryScreen.tsx\`
- Modify: \`src/components/inventory/InventoryGrid.tsx\`
- Modify: \`src/components/inventory/InventoryDetailSheet.tsx\`
- Modify: \`src/components/inventory/inventory.css\`
- Modify: \`src/components/inventory/item-slots.css\`
- Create: \`tests/inventoryMobile.test.ts\`
- Reuse: \`mobilePagination.ts\`, \`useViewportHeight.ts\`, \`PageStepper.tsx\`, \`BottomSheet.tsx\`

**Interfaces:**
- Inventory remains \`InventoryScreen({game,setGame})\`.
- It consumes \`pageSizeFor('inventory',height)\`, \`pageSlice\`, \`clampPageIndex\`.

- [ ] **Step 1: Write pagination regression tests**

Build a state with >20 inventory view items and render the standard-height screen.

\`\`\`ts
test('inventory renders only one mobile page of slots',()=>{
  const game=inventoryFixtureWithManyItems();
  const html=renderToStaticMarkup(React.createElement(InventoryScreen,{game,setGame:()=>{}}));
  assert.ok((html.match(/inventory-slot/g)||[]).length<=20);
  assert.match(html,/page-stepper/);
});
\`\`\`

Also pin category reset through a pure helper or exported \`inventoryPageModel\`:

\`\`\`ts
assert.equal(inventoryPageModel(items,9,12).page,1);
\`\`\`

- [ ] **Step 2: Replace full-list rendering with page slice**

Core flow:

\`\`\`ts
const height=useViewportHeight();
const size=pageSizeFor('inventory',height);
const pageCount=Math.max(1,Math.ceil(visible.length/size));
const safePage=clampPageIndex(page,visible.length,size);
const pageItems=pageSlice(visible,safePage,size);
\`\`\`

Reset \`page\` to 0 when \`category/query/sort/filter\` changes.

- [ ] **Step 3: Keep four columns and change row count by height**

\`\`\`css
.inventory-screen{height:100%;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;overflow:hidden}
.inventory-grid{align-content:start;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;padding:0}
.inventory-slot{min-height:44px}
\`\`\`

Do not use \`overflow-y:auto\` for the item grid.

- [ ] **Step 4: Replace inventory-specific scrolling sheet with shared BottomSheet**

\`InventoryDetailSheet\` should render its content inside \`BottomSheet\`; remove \`height:38svh; overflow-y:auto\` dependency. Keep item name, tier/grade, description, one primary action, close button.

- [ ] **Step 5: Figma screens**

Create:

\`\`\`text
SCREEN/Inventory
SCREEN/Inventory/ItemSelected
\`\`\`

Variants must show default/selected/equipped/locked item slots.

- [ ] **Step 6: Verify**

\`\`\`bash
npm test
npm run typecheck
npm run build
\`\`\`

Manual viewport check:

\`\`\`text
320×640 → 12 slots
390×844 → 16 slots
430×932 → 20 slots
\`\`\`

- [ ] **Step 7: Commit**

\`\`\`bash
git add src/components/inventory tests/inventoryMobile.test.ts
git commit -m "feat: redesign inventory for paged mobile grid"
\`\`\`

---

### Task 5: Equipment + Skills — Character-Centered Slots

**Files:**
- Create: \`src/components/equipment/EquipmentScreen.tsx\`
- Create: \`src/components/equipment/equipment-mobile.css\`
- Create: \`src/components/skills/SkillsScreen.tsx\`
- Create: \`src/components/skills/skills-mobile.css\`
- Create: \`tests/equipmentMobile.test.ts\`
- Read/replace presentation currently inline in \`src/main.tsx:141\`, \`src/main.tsx:138\`

**Interfaces:**
- \`EquipmentScreen({game,setGame,onSkills})\`
- \`SkillsScreen({game,setGame,onBack})\`
- Equipment candidate list consumes \`pageSizeFor('equipment',height)\`.
- Skills catalog consumes \`pageSizeFor('skills',height)\`.

- [ ] **Step 1: Test locked expedition behavior**

\`\`\`ts
test('equipment replacement controls remain locked during an expedition',()=>{
  const game=stateWithActiveExpedition();
  const html=renderToStaticMarkup(React.createElement(EquipmentScreen,{
    game,setGame:()=>{},onSkills:()=>{},
  }));
  assert.match(html,/원정 잠금/);
  assert.match(html,/disabled/);
});
\`\`\`

- [ ] **Step 2: Implement central equipment layout**

Use four slot controls around an artwork area:

\`\`\`text
          [무기]

[갑옷]   [캐릭터]   [장신구]

          [신발]
\`\`\`

Each slot button opens a BottomSheet with only that slot's candidate items, 4~6 per page.

Stats visible without opening a sheet:

\`\`\`text
HP / 공격 / 방어 / 공격속도
\`\`\`

- [ ] **Step 3: Move mastery out of the main equipment column**

Use local segment:

\`\`\`text
[장비] [숙련]
\`\`\`

\`GearMasteryPanel\` may be reused in compact mode, but only one mastery category/group is visible at a time if 320×640 cannot fit.

- [ ] **Step 4: Implement SkillsScreen**

Top: 3 equipped skill slots.  
Bottom: paginated learned/unlearned catalog.  
Do not stack every skill card vertically.

Preserve \`game.expedition\` change lock and weapon compatibility warnings.

- [ ] **Step 5: Figma + verify + commit**

Create:

\`\`\`text
SCREEN/Equipment
SCREEN/Equipment/SlotSelected
SCREEN/Skills
\`\`\`

Then:

\`\`\`bash
npm test
npm run typecheck
git add src/components/equipment src/components/skills tests/equipmentMobile.test.ts
git commit -m "feat: add character-centered mobile equipment UI"
\`\`\`

---

### Task 6: Crafting + Craft Mastery

**Files:**
- Create: \`src/components/craft/CraftScreen.tsx\`
- Create: \`src/components/craft/CraftMasteryScreen.tsx\`
- Create: \`src/components/craft/craft-mobile.css\`
- Create: \`tests/craftMobile.test.ts\`
- Replace inline craft/mastery presentation currently in \`src/main.tsx:139-140\`

**Interfaces:**
- \`CraftScreen({game,setGame,now,onMastery})\`
- \`CraftMasteryScreen({game,onBack})\`
- Uses existing \`cost,discount,materialFor,startCraft\`.
- Recipe paging uses \`pageSizeFor('recipes',height)\`.

- [ ] **Step 1: Write tests for page count and locked grade**

\`\`\`ts
test('craft page keeps only the current field and grade recipe page visible',()=>{
  const html=renderToStaticMarkup(React.createElement(CraftScreen,{
    game:initialState(),setGame:()=>{},now:0,onMastery:()=>{},
  }));
  assert.match(html,/제작 등급/);
  assert.doesNotMatch(html,/transform: scale/);
});

test('locked grade craft action is disabled',()=>{
  const html=renderToStaticMarkup(/* game with mastery.weapon.unlocked = 1 and selected grade 2 fixture */);
  assert.match(html,/disabled/);
});
\`\`\`

- [ ] **Step 2: Replace tier-heavy web form with mobile hierarchy**

Top:

\`\`\`text
[무기] [방어구] [장신구] [연금]
등급 1 2 3 4 5
보유 재료 N
\`\`\`

Content: 2/3/4 recipe cards depending on viewport height.

Bottom: PageStepper + one selected recipe primary action.

User-facing copy uses \`등급\`, while internal field/property names may stay \`tier\` to avoid engine changes.

- [ ] **Step 3: CraftMasteryScreen**

Use a field tab and show one field's mastery at a time. Keep progress bar + unlocked grade + total crafts + discount. Do not show all fields as vertically stacked panels.

- [ ] **Step 4: Figma / verify / commit**

\`\`\`text
SCREEN/Crafting
SCREEN/Crafting/RecipeSelected
SCREEN/CraftingMastery
\`\`\`

Run:

\`\`\`bash
npm test
npm run typecheck
npm run build
git add src/components/craft tests/craftMobile.test.ts
git commit -m "feat: redesign crafting for mobile pages"
\`\`\`

---

### Task 7: Market — Browse, Detail, Statistics as Separate States

**Files:**
- Modify: \`src/components/market/MarketScreen.tsx\`
- Modify: \`src/components/market/MarketStatistics.tsx\`
- Modify: \`src/components/market/market.css\`
- Create: \`tests/marketMobile.test.ts\`

**Interfaces:**
- Existing market service APIs remain unchanged.
- Browse page size: \`pageSizeFor('market',height)\`.
- Local view state: \`browse | product | statistics | orders | trades\`.

- [ ] **Step 1: Write market page-size regression test**

\`\`\`ts
test('market browse never renders the old 30-row page on mobile',()=>{
  assert.equal(pageSizeFor('market',640),4);
  assert.equal(pageSizeFor('market',844),5);
  assert.equal(pageSizeFor('market',932),6);
});
\`\`\`

- [ ] **Step 2: Refactor top-level view model**

Browse state:

\`\`\`text
상품 / 내 주문 / 내 거래
검색
카테고리
상품 4~6행
PageStepper
\`\`\`

Product state:

\`\`\`text
상품 요약
최근 / 최고매수 / 최저매도
호가 3~5레벨
매수/매도
가격/수량
주문 확인
\`\`\`

Statistics must move behind a \`통계\` local tab/action instead of always consuming vertical space.

- [ ] **Step 3: Clamp pagination whenever filters change**

On \`category/query/sort/tierFilter/towerFilter/gearFilter\` change, call \`setPage(0)\`.

- [ ] **Step 4: Keep order confirmation as modal**

Reuse \`ConfirmModal\` or shared BottomSheet pattern. The modal must not resize the underlying market screen.

- [ ] **Step 5: Figma + verify + commit**

Create:

\`\`\`text
SCREEN/Market
SCREEN/Market/ProductDetail
SCREEN/Market/Statistics
SCREEN/Market/MyOrders
SCREEN/Market/MyTrades
\`\`\`

Run existing \`tests/market.test.ts\` and \`tests/marketStatistics.test.ts\` in addition to all tests.

Commit:

\`\`\`bash
git add src/components/market tests/marketMobile.test.ts
git commit -m "feat: split market into mobile game views"
\`\`\`

---

### Task 8: Expedition Prep — Three Explicit Tabs

**Files:**
- Create: \`src/components/expedition/ExpeditionPrepScreen.tsx\`
- Modify: \`src/components/expedition/expedition-mobile.css\`
- Create: \`tests/expeditionMobile.test.ts\`
- Replace current inline \`page==='floor'\` presentation in \`src/main.tsx:129-131\`

**Interfaces:**
- \`ExpeditionPrepScreen({game,tower,floor,setFloor,setGame,onBack,onStart,now})\`
- Local tab: \`'expedition'|'equipment'|'consumables'\`
- \`onStart\` must call existing \`startExpedition\` path; UI does not consume permits itself.

- [ ] **Step 1: Pin permit and start semantics**

Use existing expedition tests plus a mobile screen test:

\`\`\`ts
test('expedition prep does not consume permit before start is invoked',()=>{
  const game=initialState();
  const before=game.tickets.ore[0];
  renderToStaticMarkup(React.createElement(ExpeditionPrepScreen,{/* props */}));
  assert.equal(game.tickets.ore[0],before);
});
\`\`\`

- [ ] **Step 2: Implement Expedition tab**

Visible together:

- tower name
- floor selector
- permit count
- SAFE / PK / boss risk label
- compact enemy stats
- \`탐사 시작\` primary action

- [ ] **Step 3: Implement Equipment tab**

Show four equipped slots + preset selector/management. Do not render every preset form row at once; use one selected preset card and previous/next or compact slot tabs.

- [ ] **Step 4: Implement Consumables tab**

Show general potion count/limit and each carried potion as compact stepper rows. Keep revival potion rules unchanged.

- [ ] **Step 5: Keep primary start reachable from every tab**

The action stays in the local action footer; switching tab must not hide it.

- [ ] **Step 6: Figma / tests / commit**

Create:

\`\`\`text
SCREEN/ExpeditionPrep/Expedition
SCREEN/ExpeditionPrep/Equipment
SCREEN/ExpeditionPrep/Consumables
\`\`\`

Run:

\`\`\`bash
npm test
npm run typecheck
npm run build
git add src/components/expedition tests/expeditionMobile.test.ts
git commit -m "feat: split expedition prep into mobile tabs"
\`\`\`

---

### Task 9: Association + Jobs

**Files:**
- Modify: \`src/components/association/AssociationScreen.tsx\`
- Modify: \`src/components/association/association.css\`
- Modify: \`src/components/JobsScreen.tsx\`
- Create: \`tests/secondaryScreensMobile.test.ts\`

**Interfaces:**
- Association local tab after join: \`'summary'|'members'|'activity'|'manage'\`.
- Jobs local state: rarity + page + selected job detail.
- Both use shared \`SegmentTabs\`, \`PageStepper\`, \`BottomSheet\`.

- [ ] **Step 1: Write association page clamp test**

Use a fixture with >6 members and >6 activity records. Verify only current page data renders.

- [ ] **Step 2: Refactor association not-joined view**

Show:
- short registry intro
- \`조합 찾기 / 조합 창설\` segment
- 4~6 registered associations per page

Creation form opens as subview/sheet instead of permanently expanding the page.

- [ ] **Step 3: Refactor joined association**

Tabs:

\`\`\`text
요약 / 조합원 / 활동 / 관리
\`\`\`

Only one content pane is mounted visibly at a time.

- [ ] **Step 4: Refactor JobsScreen**

Use \`JOB_RARITIES\` as local tabs. Render 4/5/6 job cards per page. Selecting a job opens a detail sheet with passive/active kit summary and one select button.

Existing ownership and expedition lock conditions remain unchanged.

- [ ] **Step 5: Figma / verify / commit**

Create:

\`\`\`text
SCREEN/Association
SCREEN/Association/Members
SCREEN/Association/Manage
SCREEN/Jobs
SCREEN/Jobs/Detail
\`\`\`

Commit:

\`\`\`bash
git add src/components/association src/components/JobsScreen.tsx tests/secondaryScreensMobile.test.ts
git commit -m "feat: paginate association and jobs mobile screens"
\`\`\`

---

### Task 10: Cosmetics + Settings + Premium

**Files:**
- Create: \`src/components/cosmetics/CosmeticsScreen.tsx\`
- Create: \`src/components/cosmetics/cosmetics-mobile.css\`
- Modify: \`src/components/SaveManagement.tsx\`
- Create: \`src/components/premium/PremiumScreen.tsx\`
- Create: \`src/components/premium/premium-mobile.css\`
- Extend: \`tests/secondaryScreensMobile.test.ts\`

**Interfaces:**
- Cosmetics tabs: \`appearance | title\`.
- Settings remains a single screen.
- Premium remains a single screen; dev-only QA controls remain conditional on \`import.meta.env.DEV\`.

- [ ] **Step 1: Cosmetics pagination test**

Use 6/8/10 items by viewport height through \`pageSizeFor('cosmetics',height)\`.

- [ ] **Step 2: CosmeticsScreen**

\`\`\`text
[외형] [칭호]
Grid/List
PageStepper
selected detail/action
\`\`\`

Preserve expedition change lock.

- [ ] **Step 3: SaveManagement**

Reduce to:
- version
- export card/button
- import card/button
- one short warning
- status toast

Do not vertically stack long explanatory paragraphs.

- [ ] **Step 4: PremiumScreen**

Show active/inactive state + three benefits. DEV controls move behind one compact \`개발 QA\` collapsible section only in development.

- [ ] **Step 5: Figma / verify / commit**

Create:

\`\`\`text
SCREEN/Cosmetics
SCREEN/Settings
SCREEN/Premium
\`\`\`

Commit:

\`\`\`bash
git add src/components/cosmetics src/components/SaveManagement.tsx src/components/premium tests/secondaryScreensMobile.test.ts
git commit -m "feat: compact profile and settings mobile screens"
\`\`\`

---

### Task 11: Main Router Cutover and Removal of MobileScreenPager

**Files:**
- Modify: \`src/main.tsx\`
- Modify: \`src/style.css\`
- Modify: \`src/pixel-ui.css\`
- Delete: \`src/components/MobileScreenPager.tsx\`
- Modify: \`tests/mobileViewport.test.ts\`

**Interfaces:**
- \`main.tsx\` remains orchestration owner for save state and game actions.
- Screen modules own presentation and local UI navigation.
- \`GameShell\` owns global mobile layout.

- [ ] **Step 1: Change mobileViewport tests to reject the old scaling system**

\`\`\`ts
test('legacy auto-scaling pager is gone',()=>{
  assert.throws(()=>readFileSync(new URL('../src/components/MobileScreenPager.tsx',import.meta.url),'utf8'));
  assert.doesNotMatch(style,/transform:\\s*scale\\(/);
  assert.doesNotMatch(main,/MobileScreenPager/);
});

test('standard app shell locks body scrolling without hiding content behind nav',()=>{
  assert.match(style,/html,body,#root\\{[^}]*overflow:hidden/);
  assert.match(mobileShell,/\\.game-shell\\.standard/);
  assert.match(mobileShell,/grid-template-rows:auto minmax\\(0,1fr\\) auto/);
});
\`\`\`

- [ ] **Step 2: Import all new screens in main.tsx**

Replace large inline branches with component calls:

\`\`\`tsx
{page==='home'&&<HomeScreen game={game} onNavigate={move}/>}
{page==='towers'&&<TowerSelectScreen game={game} onChooseTower={...}/>}
{page==='floor'&&<ExpeditionPrepScreen .../>}
{page==='inventory'&&<InventoryScreen .../>}
{page==='equipment'&&<EquipmentScreen .../>}
{page==='skills'&&<SkillsScreen .../>}
{page==='craft'&&<CraftScreen .../>}
{page==='mastery'&&<CraftMasteryScreen .../>}
{page==='market'&&<MarketScreen .../>}
{page==='association'&&<AssociationScreen .../>}
{page==='jobs'&&<JobsScreen .../>}
{page==='cosmetics'&&<CosmeticsScreen .../>}
{page==='settings'&&<SaveManagement .../>}
{page==='premium'&&<PremiumScreen .../>}
\`\`\`

- [ ] **Step 3: Wrap with GameShell**

\`\`\`tsx
const shellMode=
  page==='battle'&&exp
    ? eventOpen?'event':'battle'
    : 'standard';

return <GameShell
  mode={shellMode}
  game={game}
  currentPage={page}
  onNavigate={move}
>
  {screen}
</GameShell>;
\`\`\`

Do not render the legacy top \`header\`, \`statusline\`, or bottom \`nav\` outside \`GameShell\`.

- [ ] **Step 4: Delete old scaling pager**

Delete \`MobileScreenPager.tsx\` and all imports. Remove CSS for:
- \`.mobile-screen-pager\`
- \`.mobile-screen-fit-viewport\`
- \`.mobile-screen-fit-content\`
- \`.mobile-screen-page\`
- old fixed \`nav\` transforms

- [ ] **Step 5: Run full suite and commit**

\`\`\`bash
npm test
npm run typecheck
npm run build
git add -A
git commit -m "refactor: cut over to mobile game shell"
\`\`\`

---

### Task 12: Event Screen as a No-Scroll Immersive Flow

**Files:**
- Modify: \`src/components/events/EventScreen.tsx\`
- Modify: \`src/components/events/events.css\`
- Create: \`tests/eventMobile.test.ts\`
- Keep existing event engine/tests unchanged.

**Interfaces:**
- Event remains driven by \`pendingEvent.state\`.
- If story + choices cannot fit, use existing event state transitions or a local two-step presentation state; never enable document scroll.

- [ ] **Step 1: Write CSS invariant test**

\`\`\`ts
test('event screen is a full viewport immersive layout without vertical scrolling',()=>{
  assert.match(css,/\\.event-screen\\{[^}]*height:100dvh/);
  assert.match(css,/\\.event-screen\\{[^}]*overflow:hidden/);
  assert.doesNotMatch(css,/overflow-y:auto/);
});
\`\`\`

- [ ] **Step 2: Recompose event layout**

Use:

\`\`\`text
Event HUD
Title/meta
Art
Story
Choices
Result/rewards
\`\`\`

Only the current phase's controls are visible.

For compact height:
- reduce artwork height
- reduce descriptive copy
- keep choice buttons ≥44px
- do not shrink core text below spec floor

- [ ] **Step 3: Figma screens**

\`\`\`text
SCREEN/Event/Choice
SCREEN/Event/Result
\`\`\`

- [ ] **Step 4: Verify existing event suite**

\`\`\`bash
npm test
npm run typecheck
npm run build
git add src/components/events tests/eventMobile.test.ts
git commit -m "feat: fit events to immersive mobile viewport"
\`\`\`

---

### Task 13: Battle Final Mobile Polish Without Engine Changes

**Files:**
- Modify: \`src/components/battle/BattleScreen.tsx\`
- Modify: \`src/components/battle/BattleScene.tsx\`
- Modify: \`src/components/battle/battle.css\`
- Modify: \`src/components/battle/immersive.css\`
- Modify: \`tests/battleUi.test.ts\`
- Read: \`tests/battleFx.test.ts\`

**Interfaces:**
- Do not change \`createBattleFxCollector\`, combat resolution, or save state.
- Preserve:
  - character-only shake
  - bow two-hit playback
  - Reactive collector order
  - shield absorption presentation

- [ ] **Step 1: Add compact viewport battle assertions**

Pin 320×640-specific CSS rules:

\`\`\`ts
test('compact battle keeps six actions tappable without scaling the scene',()=>{
  assert.match(css,/@media\\(max-height:719px\\)/);
  assert.doesNotMatch(css,/transform:\\s*scale\\(/);
  assert.match(css,/\\.battle-card\\{[^}]*min-height:44px/);
});
\`\`\`

- [ ] **Step 2: Replace any remaining desktop-derived spacing**

For \`max-height:719px\`:
- shorten header/meta lanes
- keep action deck 3×2
- reduce decorative footer first
- keep actor artwork focal points
- keep 44px action hit targets

- [ ] **Step 3: Preserve BattleFx tests**

Run specifically:

\`\`\`bash
npm test -- --test-name-pattern="battle FX|bow|Reactive|Shield"
\`\`\`

Then full:

\`\`\`bash
npm test
npm run typecheck
npm run build
\`\`\`

- [ ] **Step 4: Figma handoff**

Update:

\`\`\`text
SCREEN/Battle
SCREEN/Battle/BowHit1
SCREEN/Battle/BowHit2
SCREEN/Battle/Reactive
SCREEN/Battle/CompactHeight
\`\`\`

- [ ] **Step 5: Commit**

\`\`\`bash
git add src/components/battle tests/battleUi.test.ts
git commit -m "fix: polish battle for compact mobile screens"
\`\`\`

---

### Task 14: Responsive, Accessibility, and Viewport Matrix QA

**Files:**
- Modify: \`src/components/mobile/mobile-shell.css\`
- Modify: screen-specific CSS files as defects are found
- Modify: \`tests/mobileViewport.test.ts\`
- Create: \`docs/ui/mobile-qa-checklist.md\`

**Interfaces:**
- No feature/API changes.
- Produces final viewport QA record.

- [ ] **Step 1: Add source-level accessibility guards**

Tests:

\`\`\`ts
test('shared mobile controls preserve the minimum touch target',()=>{
  assert.match(css,/min-height:44px/);
  assert.match(css,/min-width:44px/);
});

test('safe area is used at both top and bottom chrome',()=>{
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
});
\`\`\`

- [ ] **Step 2: Verify viewport matrix**

Required matrix:

\`\`\`text
320×640   compact Android-class viewport
360×740   small modern phone
390×844   Figma reference
412×915   common Android portrait
430×932   large iPhone-class portrait
480×1000  upper supported range
\`\`\`

For every viewport, check:
- body scrollHeight does not exceed visible app shell due to standard-screen content
- no global scale transform
- top HUD and bottom nav do not overlap content
- primary action visible
- 44px touch controls
- sheet/modal stays on-screen
- page stepper current/total visible

- [ ] **Step 3: Create QA checklist document**

\`docs/ui/mobile-qa-checklist.md\` must record each screen against:
- compact
- reference
- tall
- empty state
- locked state
- modal/detail state

- [ ] **Step 4: Run complete verification**

\`\`\`bash
npm test
npm run typecheck
npm run build
git diff --check
\`\`\`

Expected: all PASS / no whitespace errors.

- [ ] **Step 5: Commit**

\`\`\`bash
git add src tests/mobileViewport.test.ts docs/ui/mobile-qa-checklist.md
git commit -m "test: complete mobile UI viewport QA"
\`\`\`

---

### Task 15: Figma Dev Handoff and GitHub Pages Verification

**Files:**
- External: Figma \`Tower Chronicles — Mobile UI\`
- Modify: \`docs/ui/mobile-qa-checklist.md\`
- Existing: \`.github/workflows/pages.yml\`

**Interfaces:**
- Consumes final code commit.
- Produces Figma implemented references, Actions URLs, Pages verification.

- [ ] **Step 1: Build final Figma flow map**

In \`02 Flows + Dev Handoff\`, place:

\`\`\`text
Home → TowerSelect → ExpeditionPrep → Battle → Result
Home → Inventory → Item Detail
Home → Equipment → Slot Detail
Home → Craft → Recipe
Home → Market → Product Detail
Home → Association
\`\`\`

- [ ] **Step 2: Record node → code mapping**

\`\`\`text
SCREEN/Home                  → HomeScreen.tsx
SCREEN/Inventory             → InventoryScreen.tsx
SCREEN/Equipment             → EquipmentScreen.tsx
SCREEN/Crafting              → CraftScreen.tsx
SCREEN/Market                → MarketScreen.tsx
SCREEN/Association           → AssociationScreen.tsx
SCREEN/ExpeditionPrep/*      → ExpeditionPrepScreen.tsx
SCREEN/Event/*               → EventScreen.tsx
SCREEN/Battle                → BattleScreen.tsx
BottomNavItem                → BottomNav.tsx
PageStepper                  → PageStepper.tsx
BottomSheet                  → BottomSheet.tsx
\`\`\`

- [ ] **Step 3: Push feature branch and verify CI**

Required jobs:
- tests
- typecheck
- production build
- standalone build

Do not report completion until the workflow reports \`success\`.

- [ ] **Step 4: Verify GitHub Pages**

Target:

\`\`\`text
https://korgeek-sd.github.io/tower-chronicles/
\`\`\`

Check on an actual mobile browser at minimum:
- Home
- Inventory + item sheet
- Equipment
- Craft
- Market
- Expedition Prep
- Battle
- Event if reachable

- [ ] **Step 5: Record final evidence**

Add to \`docs/ui/mobile-qa-checklist.md\`:
- final commit SHA
- CI run URL
- Pages deploy run URL
- tested phone/browser or viewport
- known remaining visual issues, if any

- [ ] **Step 6: Final commit only if QA documentation changed**

\`\`\`bash
git add docs/ui/mobile-qa-checklist.md
git commit -m "docs: record mobile UI deployment QA"
\`\`\`

---

## Implementation Order and Merge Gates

The tasks above are intentionally sequential. Do not skip forward when a shared interface is still moving.

\`\`\`text
Task 1  Pagination primitives
   ↓
Task 2  Shared shell/components/Figma foundations
   ↓
Task 3  Home/Tower/Result
   ↓
Task 4  Inventory
   ↓
Task 5  Equipment/Skills
   ↓
Task 6  Craft/Mastery
   ↓
Task 7  Market
   ↓
Task 8  Expedition Prep
   ↓
Task 9  Association/Jobs
   ↓
Task 10 Cosmetics/Settings/Premium
   ↓
Task 11 Main cutover + delete MobileScreenPager
   ↓
Task 12 Event immersive UI
   ↓
Task 13 Battle compact polish
   ↓
Task 14 Full viewport/accessibility QA
   ↓
Task 15 Figma handoff + Pages verification
\`\`\`

**Gate A — before Task 11:** every standard screen component must exist and pass its own tests.  
**Gate B — after Task 11:** \`MobileScreenPager\` must be deleted and the app must build without it.  
**Gate C — before Task 15:** all tests/typecheck/build/diff-check must pass.  
**Gate D — completion:** GitHub Pages deployment and actual mobile viewport verification must succeed.

---

## Spec Traceability Check

| Spec requirement | Owning task |
|---|---|
| 100dvh, no document scroll | 2, 11, 14 |
| no global scale | 2, 11, 14 |
| safe-area | 2, 14 |
| 44px minimum touch target | 2, 14 |
| fixed six-tab bottom nav | 2, 11 |
| one screen / one primary purpose | 3–10 |
| paginated long lists | 1, 4–10 |
| BottomSheet/detail instead of vertical expansion | 2, 4, 5, 7, 9 |
| Home redesign | 3 |
| Inventory redesign | 4 |
| Equipment redesign | 5 |
| Craft redesign | 6 |
| Market redesign | 7 |
| Association redesign | 9 |
| Expedition prep 3 tabs | 8 |
| Jobs pagination | 9 |
| Cosmetics tabs | 10 |
| Settings single screen | 10 |
| Event immersive no-scroll | 12 |
| Battle no-scroll/BattleFx preservation | 13 |
| Figma 3-page system | 2, 15 |
| state feedback/accessibility | 2, 4–14 |
| game logic/save schema protection | Global Constraints + all tasks |
| actual mobile verification | 14, 15 |

---

## Completion Definition

This plan is complete only when:

1. \`MobileScreenPager.tsx\` is deleted.
2. There is no global \`transform: scale(...)\` approach in standard UI.
3. Every standard screen uses \`GameShell\` and fits the supported viewport through deliberate information architecture.
4. Long collections use explicit pagination/tabs/detail views.
5. Battle and Event remain immersive and do not inherit standard header/nav.
6. Existing engine/save tests remain green.
7. New mobile UI tests are green.
8. \`npm test\`, \`npm run typecheck\`, \`npm run build\`, \`git diff --check\` all succeed.
9. GitHub Pages deploy succeeds.
10. Actual mobile viewport QA is recorded in \`docs/ui/mobile-qa-checklist.md\`.
