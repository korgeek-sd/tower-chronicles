# TOWER CHRONICLES — MASTER PROJECT CONTEXT
# 《탑의 기록》 Codex 장기 개발용 마스터 컨텍스트

이 문서는 《탑의 기록 / Tower Chronicles》 프로젝트의
세계관, 게임 구조, 현재 구현 상태, 확정된 기획,
미구현 계획, 폐기된 과거 기획, 개발 원칙을 통합한
MASTER PROJECT CONTEXT다.

앞으로 이 프로젝트를 수정할 때 이 문서를 기본 배경지식으로 사용하라.

단, 가장 중요한 원칙:

SOURCE OF TRUTH PRIORITY

1. 현재 실제 repository production code
2. 가장 최신 GPT-HANDOFF 문서
3. 자동 테스트
4. 최근 확정 기획
5. 과거 구현 보고서 / 과거 handoff
6. 오래된 README
7. 추정

실제 코드와 이 문서가 충돌하면
실제 코드를 우선한다.

PLANNED를 IMPLEMENTED로 착각하지 마라.
DEV_ONLY fixture를 production content로 착각하지 마라.
과거 폐기된 50층 구조를 현재 구조로 착각하지 마라.

==================================================
1. PROJECT IDENTITY
==================================================

게임명:

《탑의 기록》
Tower Chronicles

장르:

- 모바일 세로형
- Dark Fantasy RPG
- 수동 1대1 턴제 전투
- 탑 탐사
- 장비 파밍/제작
- 장기적으로 PvP / 길드 / 경제 시스템 포함

현재 방치형 RPG가 아니다.

플레이어는 자동으로 싸우는 것이 아니라
직접 다음 행동을 선택한다.

기본 전투 행동:

- 기본 공격
- 액티브 스킬
- 아이템
- 도망

플랫폼:

portrait mobile web

독립 실행:

play.html + assets

현재 frontend:

React
TypeScript
Vite

실제 프로젝트 경로:

E:\ChatGPT\게임만들기\battle-redesign

현재 standalone:

E:\ChatGPT\게임만들기\battle-redesign\play.html

외부 게임 아트 원본 보관소:

E:\탑의 기록\일러스트

이 원본 폴더는 production runtime 경로가 아니다.
게임에 사용할 때는 반드시 프로젝트 내부 asset으로 COPY한다.

==================================================
2. CURRENT KNOWN DEVELOPMENT BASELINE
==================================================

최신 업로드된 실제 handoff 기준:

App version:
0.1.30

Save schema:
v21

Main save key:
tower-record-v1

현재 branch:

codex/v0.1.30-tower-structure

v0.1.30의 목적:

기존 각 탑 50층 구조를 폐기하고
각 탑 정확히 10층 구조로 변경.

현재 v0.1.30 handoff 기준:

- typecheck 성공
- Vite production build 성공
- standalone 생성 성공
- git diff check 성공

하지만 npm test는
Node 24.19.0 환경의 시스템 오류:

uv_os_get_passwd returned ENOMEM

때문에 테스트 assertion 시작 전에 중단됨.

따라서 v0.1.30은 코드 구조상 구현 완료 상태이지만
전체 regression test를 한 번 더 성공시켜야 한다.

v0.1.30 변경은 해당 handoff 작성 시점 기준
아직 local working tree에 있고
commit / GitHub push 전이었다.

실제 repository 상태는 항상 다시 확인한다.

==================================================
3. VERSION HISTORY — IMPORTANT MILESTONES
==================================================

v0.1.27

주요 전투 기반 엔진:

- Monster AI
- Charge
- Reactive
- Direct Hit
- Stack Threshold
- Shield

등이 production combat path에 연결됨.

당시에는 이 기능을 사용하는 production monster content가 거의 없었다.

v0.1.28

Save Stability update.

추가:

- 저장 관리 화면
- JSON export
- JSON import
- import validation
- import 전 기존 save backup
- 구버전 save migration
- corrupted/future save 거부
- 원정 중 상태 포함 전체 GameState export/import

manual import backup key:

tower-record-v1-before-manual-import

정상 backup에 실패하면 main save를 덮어쓰지 않는다.

v0.1.29

Potion Overhaul.

Save schema:
v20

신규 canonical PotionId:

healing_lesser
healing_standard
healing_greater
healing_supreme
revival

회생 포션의 선택형 치명 피해 시스템 구현.

v0.1.30

Tower Structure Overhaul.

Save schema:
v21

50층 → 10층.

SAFE / PK_ELIGIBLE / boss floors 구조 도입.

==================================================
4. WORLD — NOVAR
==================================================

세계의 중심 도시:

노바르 / Novar

노바르는 네 개의 고대 탑 주변에 성장한
위험한 중세 자유상업도시다.

명목상:

벨렌 왕국

소속이지만 실질적으로는 강한 자치권을 가진
상업/탐사 도시의 성격을 가진다.

도시 경제의 핵심은
네 고대 탑에서 회수되는 자원이다.

핵심 세계관 문장:

"탑이 노바르를 만들었고,
노바르는 탑을 먹고 산다."

"이곳에서는 검을 든 자,
물건을 만든 자,
돈을 움직이는 자 모두가 힘을 가진다."

원정 철학:

"탑에서 얻은 것은 아직 네 것이 아니다.
살아서 돌아와라."

이 문장은 게임 시스템의 핵심 원칙이다.

탑 내부에서 얻은 대부분의 전리품은
즉시 영구 소유가 아니다.

플레이어가 살아서 귀환해야
영구 자산이 된다.

==================================================
5. PLAYER FANTASY
==================================================

플레이어는:

- 선택받은 용사
- 왕족
- 전설의 기사
- 세상을 구할 운명의 인물

이 아니다.

플레이어는 노바르에서 활동하는
평범한 전문 탐사자다.

IMPORTANT TERMINOLOGY:

"탑사자" 사용 금지.

항상:

탐사자

를 사용한다.

게임 세계는
모험가 판타지보다
위험한 자원 탐사 산업에 가깝게 느껴져야 한다.

탑 탐사는:

위험
+
노동
+
자원
+
사업
+
경쟁

의 성격을 가진다.

==================================================
6. FOUR TOWERS
==================================================

네 개의 탑:

1.
철맥의 첨탑
Iron Vein Spire

주요 자원:
철광석 / ore

2.
붉은 송곳니의 성소
Red Fang Sanctuary

