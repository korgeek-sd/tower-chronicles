# 탑의 기록 v0.1.29 — Potion Overhaul 전달 문서

1. 구현 요약: 일반 즉시 회복 포션 4종과 치명 피해 시 선택하는 회생 포션으로 전환했다. 앱 0.1.29, 저장 스키마 20이다.
2. 변경 파일: package.json/package-lock.json; src/game/types.ts, data/config.ts, inventoryView.ts; engine의 state/combat/monsterSkills/expedition/exploration/presets/crafting; events의 catalog/fixtures/service; storage/repository.ts; main.tsx; ExpeditionLoot, BattleScreen, EventScreen과 관련 CSS; 기존 회귀 테스트 14개 파일 및 potion-overhaul.test.ts; README.md.
3. canonical PotionId: healing_lesser(T1), healing_standard(T2), healing_greater(T3), healing_supreme(T4), revival(T5). Potion은 호환 타입 별칭이다. revival 표시명은 회생 포션이다.
4. migration: v19→v20에서 health/attack/defense/haste 수량을 healing_lesser로 합산하고 regen을 healing_standard로 이전한다. 영구 보관함, 휴대 설정, 진행 원정, 프리셋, 결과 영수증, 제작 작업의 kind/itemId/recipeId를 처리한다. pending event는 potion ID를 저장하지 않고 이벤트 ID와 선택 결과만 저장한다. 현재 원정의 초과 수량을 삭제하지 않는다. 다음 입장부터 일반 30개/회생 1개 제한을 검사한다.
5. pending 구조: expedition.pendingRevival={source,steps}. source는 DIRECT_HIT, PERIODIC_DAMAGE, EVENT_DAMAGE. steps는 남은 DIRECT_HITS, SKILL_EFFECTS, 플레이어/몬스터 턴 마무리, 이벤트 결과 복귀를 기록한다.
6. 치명 피해: 직접 공격은 Shield 처리 후 resolveActorDirectHits에서 포착한다. 플레이어 턴 종료 지속 피해와 이벤트의 치명 피해도 선택 대기를 생성한다. 선택 전 정산하지 않는다.
7. 다단 타격: 현재 타격은 완료하고 남은 횟수/공격 주체/배율/반격 허용 여부를 저장한다. 수락 후 남은 타격만 실행하며 적 AI와 턴 시작을 다시 실행하지 않는다. 회생은 무적을 부여하지 않는다.
8. 저장: tower-record-v1 유지. v19 원본은 tower-record-v1-before-potions-v20에 먼저 백업한다. pending과 continuation을 JSON으로 저장한다. 기존 export/import 및 import 전 백업을 유지한다.
9. UI: 인벤토리 이름/티어/설명, 일반 휴대 합계와 회생 별도 수량, 수동 아이템 사용 조건, 회생 보유 상태, 치명 피해 선택창을 연결했다. 새 아이콘 제작 대신 기존 회복/포션 이미지를 재사용한다. 선택 중 화면 이동과 전투 행동을 차단한다.
10. 테스트: 기존 포션 ID/스키마 기대값을 변경했고 신규 11개 테스트로 일반 회복, 휴대 제한, 단일/다단 치명 피해, 수락/거부, Shield/DOT, Reactive/Charge, 이벤트 피해, 저장 복구, migration을 검사했다.
11. 전체 테스트: 251 pass / 0 fail (최종 추가 보호 수정 후 다시 실행 결과는 validation-tests.txt 참조).
12. TypeScript typecheck: 통과.
13. Vite production build: 통과.
14. standalone: scripts/standalone.mjs로 play.html 및 assets 복사본 생성. 생성물은 기존 .gitignore 정책에 따라 커밋 대상에서 제외한다.
15. git diff --check: 커밋 직전 확인한다.
16. branch: codex/v0.1.29-potion-overhaul.
17. 최신 구현 commit: 이 문서를 포함한 로컬 commit의 hash는 git log -1로 확인한다.
18. Git 상태: 구현 완료 후 로컬 commit으로 기록. 원격 push는 수행하지 않았다.
19. 남은 콘텐츠 작업: T5 회생 제작법 공개, 전용 포션 이미지, 실제 콘텐츠 기반 밸런스 확정. 기존 실사용 브라우저 저장은 삭제하거나 초기화하지 않았다. 브라우저 QA는 별도 임시 프로필에서 실행했다.
20. 미확정 밸런스: 일반 회복 비율 20/35/50/75%, 회생 30%는 임시 플레이 값이다. 일반 휴대 30개는 기존 제한을 계승했다. T5 제작 비용/시간/재료는 확정하지 않았다. 회생 제작은 production 비활성화, 단위 수량 1 설정을 제공한다.

브라우저 QA: 320×844 및 390×844에서 modal 폭, 기본 공격 비활성, pending 새로고침 복구, 회생 사용 후 수량/적 턴 보존을 확인했다. JavaScript pageerror 없음.
