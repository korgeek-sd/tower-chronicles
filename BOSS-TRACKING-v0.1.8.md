# v0.1.8 보스 추적도 · 보스 조우

- 저장 schema를 v6으로 올리고 진행 중 원정에 `bossTracking`을 추가했습니다: `progress`, `pendingBossId`, `encounterReason`, `bossDefeated`.
- v5 저장은 `tower-record-v1-before-boss-tracking-v6`에 한 번 백업한 뒤 기존 상태를 그대로 보존하여 이전합니다.
- `bossId`가 있는 층에서 일반 몬스터를 처치하면 추적도가 오릅니다. 임시 밸런스는 `src/game/engine/bossTracking.ts`의 `BOSS_TRACKING_BALANCE`에 모았습니다.
- 현재 임시값은 처치당 20%, 100% 미만 조기 발견 확률 12%입니다.
- 조우 중 자동전투가 정지하며, 도전하면 catalog의 광산 오우거가 기존 전투 엔진으로 생성됩니다.
- 조기 발견 거절은 진행도를 유지하고, 100% 발견 거절은 0으로 초기화합니다.
- 보스 보상도 원정 임시 전리품이며 직접 안전 귀환해야 확보됩니다. 보스 처치 뒤 같은 원정에서는 다시 추적하지 않습니다.