주요 자원:
가죽 계열

3.
천광의 수정탑

주요 자원:
보석 계열

4.
칼레온의 녹빛 첨탑
Caleon의 영문 철자는 반드시 Caleon.

주요 자원:
약초 / 연금 관련 자원

과거:

각 탑 50층
1~10 T1
11~20 T2
...
41~50 T5

구조였다.

이 구조는 폐기됐다.

==================================================
7. CURRENT TOWER FLOOR STRUCTURE
==================================================

각 탑은:

1F ~ 10F

정확히 10층.

1~2F:

SAFE
PK 불가
보스 없음

3~5F:

PK_ELIGIBLE
일반 탐사
보스 없음

6~10F:

PK_ELIGIBLE
일반 탐사
+
각 층 boss

즉:

6F boss
7F boss
8F boss
9F boss
10F final boss

한 탑에 총 5개의 보스.

10F가 해당 탑의 최종층이자 final boss다.

IMPORTANT:

PK_ELIGIBLE은 현재 metadata다.

실제 서버 PvP는 아직 구현되지 않았다.

localStorage 기반 fake PvP를 만들면 안 된다.

==================================================
8. NORMAL MONSTER RULE
==================================================

한 탑의 1~10F는
동일한 일반 몬스터 pool을 사용한다.

층마다 새로운 일반 몬스터 pool을 만들지 않는다.

예:

철맥 1F와 10F 모두
동일한 기본 monster pool에서 몬스터가 나온다.

차이는:

FloorDifficultyScaling

이다.

즉:

MonsterBaseDefinition
+
FloorScaling
=
Runtime Monster

층이 올라가면 주로:

- HP
- Attack
- Defense
- Speed / 현재 데이터상 필요한 runtime stat

등이 증가한다.

하지만 같은 monster ID라면:

- 이름
- 외형
- skill set
- AI identity

는 층에 따라 바뀌지 않는다.

==================================================
9. IRON VEIN SPIRE — VISUAL / THEME
==================================================

철맥의 첨탑:

거대한 검은 고대 탑.

내부는 끝없이 이어지는
버려진 광산과 유사하다.

시각 요소:

- 검은 암석
- 어두운 갈색 암벽
- 철광맥
- 오래된 목재 지지대
- 녹슨 레일
- 광차
- 사슬
- 채굴 도구
- 먼지
- 희미한 호박색 불빛

전체 분위기:

낡음
위험
광산 산업
고대 구조물

==================================================
10. IRON VEIN NORMAL MONSTER POOL
==================================================

현재 1~10F 공통 pool:

goblin_miner
고블린 광부

cave_rat
동굴 쥐

mine_bat
광산 박쥐

goblin_carrier
고블린 운반꾼

goblin_overseer
고블린 감독관

v0.1.30에서는
이 5종이 전체 1~10F에서 공통 pool을 사용하도록 변경됨.

현재/과거 정식 행동은 충분히 작성되지 않았으며
보스 개발 후 일반 monster combat pass가 필요할 수 있다.

과거 제안된 역할:

동굴 쥐
→ 단순 기본형

고블린 광부
→ 느리지만 강한 공격

광산 박쥐
→ 약한 multi-hit

고블린 운반꾼
→ Shield 활용

고블린 감독관
→ Charge 또는 debuff

이는 콘텐츠 기획이며
actual code 확인 없이 구현 완료로 취급하지 않는다.

==================================================
11. IRON VEIN BOSSES — CURRENT CANON PLAN
==================================================

기존 50층 시대에 설계했던 5보스를
새 10층 구조에서 재사용한다.

최종 배치:

6F
쇄철턱 굴혈수

7F
흑맥갑주 파쇄충

8F
울림포식자

9F
심층 권양감독체

10F
철심 맥동체

각 역할:

6F 쇄철턱 굴혈수
→ Charge tutorial

7F 흑맥갑주 파쇄충
→ armor/effect
→ direct hit로 균열 stack
→ threshold에서 armor break / exposed

8F 울림포식자
→ 플레이어에게 resonance/울림 stack
→ 일정 stack 이상이면 conditional AI
→ Charge 강공격

9F 심층 권양감독체
→ Reactive prepared counter
→ Charge 보조 패턴

10F 철심 맥동체
→ Shield
→ HP condition AI
→ debuff
→ Charge
→ true phase 없이 pseudo-phase

IMPORTANT:

v0.1.30 handoff 기준
이 5개 이름은 boss slot 구조에 반영되었지만
실제 production MonsterDefinition / skill / AI는 아직 완성되지 않았다.

당시 실제 boss definition으로 남아 있던 것은:

mining_ogre
광산 오우거

하나.

10F actual encounter도 아직 mining_ogre였다.

따라서 다음 major content update의 핵심은
이 5보스를 실제 production content로 만드는 것이다.

==================================================
12. IRON BOSS ART
==================================================

사용자가 위 5보스의 실제 일러스트를
외부 폴더에 준비해두었다.

원본:

E:\탑의 기록\일러스트

앞으로 보스를 구현할 때:

- 해당 폴더 재귀 조사
- 실제 보스 이미지 확인
- 프로젝트 asset 폴더로 COPY
- production graphics registry 연결
- build 확인
- standalone 확인

해야 한다.

절대:

E:\탑의 기록\일러스트\...

같은 absolute path를 runtime에 넣지 않는다.

원본 asset은:

삭제
이동
덮어쓰기
파괴적 rename

하지 않는다.

==================================================
13. RED FANG SANCTUARY — WORLD / ART
==================================================

붉은 송곳니의 성소는
야생 포식자와 원시적 의식이 축적된 위험한 성소다.

시각 요소:

- 어두운 적갈색 석재
- 발톱 자국
- 물린 흔적
- 제한된 뼈/사체 흔적
- 낡은 가죽
- 털
- 뿔
- 송곳니
- 힘줄
- 원시적 제단
- 오래된 목재
- 탁한 금속
- 오래된 횃불

과도한 gore는 피한다.

악마 숭배보다는:

포식자
사냥
무리
힘의 위계
원시적 의식

에 가깝다.

==================================================
14. RED FANG PLANNED BOSSES
==================================================

기존에 설계된 5보스:

핏갈기 추적자
→ Charge

붉은턱 가죽포식자
→ wound stack

송곳니 무리어미
→ Reactive

성소 발톱주교
→ Shield / 상태 AI
→ 야성적 ritual leader

