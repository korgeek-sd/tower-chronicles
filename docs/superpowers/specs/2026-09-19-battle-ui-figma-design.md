# Battle UI Figma Design Handoff Spec

**Date:** 2026-09-19  
**Scope:** 《탑의 기록》 전투 화면 UI를 현재 구현 기준으로 Figma에 설계하고, 이후 React/TypeScript 구현으로 연결한다.

## Goal

현재 GitHub Pages에서 실행되는 전투 화면을 기준점으로 Figma에 CURRENT/TARGET 구조를 만들고, 피격 흔들림·타격 FX·다중 타격·Reactive 같은 전투 연출을 시각적으로 명세한 뒤 코드 구현과 검증에 직접 연결한다.

## Locked Constraints

- 전투 계산 로직, save schema v21, 보스 판정 규칙은 디자인 작업에서 변경하지 않는다.
- 피격 흔들림은 화면 전체가 아니라 실제 피격된 캐릭터 스프라이트에만 적용한다.
- BattleFxQueue는 전투 계산을 지연시키지 않고 UI presentation만 시간차 재생한다.
- 활 기본 공격은 1 Action / 2 Hits 의미를 유지한다.
- 9F Reactive는 실제 엔진 발생 순서대로 시각화한다.
- 기존 다크 판타지 픽셀아트 방향을 유지한다: 저채도, 낡은 철·목재·가죽·황동, 네온/유광 모바일 판타지 금지.
- 모바일 세로 화면과 기존 전투 조작 흐름을 유지한다.
- main 브랜치는 직접 수정하지 않는다.

## Figma File Structure

새 Figma Design 파일 이름은 **Tower Chronicles — Battle UI**로 한다.

페이지/섹션 구조:

1. **00 Foundations**
   - 전투 UI 색상 토큰
   - 텍스트 토큰
   - 간격/테두리/패널 규칙
   - FX 강도 규칙

2. **01 Components**
   - Battle/Player
   - Battle/Monster
   - Battle/HUD
   - Battle/ActorFx
   - Battle/DamageNumber
   - Battle/ActionButton

3. **02 Battle Screen**
   - CURRENT: 현재 GitHub Pages 전투 화면 기준
   - TARGET: 개선된 전투 화면

4. **03 Battle States & FX**
   - Idle
   - Player Hit
   - Monster Hit
   - Bow Hit 1
   - Bow Hit 2
   - Shield Hit
   - Armor Break
   - Heal
   - Reactive Counter
   - Boss Charge

5. **90 Dev Handoff**
   - Figma node → React component 매핑
   - CSS token/spacing mapping
   - 구현 체크리스트

## Component Mapping

| Figma | React/TS |
|---|---|
| Battle/Scene | src/components/battle/BattleScene.tsx |
| Battle/Player | PlayerLayer |
| Battle/Monster | MonsterLayer |
| Battle/HUD | CombatHud |
| Battle/ActorFx | ActorFxLayer |
| Battle/DamageNumber | floating-number |
| Battle/ActionButton | BattleScreen action controls |

## Design Rules

### Layout

- 현재 전투 장면의 플레이어/몬스터 상대 위치를 기준으로 유지한다.
- HUD는 전투 장면을 가리지 않도록 고정된 정보 영역으로 정리한다.
- Actor FX는 캐릭터 영역의 독립 overlay로 둔다.
- DamageNumber는 FX 레이어와 분리해 읽기 우선순위를 유지한다.

### Hit Feedback

- light: 짧고 작은 수평 이동
- normal: 중간 강도의 좌우 이동
- heavy: 더 큰 좌우 이동과 짧은 밝기 플래시
- 전체 battle scene이나 background는 흔들리지 않는다.

### FX Variants

최소 Variant:
- slash
- stab
- arrow
- magic_burst
- heavy_hit
- shield_hit
- poison
- bleed
- armor_break
- heal

각 FX는 캐릭터 이미지에 합성하지 않고 ActorFx overlay로 설계한다.

### Multi-hit Timing

활 2타:
- Hit 1: 0ms
- Hit 2: 약 110ms
- 두 hit는 각각 독립 FX, 흔들림, 피해 숫자를 가진다.

Reactive 예:
- player hit 1
- monster reactive counter
- player hit 2

실제 엔진 collector sequence 순서를 디자인 명세의 기준으로 삼는다.

## Design-to-Code Workflow

1. 현재 GitHub Pages 전투 화면을 Figma CURRENT reference로 캡처한다.
2. TARGET 프레임을 동일한 모바일 기준 크기로 설계한다.
3. 상태별 FX 프레임을 추가한다.
4. Figma Design Context를 읽어 실제 node 크기/간격/스타일을 추출한다.
5. 기존 React 컴포넌트와 CSS를 재사용하고 필요한 부분만 변경한다.
6. 전투 엔진과 save schema는 건드리지 않는다.
7. feature branch에서 test/typecheck/build를 통과한다.
8. GitHub Pages에 배포한다.
9. 배포 화면을 다시 Figma reference와 비교해 시각 QA한다.

## Acceptance Criteria

- CURRENT와 TARGET 전투 화면이 Figma에 존재한다.
- TARGET에는 플레이어와 몬스터의 독립 hit feedback 구조가 표현된다.
- 활 2타와 9F Reactive 순서가 상태 프레임으로 확인 가능하다.
- FX는 ActorFx overlay 구조로 분리되어 있다.
- Figma component/node 이름이 코드 매핑 규칙과 일치한다.
- 구현 단계에서 기존 BattleFxQueue와 전투 로직을 재사용할 수 있다.
- 시각 QA 시 전체 화면 흔들림이 아닌 피격 캐릭터만 흔들린다.
