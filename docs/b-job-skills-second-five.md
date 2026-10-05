# B등급 직업 스킬 기획 — 2차 5종

확정일: 2026-10-05
상태: 사용자 승인 기획 및 이미지 에셋. 전투 코드와 이미지 레지스트리 미연결.

## 공통 규칙

- 기존 직접 공격, 다중 타격, 회복, 상태이상 제거, 피해 증감, 적 HP 30% 이하 조건, 전투 자원만 사용한다.
- 자원은 0 시작, 최대 4칸. 새로운 전투 규칙을 추가하지 않는다.
- 출혈은 2턴간 턴 종료마다 피해 5. 부여한 턴에는 지속 피해 없음. 재부여 시 지속시간 갱신.
- 아래 파일명은 에셋 식별용이며 실제 스킬 ID는 전투 구현 시 확정한다.

| 직업 / job_id | 스킬 | 효과 | 자원 | 쿨다운 | 에셋 파일 |
|---|---|---|---|---|---|
| 대속자 / redeemer | 속죄의 타격 | 공격력 110% 단일 피해 | +1 | 1턴 | redeemer_skill_1.webp |
| 대속자 / redeemer | 고통을 견디는 기도 | 2턴간 받는 피해 30% 감소 | 없음 | 4턴 | redeemer_skill_2.webp |
| 대속자 / redeemer | 대속의 빛 | 자신의 최대 HP 25% 회복, 출혈·중독 제거 | -3 | 5턴 | redeemer_skill_3.webp |
| 등불지기 / lantern_keeper | 등불 타격 | 공격력 115% 단일 피해 | +1 | 1턴 | lantern_keeper_skill_1.webp |
| 등불지기 / lantern_keeper | 꺼지지 않는 불빛 | 2턴간 공격 피해 20% 증가, 받는 피해 15% 감소 | 없음 | 4턴 | lantern_keeper_skill_2.webp |
| 등불지기 / lantern_keeper | 어둠 가르기 | 공격력 250% 단일 피해 | -2 | 4턴 | lantern_keeper_skill_3.webp |
| 유품회수인 / relic_collector | 회수용 단검 | 공격력 120% 단일 피해 | +1 | 1턴 | relic_collector_skill_1.webp |
| 유품회수인 / relic_collector | 갈고리 찢기 | 공격력 90% 피해, 2턴간 턴 종료마다 출혈 피해 5 | 없음 | 3턴 | relic_collector_skill_2.webp |
| 유품회수인 / relic_collector | 마지막 회수 | 공격력 220% 피해, 적 HP 30% 이하이면 300% | -2 | 4턴 | relic_collector_skill_3.webp |
| 몬스터 해체꾼 / monster_dismantler | 해체칼 내려치기 | 공격력 130% 단일 피해 | +1 | 1턴 | monster_dismantler_skill_1.webp |
| 몬스터 해체꾼 / monster_dismantler | 깊게 도려내기 | 공격력 110% 피해, 2턴간 턴 종료마다 출혈 피해 5 | 없음 | 4턴 | monster_dismantler_skill_2.webp |
| 몬스터 해체꾼 / monster_dismantler | 절단 | 공격력 280% 단일 피해 | -3 | 4턴 | monster_dismantler_skill_3.webp |
| 탐사기록원 / expedition_archivist | 기록봉 타격 | 공격력 105% 단일 피해 | +1 | 1턴 | expedition_archivist_skill_1.webp |
| 탐사기록원 / expedition_archivist | 전투 기록 검토 | 2턴간 공격 피해 25% 증가 | 없음 | 4턴 | expedition_archivist_skill_2.webp |
| 탐사기록원 / expedition_archivist | 기록대로 공략 | 공격력 120%씩 2회 피해 | -2 | 4턴 | expedition_archivist_skill_3.webp |