적아의 주인
→ Charge + Stack + Shield + HP AI

현재 production에는 구현되지 않았다.

새 10층 구조에서 실제 구현할 경우
5개 보스를 6~10F에 재배치하는 방향으로 사용한다.

실제 floor mapping을 구현할 때는
사용자 최신 결정 또는 최신 handoff를 확인한다.

==================================================
15. CELESTIAL CRYSTAL TOWER
==================================================

탑 이름:

천광의 수정탑

주요 자원:

보석 계열

현재 상세 monster/boss content는
철맥/붉은 송곳니보다 덜 확정됐다.

존재하지 않는 boss name,
lore,
mechanic을 임의로 canon으로 만들지 마라.

새 콘텐츠 설계가 필요한 경우
사용자와 먼저 확정한다.

==================================================
16. CALEON'S GREEN SPIRE
==================================================

탑 이름:

칼레온의 녹빛 첨탑

English:

Caleon

절대 Kaleon으로 쓰지 않는다.

핵심 테마:

- 연금
- 치유
- 재생
- 돌연변이
- 질병
- 고통의 이전
- 대속
- 거짓 성자
- 자기 희생

==================================================
17. FALSE SAINT CALEON — CORE LORE
==================================================

핵심 문장:

"칼레온은 괴물이 되었기 때문에 성자였다."

약 150년 전.

칼레온은 실제로 사람을 치료하던 뛰어난 치유자였다.

녹빛 첨탑에는
강력한 재생/변형 현상이 존재한다.

임시 개념명:

녹화(綠化)

이 현상은 단순히 파괴할 수 있는 것이 아니다.

칼레온은 탑에서 발생하는:

- 독
- 질병
- 변형
- 과도한 재생
- 오염

을 다른 존재에게서 자신에게 전이시키는
"수용자 / receptor"가 되기로 한다.

즉 사람들을 치료한 방식은
그들의 고통을 자신의 몸으로 옮기는 것이다.

궁극적으로 칼레온이 치료하려던 "환자"는:

녹빛 첨탑 그 자체.

그는 탑의 오염을 자신에게 받아들이고
깊은 곳에서 150년 동안 그것을 억제한다.

결과적으로 그의 육체는 괴물이 되었다.

후대의 사람들은:

"죽음을 초월한 성자"

라고 신화화하기도 하고,

또 다른 사람들은:

괴물의 모습을 보고
"거짓 성자"

라고 부른다.

둘 다 진실 전체를 모른다.

==================================================
18. CALEON LAYERED REVEAL
==================================================

기존 50층 구조용으로 설계했던 reveal sequence는
현재 10층 구조에 맞게 다시 압축해야 하지만
핵심 정보 순서는 유지한다.

과거 설계된 reveal:

초기:
Caleon은 위대한 치유자.
몸에 녹색 흔적이 있다는 암시.

중반:
대속/전이 연구 기록.
처음에는 다른 희생자를 사용한 것처럼 보임.

후반:
실험실의 괴물,
인간 같은 변이체,
"성자를 믿지 마라."

플레이어는 Caleon이 악인이라고 오해한다.

진실:

기록의 receptor C는
Caleon 본인.

그는 환자들의 고통을 자신에게 옮겼다.

최종 진실:

최종 환자는
Green Spire 자체.

대표 기록 문구:

Target: Green Spire
Treatment: Transfer
Receptor: Caleon

마지막 기록 개념:

"전이는 성공했다.
문이 닫혀 있는 동안 그들은 산다.
그러니 이 문을 열지 마라."

==================================================
19. CALEON FINAL ENCOUNTER
==================================================

최종 보스 표현:

거짓 성자 칼레온

초기에는
거의 말하지 않는 괴물처럼 싸운다.

HP 조건에 따라:

"...돌아가라."

"문을... 닫아라."

"밖으로 가져가서는 안 된다."

후반:

"나는 이미 충분히 살았다.
저들은 아직 아니다."

HP 0은
Caleon의 실제 죽음이 아니다.

광폭화된 외부 조직이 무너진다.

Caleon:

"노바르는?"

플레이어:

살아 있다.

Caleon:

"그렇군.
그럼 됐다."

그는 계속 남아서
오염을 억제한다.

선택 가능한 마지막 대화:

Caleon:
밖에서는 나를 뭐라고 부르지?

플레이어:
거짓 성자.

Caleon:

"좋은 이름이군.
다시는 누구도 이곳에 성자를 찾으러 오지 않을 테니."

그는 자신의 역사적 오명조차
또 하나의 희생으로 받아들인다.

IMPORTANT:

과거 매우 복잡하게 설계했던
종교 세력 여러 파벌 구조는 폐기/비선호 방향이다.

이 탑 하나를 위해 세계관을 지나치게 복잡하게 만들지 않는다.

==================================================
20. COMBAT — CORE RULES
==================================================

전투:

manual
1v1
turn based

기본 damage formula historically/current engine baseline:

max(1, floor((attack - defense) * multiplier))

실제 현재 코드 확인이 우선.

Shield는 HP보다 먼저 damage를 흡수한다.

multi-hit은 hit 단위로 처리한다.

Bow basic attack:

2 hits

Sword/Dagger/Staff:

기본적으로 1 hit

Cooldown:

actor-own-turn 기준.

speed:

현재 역사적으로 데이터에는 존재하지만
실제 turn order / action count에 의미가 없었다.

speed를 임의로 새로운 initiative 시스템으로 바꾸지 마라.

==================================================
21. MONSTER AI CAPABILITIES
==================================================

현재 engine이 지원하는 주요 AI condition:

SELF_HP_BELOW

TARGET_HP_BELOW

SKILL_READY

SELF_HAS_EFFECT

SELF_MISSING_EFFECT

TARGET_HAS_EFFECT

TARGET_MISSING_EFFECT

SELF_EFFECT_STACKS_AT_LEAST

TARGET_EFFECT_STACKS_AT_LEAST

AI는 deterministic priority + condition 방식이다.

새 보스 패턴은 가능한 한
이 기존 시스템을 사용한다.

==================================================
22. CHARGE
==================================================

Charge engine은 존재한다.

기본 semantics:

prepare
→ actor action 소비

prepared state 저장

다음 자기 행동 가능한 시점:
→ discharge 우선

Charge 준비 중 damage를 받는다고
자동 cancel되지 않는다.

discharge 후 cooldown.

save/reload 지원을 유지한다.

==================================================
23. REACTIVE
==================================================

