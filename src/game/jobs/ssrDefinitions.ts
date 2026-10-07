import type {JobCombatDefinition} from './framework';

export const SSR_JOB_DEFINITIONS:JobCombatDefinition[]=
[
  {
    "jobId": "dragonblood_knight",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "dragonblood_knight_skill_1",
        "name": "용혈 참격",
        "description": "240% 피해, 방어 관통 25%",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.4,
            "penetrationRate": 0.25
          }
        ]
      },
      {
        "id": "dragonblood_knight_skill_2",
        "name": "용혈 각성",
        "description": "HP 10% 소비, 3턴간 공격력 +30%·받는 피해 -30%, 자원 +1",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "SELF_HP_COST_PERCENT",
            "percentOfMax": 0.1
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "attack_up",
            "target": "SELF",
            "duration": 3
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "b_guard_30",
            "target": "SELF",
            "duration": 3
          },
          {
            "kind": "CHANGE_RESOURCE",
            "delta": 1
          }
        ]
      },
      {
        "id": "dragonblood_knight_skill_3",
        "name": "멸룡의 일격",
        "description": "700% 피해, 방어 관통 50%, HP 50% 이하 시 850%",
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
            "baseMultiplier": 7,
            "penetrationRate": 0.5,
            "conditionalLastHitMultiplier": {
              "condition": {
                "kind": "SELF_HP_RATIO_LE",
                "ratio": 0.5
              },
              "multiplier": 8.5
            }
          }
        ]
      }
    ]
  },
  {
    "jobId": "sealed_archivist",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "sealed_archivist_skill_1",
        "name": "봉인 문장",
        "description": "220% 피해, 2턴간 방어력 -20%",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.2
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "weaken",
            "target": "TARGET",
            "duration": 2
          }
        ]
      },
      {
        "id": "sealed_archivist_skill_2",
        "name": "금서 개방",
        "description": "강화 3개 해제 후 300% 피해, 3턴간 방어력 -20%",
        "cooldown": 3,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "DISPEL",
            "target": "TARGET",
            "count": 3
          },
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 3
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "weaken",
            "target": "TARGET",
            "duration": 3
          }
        ]
      },
      {
        "id": "sealed_archivist_skill_3",
        "name": "종언 기록",
        "description": "680% 피해, 방어 관통 40%, 방어력 약화 시 820%",
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
            "baseMultiplier": 6.8,
            "penetrationRate": 0.4,
            "conditionalLastHitMultiplier": {
              "condition": {
                "kind": "TARGET_HAS_EFFECT",
                "effectId": "weaken"
              },
              "multiplier": 8.2
            }
          }
        ]
      }
    ]
  },
  {
    "jobId": "corpse_tuner",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "corpse_tuner_skill_1",
        "name": "망자의 손길",
        "description": "80% × 3회 피해, HP 5% 회복",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 3,
            "baseMultiplier": 0.8
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.05
          }
        ]
      },
      {
        "id": "corpse_tuner_skill_2",
        "name": "사체 봉합",
        "description": "약화 3개 정화, HP 35% 회복, 2턴간 받는 피해 -30%",
        "cooldown": 3,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "CLEANSE",
            "target": "SELF",
            "count": 3
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.35
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "b_guard_30",
            "target": "SELF",
            "duration": 2
          }
        ]
      },
      {
        "id": "corpse_tuner_skill_3",
        "name": "장송 합주",
        "description": "140% × 5회 피해, HP 25% 회복",
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
            "hits": 5,
            "baseMultiplier": 1.4
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.25
          }
        ]
      }
    ]
  },
  {
    "jobId": "self_alchemist",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "self_alchemist_skill_1",
        "name": "적석 관통",
        "description": "250% 피해, 방어 관통 30%",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.5,
            "penetrationRate": 0.3
          }
        ]
      },
      {
        "id": "self_alchemist_skill_2",
        "name": "육신 연성",
        "description": "HP 15% 소비(최소 1), 자원 +2, 2턴간 공격력 +30%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "SELF_HP_COST_PERCENT",
            "percentOfMax": 0.15
          },
          {
            "kind": "CHANGE_RESOURCE",
            "delta": 2
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "attack_up",
            "target": "SELF",
            "duration": 2
          }
        ]
      },
      {
        "id": "self_alchemist_skill_3",
        "name": "현자의 붕괴",
        "description": "750% 피해, 방어 관통 40%, HP 50% 이하 시 900%",
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
            "baseMultiplier": 7.5,
            "penetrationRate": 0.4,
            "conditionalLastHitMultiplier": {
              "condition": {
                "kind": "SELF_HP_RATIO_LE",
                "ratio": 0.5
              },
              "multiplier": 9
            }
          }
        ]
      }
    ]
  },
  {
    "jobId": "black_carriage_gambler",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "black_carriage_gambler_skill_1",
        "name": "패 던지기",
        "description": "110% × 2회 피해",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 2,
            "baseMultiplier": 1.1
          }
        ]
      },
      {
        "id": "black_carriage_gambler_skill_2",
        "name": "조작된 패",
        "description": "280% 피해, 확정 치명타, 자원 +1",
        "cooldown": 3,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.8,
            "critical": "GUARANTEED"
          },
          {
            "kind": "CHANGE_RESOURCE",
            "delta": 1
          }
        ]
      },
      {
        "id": "black_carriage_gambler_skill_3",
        "name": "올인 — 죽음의 패",
        "description": "650% 피해, 확정 치명타, 방어 관통 40%",
        "cooldown": 5,
        "resource": {
          "kind": "SPENDER",
          "cost": {
            "mode": "FIXED",
            "amount": 4
          }
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 6.5,
            "penetrationRate": 0.4,
            "critical": "GUARANTEED"
          }
        ]
      }
    ]
  },
  {
    "jobId": "false_saint_proxy",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "false_saint_proxy_skill_1",
        "name": "위성의 빛",
        "description": "220% 피해, HP 5% 회복",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.2
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.05
          }
        ]
      },
      {
        "id": "false_saint_proxy_skill_2",
        "name": "거짓 기적",
        "description": "약화 3개 정화, HP 40% 회복, 2턴간 받는 피해 -40%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "CLEANSE",
            "target": "SELF",
            "count": 3
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.4
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "guard",
            "target": "SELF",
            "duration": 2
          }
        ]
      },
      {
        "id": "false_saint_proxy_skill_3",
        "name": "찬탈된 심판",
        "description": "강화 3개 해제 후 650% 피해, HP 30% 회복",
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
            "kind": "DISPEL",
            "target": "TARGET",
            "count": 3
          },
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 6.5
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.3
          }
        ]
      }
    ]
  },
  {
    "jobId": "hundred_battle_returnee",
    "resource": {
      "id": "combat",
      "initialValue": 0,
      "maxValue": 4
    },
    "passives": [],
    "skills": [
      {
        "id": "hundred_battle_returnee_skill_1",
        "name": "백전의 검",
        "description": "240% 피해, 방어 관통 20%",
        "cooldown": 0,
        "resource": {
          "kind": "GENERATOR",
          "gain": 1
        },
        "effectActions": [
          {
            "kind": "DIRECT_ATTACK",
            "hits": 1,
            "baseMultiplier": 2.4,
            "penetrationRate": 0.2
          }
        ]
      },
      {
        "id": "hundred_battle_returnee_skill_2",
        "name": "불패의 정비",
        "description": "약화 3개 정화, HP 30% 회복, 3턴간 받는 피해 -30%",
        "cooldown": 4,
        "resource": {
          "kind": "NEUTRAL"
        },
        "effectActions": [
          {
            "kind": "CLEANSE",
            "target": "SELF",
            "count": 3
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.3
          },
          {
            "kind": "APPLY_EFFECT",
            "effectId": "b_guard_30",
            "target": "SELF",
            "duration": 3
          }
        ]
      },
      {
        "id": "hundred_battle_returnee_skill_3",
        "name": "마지막 귀환",
        "description": "700% 피해, HP 50% 이하 시 850%, 공격 후 HP 35% 회복",
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
            "baseMultiplier": 7,
            "conditionalLastHitMultiplier": {
              "condition": {
                "kind": "SELF_HP_RATIO_LE",
                "ratio": 0.5
              },
              "multiplier": 8.5
            }
          },
          {
            "kind": "HEAL_PERCENT",
            "percent": 0.35
          }
        ]
      }
    ]
  }
];
