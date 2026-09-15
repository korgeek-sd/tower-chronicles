# v0.1.11 모바일 인벤토리

- 변경: src/components/inventory/InventoryScreen, InventoryToolbar, InventoryTabs, InventoryGrid, InventoryDetailSheet 및 inventory.css. src/game/inventoryView.ts 순수 변환·검색·정렬·필터. main.tsx 기존 인벤토리 교체.
- 기존 pixel-v1의 Standard Panel, Inventory Slot, Selected Slot, Tab, Button 재사용.
- 신규 32×32 투명 PNG 27개: public/assets/ui/inventory/. 카테고리·유틸리티·현재 아이템용 간결한 픽셀 아이콘. 패턴 원본: scripts/inventory-icons.ps1.
- 전체/장비/재료/포션/스킬북/입장권/외형/기타 연결. 양수 보유량만 포함. 원정 임시 전리품 제외.
- 이름 검색, 기본/이름/티어/수량 정렬, 티어 및 카테고리별 상태 필터.
- 4열 슬롯, 상세창, X/배경/Escape 닫기, 카테고리 변경 초기화, 키보드 포커스 처리, reduced-motion.
- 기존 equip, useSkillBook, registerAppearance 연결. 원정 제한 및 기존 숙련 검증 유지. 해제 함수가 없어 해제 버튼 미추가. 판매/거래/분해/버리기/잠금/가짜 가격·용량 미추가.
- UI 상태 저장하지 않음. GameState schema 8 및 migration 변경 없음. UI version 0.1.11.
- 기존 144 + 추가 6 = 150 테스트 통과. typecheck, production build, standalone 생성 완료.
- 브라우저 390×844, 320×844 검증. 4열/검색/정렬/필터/탭/상세/닫기 확인. 320에서 가로 넘침 없음, 상세 하단과 nav 상단 일치, 아이콘 로딩 정상.
- 기존 저장 로드 확인. 장비 장착 실제 확인. 스킬북은 독립 QA에서 학습·수량 차감 확인. 외형 등록·소비 확인.
- tests/InventoryQa.tsx 및 inventory-qa.html은 저장소에 쓰지 않는 독립 검증용 화면이며 production 진입점에 포함되지 않음.