Reactive:

특정 actor의 prepared reaction slot.

기본 semantics:

- direct hit를 받음
- actor가 생존
- prepared reaction 존재
→ reaction trigger

prepared slot은 소비된다.

reaction chain은 금지.

Reactive → Reactive 무한 반응 금지.

DOT는 direct hit가 아니다.

save/reload에서 prepared state를 보존해야 한다.

==================================================
24. EFFECT SYSTEM
==================================================

production에서 활용 가능한 주요 effect behavior:

STAT_MODIFIER

PERIODIC_DAMAGE

PERIODIC_HEAL

SHIELD

stack threshold engine 존재.

과거 CONTROL/STUN은
완성되지 않았거나 production-ready가 아니었다.

현재 실제 코드 확인 없이
"스턴 시스템이 구현되어 있다"고 가정하지 마라.

==================================================
25. SHIELD
==================================================

Shield:

실제 combat engine에 연결되어 있다.

damage 순서:

incoming damage
→ Shield absorption
→ remaining damage
→ HP
→ lethal check

revival은 Shield 이전이 아니라
실제 HP lethal 시점에서 판단한다.

==================================================
26. POTION SYSTEM — CURRENT CANON
==================================================

현재 potion은 5종.

T1

ID:
healing_lesser

표시명:
하급 회복 포션

T2

ID:
healing_standard

표시명:
중급 회복 포션

T3

ID:
healing_greater

표시명:
상급 회복 포션

T4

ID:
healing_supreme

표시명:
최상급 회복 포션

T5

ID:
revival

표시명:
회생 포션

legacy:

health
regen
attack
defense
haste

는 production 신규 생성에서 사용하지 않는다.

migration compatibility에서만 읽을 수 있다.

==================================================
27. NORMAL HEALING POTIONS
==================================================

하급~최상급:

즉시 HP 회복.

- 지속 회복 아님
- 공격 buff 아님
- 방어 buff 아님
- speed buff 아님
- 플레이어 행동 1회 소비
- max HP 초과 회복 없음

v0.1.29 임시 회복량:

하급 20%
중급 35%
상급 50%
최상급 75%

IMPORTANT:

이 수치는 provisional.

최종 balance가 아니다.

일반 potion 휴대 합계:

30개

현재는 legacy limit를 계승한 provisional/working rule.

==================================================
28. REVIVAL POTION
==================================================

회생 포션은:

자동 사용이 아니다.

수동 battle item 버튼으로 일반 사용하지도 않는다.

플레이어가 lethal damage를 받으려는 순간:

전투 resolution을 pause

→ 선택창 표시

"회생 포션을 사용하시겠습니까?"

선택:

회생 포션 사용
사용하지 않는다

사용:

- revival -1
- death 취소
- HP 일부 회복
- 기존 combat continuation 재개

거부:

- potion 유지
- 정상 death settlement

현재 임시 회복량:

30%

provisional.

한 expedition:

최대 1개 휴대.

==================================================
29. PENDING REVIVAL
==================================================

v0.1.29 구현 구조:

expedition.pendingRevival

개념:

{
  source,
  steps
}

source:

DIRECT_HIT
PERIODIC_DAMAGE
EVENT_DAMAGE

steps:

- 남은 DIRECT_HITS
- 남은 SKILL_EFFECTS
- player/monster turn finish
- event result continuation

등을 저장.

중요:

revival modal은 단순 UI state가 아니다.

save 가능한 combat runtime state다.

==================================================
30. MULTI-HIT + REVIVAL
==================================================

예:

HP 50

3-hit attack

1 hit:
-20
HP 30

2 hit:
-40
lethal

이때:

3번째 hit를 아직 처리하지 않는다.

pendingRevival 생성.

사용을 선택하면:

HP 회복
→ 3번째 hit부터 계속.

1,2 hit 재실행 금지.

enemy action 처음부터 재시작 금지.

revival은:

무적
남은 hit 취소

가 아니다.

revival 후 남은 hit로 다시 죽을 수 있다.

==================================================
31. DOT / REACTIVE / CHARGE + REVIVAL
==================================================

다음 lethal source도
동일한 revival pipeline을 사용한다.

- DOT
- periodic damage
- Reactive
- Charge
- event damage

revival 선택 때문에:

- tick 중복
- charge 재실행
- reactive 재준비
- cooldown 이중 감소
- reward 중복

발생 금지.

==================================================
32. EXPEDITION CORE LOOP
==================================================

기본 흐름:

거점
→ 탑/층 선택
→ 입장권 소비
→ expedition snapshot
→ 전투
→ 전리품 임시 축적
→ 계속 탐사
→ 귀환 또는 사망

입장 시 snapshot 대상으로:

- equipment
- job
- potion loadout
- 기타 필요한 원정 고정 상태

등이 있다.

원정 중 장비/직업을 임의로 바꾸지 않는다.

==================================================
33. TEMPORARY LOOT PRINCIPLE
==================================================

탑에서 획득한 것은
대부분 expedition temporary loot다.

살아서 귀환:

→ permanent inventory/economy로 commit

사망:

→ 이번 원정 임시 loot 손실

핵심:

"탑에서 얻은 것은 아직 네 것이 아니다.
살아서 돌아와라."

앞으로 추가되는:

- rare resources
- stolen PvP loot
- broken enemy gear

도 이 원칙을 따른다.

==================================================
34. CURRENT DEATH RULE VS FUTURE RULE
==================================================

CURRENT production baseline:

사망 시:

- expedition temporary loot 손실
- 남은 carried potion 손실

기존 permanent gear는 현재 코드상 유지.

FUTURE CONFIRMED DESIGN:

사망 시 장착 장비도 파괴 위험을 가진다.

이것은 아직 production 구현되지 않았다.

==================================================
35. EQUIPMENT SLOTS
==================================================

장비 slot:

weapon
armor
boots
accessory

총 4슬롯.

Equipment Tier:

T1
T2
T3
T4
T5

IMPORTANT:

장비 tier와 tower floor는 분리됐다.

과거:

1~10F = T1
...

방식 폐기.

현재:

floor = 1~10

equipment tier = T1~T5

서로 독립 개념.

==================================================
36. WEAPONS
==================================================

기본 weapon family 4종:

Sword
검

Dagger
단검

Bow
활

Staff
지팡이

과거/현재 config baseline:

검:
ATK 10
DEF 4
speed 1.00
skillPower 1.00
basic 1 hit

