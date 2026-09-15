# 전투 그래픽 시스템 v0.1.4

## 적용 파일
- src/main.tsx: 전투 화면 연결, WebMCP 귀환도 예약 규칙 적용
- src/components/battle/BattleScreen.tsx: 전투 화면, 로그 자동 스크롤, 4부위 숙련, 포션, 귀환
- src/components/battle/BattleScene.tsx: BattleScene, BackgroundLayer, MonsterLayer, DamageLayer, MonsterHudLayer
- src/components/battle/presentation.ts: 실제 HP 기반 화면 데이터와 피해 감지
- src/components/battle/battle.css: 레이어, 모바일 레이아웃, 피격과 피해 숫자
- src/game/data/graphics.ts: 몬스터 그래픽과 탑/Tier 배경
- tests/graphics.test.ts: 신규 15개 검증
- public/assets/: 이미지 배치 폴더와 안내
- package.json, package-lock.json: 앱 버전 0.1.4
- dist/, play.html, 상위 탑의기록-플레이.html: 실행 빌드

## 이미지 넣는 위치
프로젝트: E:\files-pasted-by-the-user-rpg\outputs\tower-rpg

배경: public/assets/backgrounds/{ore|leather|gem|kaleon}/t1.png ~ t5.png
몬스터: public/assets/monsters/{ore|leather|gem|kaleon}/

기존 몬스터는 그대로 유지됩니다.
- ore: 철갑 늑대 → iron_wolf_idle.png, iron_wolf_hit.png
- leather: 황야 멧돼지 → wild_boar_idle.png, wild_boar_hit.png
- gem: 수정 파수꾼 → crystal_guardian_idle.png, crystal_guardian_hit.png
- kaleon: 이끼 정령 → moss_spirit_idle.png, moss_spirit_hit.png

고블린은 참고 이미지의 예시이므로 새 몬스터로 추가하지 않았습니다.
투명 PNG를 위 이름으로 넣고 개발 화면을 새로고침하면 표시됩니다.
파일명이 다르면 src/game/data/graphics.ts의 image.idle / image.hit 경로만 바꾸세요.
hit는 생략 가능합니다. UI 파일 수정은 필요 없습니다.

## 데이터 구조
MONSTER_GRAPHICS 항목:
{ id, tower, name, image: { idle, hit? }, display: { scale, offsetX, offsetY } }
tower + 기존 몬스터 name으로 조회합니다. 기존 저장 몬스터에 새 ID를 강제로 넣지 않습니다.
scale=1은 무대의 52%, 1.8은 약 94%. 원본 비율을 유지하고 최대 94% 너비/92% 높이로 제한합니다.
offsetX/Y는 무대 크기에 대한 백분율 이동입니다. 양수는 오른쪽/아래입니다.
기본값은 scale 1, offsetX 0, offsetY 0입니다. 큰 이동은 잘림을 만들 수 있으므로 작게 조절하세요.

TOWER_BACKGROUNDS[tower][tier]는 배경 경로입니다.
기존 tierOf 함수를 재사용합니다. 몬스터와 별도로 유지됩니다.

## 이미지 오류와 연출
배경이 없으면 CSS 어두운 그라데이션, idle이 없으면 아이콘과 '몬스터 이미지 준비 중'을 표시합니다.
미리 로드에 성공한 이미지만 img로 렌더링합니다. 깨진 이미지 아이콘을 노출하지 않습니다.
hit가 없거나 실패하면 idle을 유지하면서 몬스터 레이어에만 짧은 흔들림과 밝기 효과를 적용합니다.
SCENE_CONFIG.hitDurationMs=200 이후 idle로 복귀합니다.
실제 HP 감소량을 읽어 숫자를 위로 이동시키고 650ms 후 제거합니다.
막타는 남아 있던 HP만큼 표시합니다. 전투 계산, 공격 속도, 보상에는 관여하지 않습니다.
타이머는 실행 후 목록에서 제거하고 unmount 시 모두 정리합니다.
피해 숫자는 최대 5개이며 이미지 로딩과 연출 상태는 localStorage에 저장하지 않습니다.
움직임 줄이기 설정에서는 흔들림/이동을 생략합니다.

## 실행 파일과 이미지 배포
npm run dev: public/assets 파일 추가 후 새로고침.
npm run build: public/assets가 dist/assets로 복사됩니다.
node scripts/standalone.mjs: 코드와 CSS가 포함된 play.html을 만듭니다.
이미지는 별도 파일입니다. play.html 옆 assets/ 폴더에 public/assets의 내용을 함께 복사하세요.
상위 outputs/탑의기록-플레이.html 사용 시 outputs/assets/에도 같은 내용을 복사하세요.
이미지가 없는 현재 버전은 HTML만으로도 실행됩니다.

## 저장 및 검증
저장 버전은 v3 그대로이며 기존 v1/v2 이관과 v3 읽기/쓰기를 유지합니다.
새로운 영구 그래픽 상태나 HP 복제 값을 추가하지 않았습니다.
전투/원정/장비 숙련 기존 60개 + 그래픽 15개 + Silver 전환 13개 = 총 88개 테스트를 유지합니다.
실제 이미지가 없는 현재 구성에서 전투/원정/숙련/귀환/저장 자동 테스트를 통과했습니다.
브라우저의 로컬 file 주소 접근 제한으로 실제 화면 조작 및 이미지 디코딩 검증은 수행하지 못했습니다.
그래픽 테스트는 데이터/HP/피해 감지/fallback 선택 상태 검증이며 브라우저 실제 이미지 디코딩 테스트와 구분됩니다.
실제 몬스터나 배경 이미지 생성·참고 이미지 추출은 하지 않았습니다.
