import type {JobCombatDefinition} from './framework';

export const C_JOB_DEFINITIONS:JobCombatDefinition[]=
[
  {
    "jobId": "excavator",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "excavator_skill_1",
        "name": "곡괭이 타격",
        "description": "125% 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1.25
          }
        ]
      },
      {
        "id": "excavator_skill_2",
        "name": "작업 자세",
        "description": "2턴간 공격력 +20%·방어력 +25%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_attack_20",
            "duration": 2
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_defense_25",
            "duration": 2
          }
        ]
      },
      {
        "id": "excavator_skill_3",
        "name": "암반 분쇄",
        "description": "280% 피해, 기절 1턴",
        "cooldown": 4,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 3
          }
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.8
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "TARGET",
            "effectId": "stun",
            "duration": 1
          }
        ]
      }
    ]
  },
  {
    "jobId": "reclaimer",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "reclaimer_skill_1",
        "name": "회수용 칼질",
        "description": "115% 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1.15
          }
        ]
      },
      {
        "id": "reclaimer_skill_2",
        "name": "악착같은 회수",
        "description": "100% 피해, 공격력의 50% 회복",
        "cooldown": 3,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1
          },
          {
            "kind": "HEAL_ATTACK",
            "multiplier": 0.5
          }
        ]
      },
      {
        "id": "reclaimer_skill_3",
        "name": "싹쓸이",
        "description": "250% 피해, 공격력의 80% 회복",
        "cooldown": 3,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 2
          }
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.5
          },
          {
            "kind": "HEAL_ATTACK",
            "multiplier": 0.8
          }
        ]
      }
    ]
  },
  {
    "jobId": "green_crown_pilgrim",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "green_crown_pilgrim_skill_1",
        "name": "순례자의 지팡이",
        "description": "110% 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1.1
          }
        ]
      },
      {
        "id": "green_crown_pilgrim_skill_2",
        "name": "고행의 기도",
        "description": "3턴간 공격력 +15%·방어력 +25%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_attack_15",
            "duration": 3
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_defense_25",
            "duration": 3
          }
        ]
      },
      {
        "id": "green_crown_pilgrim_skill_3",
        "name": "녹관의 은총",
        "description": "공격력의 190% 회복, 2턴간 방어력 +30%",
        "cooldown": 3,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 2
          }
        },
        "effectActions": [
          {
            "kind": "HEAL_ATTACK",
            "multiplier": 1.9
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_defense_30",
            "duration": 2
          }
        ]
      }
    ]
  },
  {
    "jobId": "porter",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "porter_skill_1",
        "name": "짐짝 후려치기",
        "description": "105% 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1.05
          }
        ]
      },
      {
        "id": "porter_skill_2",
        "name": "짐으로 막기",
        "description": "최대 HP의 18% 보호막",
        "cooldown": 3,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_porter_shield_18",
            "duration": 3
          }
        ]
      },
      {
        "id": "porter_skill_3",
        "name": "악착같이 버티기",
        "description": "최대 HP의 30% 보호막, 2턴간 방어력 +30%",
        "cooldown": 4,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 2
          }
        },
        "effectActions": [
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_porter_shield_30",
            "duration": 3
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_defense_30",
            "duration": 2
          }
        ]
      }
    ]
  },
  {
    "jobId": "guide",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "guide_skill_1",
        "name": "길목 베기",
        "description": "110% 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 1.1
          }
        ]
      },
      {
        "id": "guide_skill_2",
        "name": "길잡이의 판단",
        "description": "2턴간 공격력 +25%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "APPLY_EFFECT",
            "target": "SELF",
            "effectId": "c_attack_25",
            "duration": 2
          }
        ]
      },
      {
        "id": "guide_skill_3",
        "name": "퇴로 차단",
        "description": "220% 피해, 침묵 1턴",
        "cooldown": 4,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 2
          }
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.2
          },
          {
            "kind": "APPLY_EFFECT",
            "target": "TARGET",
            "effectId": "silence",
            "duration": 1
          }
        ]
      }
    ]
  }
];