단검:
ATK 7
DEF 0
speed 1.65
skillPower 1.15
basic 1 hit

활:
ATK 12
DEF 1
speed 1.15
skillPower 1.00
basic 2 hit

지팡이:
ATK 6
DEF 0
speed 0.85
skillPower 2.30
basic 1 hit

실제 current config를 항상 확인한다.

speed의 실제 turn 의미는 아직 없음.

dagger critical은 구현되어 있지 않았다.

==================================================
37. EQUIPMENT ICON ART RULE
==================================================

장비 아이콘 공통 규칙:

같은 아이템이면
티어가 달라도 기본 외형은 동일.

즉:

T1 Sword
T2 Sword
T3 Sword
T4 Sword
T5 Sword

는 동일한 sword silhouette / design을 사용.

Tier differentiation은:

1. 좌상단 Roman numeral
2. background color

가 핵심.

Roman:

T1 = I
T2 = II
T3 = III
T4 = IV
T5 = V

추천/current art direction:

T1
dark iron gray / stone gray

T2
muted blue-gray / dull teal-gray

T3
dark teal / blue-green

T4
dark violet / muted purple

T5
antique gold / pale gold / platinum-gold

Item identity:

외형

Tier identity:

Roman numeral + background color

로 분리한다.

T5라고 검에 날개/불꽃/과도한 보석을 붙여
다른 sword처럼 만들지 않는다.

==================================================
38. RANDOM ENHANCEMENT — FUTURE CONFIRMED
==================================================

장비 강화는:

확률형 / random enhancement

방향으로 확정.

Silver
+
materials

등을 사용하는 주요 economic sink가 될 예정.

정확한:

- success rate
- 단계
- 실패 penalty
- downgrade
- destruction
- cost

는 아직 최종 확정 안 됨.

과거 data에 enhancement 0~3 자리 등이 존재했더라도
실제 강화 engine/UI가 구현됐다고 가정하지 않는다.

향후 별도 update로 구현.

==================================================
39. DEATH EQUIPMENT DESTRUCTION — FUTURE CONFIRMED
==================================================

사망 시:

현재 장착된:

weapon
armor
boots
accessory

각각이 독립적으로
floor destruction probability를 roll.

즉 한 번 사망 시:

0개
1개
2개
3개
4개

전부 가능.

확정 규칙:

- 장비 tier에 따른 destruction modifier 없음
- enhancement level에 따른 destruction chance modifier 없음
- 확률은 floor/zone destruction probability만 사용
- permanent inventory/storage gear는 대상 아님

NORMAL PvE DEATH:

파괴 판정 실패 장비는
기본적으로 완전 손실.

material partial recovery 없음.

exact floor probabilities는 미확정.

보험/복구 봉인 시스템:

미확정.

임의 구현 금지.

==================================================
40. JOB SYSTEM
==================================================

현재 canonical job 25개.

C:

계약용병
사냥꾼
굴착인부
야전구호원
회수업자

B:

선봉 탐사자
추적자
생환가
결투가
탐사 의무관

A:

집행인
심문관
심층 도굴꾼
혈전가
원정 전술가

SR:

광전사
변질의사
잔혼술사
고행투사
현장기술자

SSR:

용혈기사
봉인기록관
시체조율사
자가연성가
검은수레 승부사

CURRENT:

catalog/name/state structure는 일부 존재.

25개 직업의 실제 combat kit는 아직 없음.

PLANNED:

각 직업은 고정:

Passive 2
Active 3

필요한 경우:

optional job resource

모든 직업은
모든 weapon을 사용할 수 있는 방향.

==================================================
41. JOB GACHA PLAN
==================================================

기획명:

탑기록원 · 봉인 직능기록

Main currency:

Gold

fragment를 통한 동일 pool 접근 계획.

duplicate job:

fragment로 변환.

정확한:

rates
pity
prices

는 아직 확정/구현하지 않는다.

current code에 gacha가 없으면
문서 기획을 production이라고 착각하지 마라.

==================================================
42. CRAFTING
==================================================

Crafting engine은 이미 상당 부분 존재한다.

역사적 production 분야:

weapon
armor
accessory
alchemy

주요 material family:

ore
leather
gem
kaleon

queue / offline settle / cancel / claim 등의
local crafting flow가 존재했다.

현재 actual code 확인 필요.

Potion overhaul 이후:

healing potion 4종
+
revival

체계에 맞춰 recipe가 변경됨.

revival production recipe는
v0.1.29 기준 비활성.

T5 revival:

최종 recipe
cost
time
materials

미확정.

==================================================
43. ECONOMY
==================================================

주요 currency:

Silver

Gold

Silver 방향:

게임 내 운영 currency.

향후 주요 sink:

- random enhancement
- crafting fee
- broken gear repair
- 기타 expedition preparation
- transaction-related costs

등.

Gold 방향:

상위 collection / 선택 / premium 성격.

대표 계획:

- Job gacha
- cosmetics
- convenience

IMPORTANT:

실제 현금 구매 Gold와 직접 연결된
casino/gambling gameplay를 경제 핵심으로 만드는 것은
규제 위험 때문에 현재 우선 계획이 아니다.

==================================================
44. MARKET / ASSOCIATION
==================================================

과거 production code에는:

local market simulation
association/guild-like local simulation

등이 존재했다.

하지만:

실제 온라인 multiplayer economy가 아니다.

실제 다른 player의 서버 거래가 아니다.

localStorage data를
online authoritative economy라고 취급하지 마라.

향후 online 전환 시
server authority가 필요하다.

==================================================
45. TOWER OCCUPATION WAR — PLANNED, SEPARATE SYSTEM
==================================================

이 시스템은
개인 PK 희귀 자원 경쟁과 별개다.

확정 설계:

네 개의 탑.

한 guild가 동시에 점령 가능한 탑:

최대 1개.

시간:

매주 토요일
22:00 ~ 22:30

battlefield:

3 lanes

2 / 3 lane 점령:

heart/core가 열린다.

lane 공격:

현재 lane occupier/defender를 이겨야 점령.

공격자들끼리 싸웠다고
lane 소유권을 얻지 않는다.

새 lane occupier:

lane ownership state를 100%로 reset.

새 점령 guild:

1분 defender registration time.

death respawn:

60초.

heart/core:

3분 유지 성공
→ tower capture.

occupation:

다음 점령전까지 유지.

tower tax:

고정 3%

→ guild treasury.

distribution:

equal
또는
contribution-based

guild leader distribution rate:

0~100%

UI 요약 label:

"길드장 몫"

옛 direct-payment 방식은 폐기.

이 시스템은 아직 서버 multiplayer 시스템으로 구현된 것이 아니다.

==================================================
46. RARE RESOURCE PK SYSTEM — PLANNED
==================================================

Tower occupation war와 별개의
개인 1v1 PvP system.

현재 10층 구조에서
3~10F는 PK_ELIGIBLE metadata를 갖는다.

실제 PvP 서버는 아직 없음.

개념:

PK 가능 층을 탐사하다
낮은 확률로:

희귀 자원 채집지

발견.

첫 발견 player가 점유.

base occupation duration:

15분.

같은 floor를 탐사 중인 다른 player가
해당 채집지를 발견할 수 있다.

발견 시:

도전 / PK
또는
통과

선택.

==================================================
47. PK LOCK
==================================================

owner와 challenger가 1v1 PvP 중이면:

site state:

PVP_LOCKED

점유 timer:

pause.

다른 제3 player:

해당 site encounter를 받지 않음.

즉:

- third-party invasion 없음
- 3-way fight 없음
- 난입 없음

1v1 종료 후
다시 occupied state.

==================================================
48. PK DEFENDER WIN
==================================================

현재 owner가 승리:

남은 occupation time:

-3분

예:

10:20 남음

defense win

→ 7:20

남은 시간 <= 3분이면:

즉시 occupation complete.

==================================================
49. PK CHALLENGER WIN
==================================================

challenger 승리:

ownership transfer.

new remaining time:

oldRemaining × 1.5

maximum:

22분 30초

formula:

min(oldRemaining * 1.5, 22:30)

반복 takeover로 시간이 무한 증가하지 않게 한다.

==================================================
50. PK OCCUPATION COMPLETE
==================================================

timer 0:

rare resource 획득.

하지만:

즉시 permanent inventory가 아니다.

expedition temporary loot로 들어간다.

살아서 귀환해야
영구 소유.

==================================================
51. PK LOSER LOOT
==================================================

PK loser:

expedition temporary materials를 잃는다.

winner가 loot.

permanent warehouse/storage materials:

loot 대상 아님.

장착 gear:

각 slot이 floor destruction probability를 독립 roll.

PK의 특수 규칙:

파괴 판정에 걸린 gear는
그냥 삭제되지 않고

winner에게:

BROKEN / 파손 장비

상태로 loot된다.

winner도 이 장비를
temporary expedition loot로 가진다.

winner가 귀환 전에 죽으면
다시 잃을 수 있다.

==================================================
52. BROKEN PK GEAR
==================================================

winner가 살아서 귀환:

BROKEN gear를 영구 소유.

Hub에서 repair:

Silver
+
해당 tier material

필요.

repair 후 usable gear.

정확한 repair cost:

미확정.

==================================================
53. NORMAL DEATH VS PK DEATH
==================================================

NORMAL PvE future design:

파괴 gear
→ 완전 손실

PK:

파괴 gear
→ winner가 BROKEN gear로 획득 가능

이 차이를 유지한다.

==================================================
54. SERVER AUTHORITY FUTURE RULE
==================================================

실제 PvP / online economy를 구현할 때:

localStorage는 authoritative일 수 없다.

Server가 authoritative 해야 하는 것:

- Silver
- Gold
- equipment
- items
- rare resources
- exchange
- PvP outcome
- gear destruction
- loot transfer

Local JSON import가
server economy를 덮어쓰게 만들면 안 된다.

==================================================
55. SUGGESTED ONLINE COMBAT ARCHITECTURE
==================================================

실시간 MMO free movement가 필수는 아니다.

현재 게임과 잘 맞는 방향:

room/node based expedition.

server tracks:

- tower
- floor
- node
- status
- occupied resource
- battle

manual 1v1 combat semantics 재사용.

action submission:

API

battle/event updates:

WebSocket 가능.

idempotency identifiers:

battleId
turnNumber
actionId

중복 action 처리 금지.

turn timeout:

필요하면 auto basic 또는 규칙 기반 fallback.

==================================================
56. EVENT ENGINE — CURRENT STATE
==================================================

Event engine 자체는 존재한다.

과거/현재 코드에는:

- event types
- selector
- service
- EventScreen
- save/reload event runtime
- DEV fixtures

등이 있다.

하지만 최신 v0.1.30 기준:

production authored normal event catalog:

0개.

즉:

이벤트 시스템은 있지만
실제 일반 이벤트 콘텐츠는 아직 없다.

==================================================
57. COMMON EVENT CATALOG — IMPORTANT UNRESOLVED
==================================================

사용자는 과거 대화에서:

"모든 탑에서 사용할 수 있는 공통 이벤트"

목록을 별도로 기획한 것으로 기억하고 있다.

하지만 현재 접근 가능한 repository handoff / 검색 문서에서
그 정확한 최종 목록:

- 이벤트명
- 선택지
- 효과
- 등장 조건

전체를 신뢰성 있게 복원하지 못했다.

따라서:

현재 production common event catalog가 존재한다고 가정하지 마라.

새 이벤트를 임의로 "예전에 확정된 이벤트"라고 주장하지 마라.

향후 과거 원본 대화/문서를 확보하면
그 목록을 canonical common event catalog로 복원한다.

==================================================
58. RECENT EVENT DRAFT — NOT CANON COMMON LIST
==================================================

최근 철맥 v0.1.32 후보로 제안됐던 draft:

버려진 광부 야영지
→ 회복/보급

멈춰 선 광차
→ loot

무너지는 갱도
→ HP ↔ reward

노출된 철맥
→ resource

버려진 작업 창고
→ reward choice

심층의 불길한 울림
→ boss foreshadow

IMPORTANT:

이 6개는 최근 제안 draft.

"과거 확정된 모든 탑 공통 이벤트 목록"
이라고 취급하지 않는다.

==================================================
59. EVENT DESIGN PRINCIPLE
==================================================

향후 구조는 권장:

COMMON_EVENT_CATALOG

+
IRON_SPECIFIC_EVENTS

+
RED_FANG_SPECIFIC_EVENTS

+
CRYSTAL_SPECIFIC_EVENTS

+
CALEON_SPECIFIC_EVENTS

공통 이벤트:

세계 어느 탑에서나 가능한 사건.

전용 이벤트:

해당 tower theme/lore/resource를 활용.

초기 event conditions는
과도하게 복잡하지 않게 유지.

현재 engine에 있는:

FLOOR_TYPE
BOSS_FLOOR

등 중앙 floor metadata 활용.

==================================================
60. JOB / EQUIPMENT / EVENT CONTENT STATUS RULE
==================================================

이 프로젝트에서 매우 중요:

"엔진이 있다"

≠

"콘텐츠가 있다"

예:

Monster AI engine 존재

≠
모든 monster가 AI definition 보유

Event engine 존재

≠
production event 존재

Job system type 존재

≠
25 jobs combat kit 구현

Shield engine 존재

≠
Shield 사용 production boss 존재

항상 구분한다.

==================================================
61. ART DIRECTION — GLOBAL
==================================================

전체:

original retro 2D dark fantasy pixel art.

특징:

- muted
- low saturation
- dark
- grounded
- worn
- production-ready
- mobile readability
- crisp pixel clusters

피해야 할 것:

- 과도한 neon
- clean high fantasy
- cartoon toy style
- excessive glow
- generic anime
- excessive ornate fantasy
- photo realism

==================================================
62. SPRITE DIRECTION
==================================================

Enemy sprites:

기본적으로 LEFT-facing.

transparent background.

full body.

전투 화면에서
player 방향을 바라보는 구도.

asset이 반대 방향이면
가능하면 renderer/presentation layer에서 flip.

원본 asset을 파괴적으로 변경하지 않는다.

==================================================
63. IRON ART
==================================================

Iron Vein:

- black rock
- dark brown
- iron
- rusty metal
- old timber
- rails
- carts
- chain
- mining tools
- dust
- dim amber light

industrial mine + ancient tower.

==================================================
64. RED FANG ART
==================================================

Red Fang:

- dark red-brown stone
- claw damage
- bite damage
- worn hides
- fur
- leather
- horn
- fang
- sinew
- primitive altar
- old wood
- dull metal
- restrained bone/carcass traces

not demon cult.

predator hierarchy / primitive sanctuary.

==================================================
65. CALEON ART
==================================================

Caleon:

- green alchemical corruption
- regeneration
- surgical/alchemical treatment
- diseased botanical mutation
- ancient laboratory/tower
- false saint imagery
- self-sacrifice

직접적인 기독교 상징 복붙은 피하고
모티프를 세계관 내부 언어로 재해석한다.

==================================================
66. SAVE SYSTEM
==================================================

Main save key:

tower-record-v1

v0.1.28 manual import backup:

tower-record-v1-before-manual-import

v0.1.29 potion migration backup:

tower-record-v1-before-potions-v20

v0.1.30 tower migration backup:

tower-record-v1-before-tower-structure-v21

중요 원칙:

migration 전 backup.

backup 실패:

main save overwrite 금지.

normal save:

임의 초기화 금지.

==================================================
67. v19 → v20 POTION MIGRATION
==================================================

Legacy:

health
regen
attack
defense
haste

→

health
attack
defense
haste

수량을:

healing_lesser

로 합산.

regen:

healing_standard

로 이전.

migration 대상:

- permanent potion inventory
- carry config/loadout
- active expedition
- presets
- result receipt
- crafting task kind/itemId/recipeId

normal quantities 삭제 금지.

revival legacy 지급:

없음.

==================================================
68. v20 → v21 TOWER MIGRATION
==================================================

50F → 10F 구조 변경.

ticket arrays:

50 slots
→ 10 slots.

progress:

max 10.

highestReturned:

max 10.

recent expedition result floor:

max 10.

active expedition >10F:

- HP 유지
- potion bag 유지
- temporary loot 유지
- kill count 유지
- equipment state 유지
- floor만 10으로 normalize
- boss tracking은 새 구조에 맞게 reset
- 필요 runtime monster 재생성

permanent economy 삭제 금지.

==================================================
69. INVENTORY
==================================================

역사적/current inventory categories:

전체
장비
재료
포션
스킬북
입장권
외형
기타

search/filter/sort/detail 등의
inventory framework가 존재.

actual current UI를 확인한다.

expedition loot는
permanent inventory와 분리되어야 한다.

==================================================
70. COSMETICS / TITLES
==================================================

engine/state 기반은 일부 존재.

과거 baseline:

appearance content 거의 1개
titles 0개.

현재 actual code 확인 필요.

향후 Gold 소비처 후보.

==================================================
71. PREMIUM / GOLDEN RECORDER
==================================================

과거 code에:

황금기록자

기간/혜택 상태 등이 존재.

현재 monetization/backend가 완성된 것은 아니다.

실제 결제 시스템이 구현되어 있다고 가정하지 마라.

==================================================
72. IMPORTANT DEPRECATED DESIGN
==================================================

다음은 현재 사실로 사용 금지:

각 탑 50층.

10/20/30/40/50 boss.

1~10 T1
11~20 T2
31~40 T4
등 floor-tier band.

철맥 10F = 광산 오우거가 최종 canonical boss라는 기획.

legacy health/regen/attack/defense/haste가 현재 potion 체계라는 주장.

revival이 자동 사용이라는 주장.

일반 monster pool이 floor별로 달라진다는 주장.

1~2F에서 PK 가능하다는 주장.

모든 production event가 이미 구현됐다는 주장.

모든 jobs가 이미 skill/passive를 가진다는 주장.

PvP가 현재 localStorage에서 실제 player 간 작동한다는 주장.

==================================================
73. CURRENT NEXT UPDATE — PRIORITY
==================================================

현재 가장 먼저 해야 할 일:

PHASE A:

v0.1.30 test environment 정상화.

npm test full regression.

v0.1.30 clean commit.

PHASE B:

v0.1.31
Iron Vein Boss Pass.

6~10F actual 5 bosses 구현.

필수:

MonsterDefinition
skills
AI
encounter mapping
status telegraph
save/reload
revival regression
boss artwork

artwork는:

E:\탑의 기록\일러스트

에서 실제 파일을 가져온다.

==================================================
74. RECOMMENDED ROADMAP AFTER IRON BOSSES
==================================================

현재 추천 순서:

v0.1.32
Exploration / Random Events

목표:
전투 반복 사이에 사건/선택 추가.

단,
과거 common event list 복원이 우선.

v0.1.33
Random Equipment Enhancement

목표:
Silver + material sink
장비 성장 loop.

v0.1.34
Death Equipment Destruction

목표:
사망 위험 강화
장비 경제 순환.

v0.1.35
Equipment Icon / Tier UI

목표:
Roman I~V
tier background colors
same item same appearance.

v0.1.36
First Real Job Vertical Slice

한 직업을:

Passive 2
Active 3

완성하여
나머지 job template로 사용.

이 버전 번호/순서는 추천 roadmap이며
사용자가 다음 결정을 바꾸면 최신 결정이 우선.

==================================================
75. WHY EVENTS BEFORE ENHANCEMENT
==================================================

현재 10층 구조에서
1~5F는 boss가 없고
same monster pool + floor scaling 중심이다.

따라서 events를 추가하면:

전투
→ 선택
→ 전투
→ 탐색
→ reward/risk
→ boss

식으로 즉각적인 플레이 변화가 크다.

Equipment Enhancement는
장기 성장 loop에 매우 중요하지만:

- probability
- failure
- costs
- scaling
- save
- economy
- destruction follow-up

결정이 많이 필요.

따라서 content richness를 위해
events가 먼저라는 추천이 있었다.

==================================================
76. CODEX WORKING RULES
==================================================

앞으로 모든 implementation task에서:

첫 번째:

repo inspect.

반드시:

git status
git branch
git log
실제 code 조사.

계획만 제출하고 멈추지 않는다.

실제 파일 수정까지 한다.

==================================================
77. SAVE CHANGE RULE
==================================================

save field 추가/의미 변경 시:

schema bump 필요 여부 판단.

필요할 때만 bump.

무조건 version 증가 금지.

schema bump 시:

migration
+
backup-before-convert
+
validation
+
old save tests

필수.

==================================================
78. TEST RULE
==================================================

변경 후 최소:

npm test

npm run typecheck

npm run build

node scripts/standalone.mjs

git diff --check

실행.

Windows autocrlf가 관련된 repo면
현재 repository convention 사용.

실행하지 못했다면:

PASS라고 쓰지 않는다.

환경 문제와 assertion failure를 구분한다.

==================================================
79. MOBILE QA
==================================================

UI 변경 시 최소:

320px width

390 × 844

확인.

특히:

- overflow
- button clipping
- modal
- battle controls
- inventory icons
- boss sprite
- status effects

확인.

==================================================
80. GIT RULE
==================================================

사용자가 명시하지 않았다면:

- force push 금지
- history rewrite 금지
- destructive reset 금지
- existing tag 이동 금지
- main merge 금지
- GitHub push 금지

필요한 local commit은 task에 따라 가능.

push/tag는 별도 승인 또는 task에 명시.

==================================================
81. ASSET RULE
==================================================

외부 asset source를 사용할 경우:

원본 보호.

project 내부 copy.

runtime absolute path 금지.

build 확인.

standalone 확인.

pixel art:

blur/smoothing 금지.

==================================================
82. BALANCE RULE
==================================================

사용자가 확정하지 않은 exact numeric balance를
임의로 final canon으로 만들지 않는다.

필요하면:

PROVISIONAL

값으로 중앙 config에 둔다.

예:

potion current percentages
boss HP
boss skill multiplier
stack threshold
gear destruction floor chance
enhancement rate
repair cost

등.

==================================================
83. DOCUMENTATION STATUS LABELS
==================================================

앞으로 보고할 때 가능하면:

PRODUCTION
PARTIAL
DECLARED_ONLY
DEV_ONLY
LEGACY
PLANNED
NOT_IMPLEMENTED
DEPRECATED

상태를 구분한다.

특히:

PLANNED ≠ PRODUCTION.

==================================================
84. USER DEVELOPMENT STYLE
==================================================

사용자는 게임 개발 경험이 거의 없는 상태에서
ChatGPT 설계 + Codex implementation을 사용하여
프로젝트를 개발하고 있다.

따라서 Codex는:

불필요하게 추상적인 설명만 하지 말고
실제 구현을 완료해야 한다.

하지만 사용자 결정을 대신하여
대형 설계 변경을 임의로 하면 안 된다.

사용자가 확정하지 않은 핵심 시스템은
멋대로 canon으로 만들지 않는다.

==================================================
85. CORE DESIGN PILLARS
==================================================

이 게임을 개발할 때 항상 유지할 핵심:

1.
탐사는 위험하다.

2.
탑 내부 획득물은
살아서 귀환해야 진짜 소유가 된다.

3.
짧은 10층 구조라도
각 탑은 고유한 분위기와 전투 정체성을 가져야 한다.

4.
일반 monster를 층마다 무한 증식시키기보다
same pool + scaling + events + bosses로 밀도를 만든다.

5.
6~10F는 연속 boss 관문.

6.
장비는 성장 자산이지만
향후 사망/PK로 위험에 노출된다.

7.
경제는 Silver와 material의 순환이 중요하다.

8.
PvP는 무의미한 ganking보다
희귀 자원 경쟁이라는 이유가 있어야 한다.

9.
Tower Occupation War와
개인 rare-resource PK는 서로 다른 시스템이다.

10.
실제 online economy에서는 server authority가 필수.

==================================================
86. CURRENT UNCERTAINTIES / DO NOT INVENT
==================================================

아직 확정되지 않은 것:

- exact boss numerical balance
- exact floor destruction probabilities
- enhancement success/failure numbers
- repair costs
- equipment insurance
- recovery seal
- exact T5 revival recipe
- final potion healing balance
- full common event catalog
- Crystal Tower bosses
- full Caleon 6~9F boss lineup
- full Caleon 10-floor story compression
- real PvP backend architecture implementation schedule
- Gold monetization exact pricing
- job gacha rates/pity
- all 25 job combat kits

사용자가 확정하기 전
임의 canon 금지.

==================================================
87. FINAL RULE TO CODEX
==================================================

새 작업 요청을 받으면:

1.
이 MASTER CONTEXT를 참고한다.

2.
actual repository를 inspect한다.

3.
현재 구현 상태와 요청의 차이를 파악한다.

4.
latest user decision을 우선한다.

5.
deprecated design을 되살리지 않는다.

6.
save compatibility를 보호한다.

7.
production / planned / legacy를 구분한다.

8.
실제 구현한다.

9.
test/build/standalone까지 검증한다.

10.
결과를 정확히 보고한다.

실제 코드가 이 문서보다 최신이면
실제 코드를 우선하고,
그 차이를 최종 보고에 명시한다.