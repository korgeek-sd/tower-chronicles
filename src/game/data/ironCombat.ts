import type {MonsterDefinition} from '../engine/monsterAi';

export const IRON_NORMAL_DEFINITIONS:MonsterDefinition[]=
[
  {
    "id": "goblin_miner",
    "name": "고블린 광부",
    "skills": [
      {
        "id": "miner_pick",
        "name": "곡괭이 내려찍기",
        "description": "공격력의 130% 피해",
        "cooldown": 2,
        "kind": "damage",
        "multiplier": 1.3,
        "hits": 1
      },
      {
        "id": "miner_dust",
        "name": "광석 가루",
        "description": "공격력의 80% 피해, 플레이어에게 공격력 -15% · 2턴",
        "cooldown": 4,
        "kind": "damage",
        "multiplier": 0.8,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_attack_down_15"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "miner_dust",
        "priority": 30,
        "actionId": "miner_dust",
        "conditions": [
          {
            "kind": "TARGET_MISSING_EFFECT",
            "effectId": "iron_attack_down_15"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "miner_dust"
          }
        ]
      },
      {
        "id": "miner_pick",
        "priority": 20,
        "actionId": "miner_pick",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "miner_pick"
          }
        ]
      }
    ]
  },
  {
    "id": "cave_rat",
    "name": "동굴 쥐",
    "skills": [
      {
        "id": "rat_double_bite",
        "name": "연속 물어뜯기",
        "description": "공격력의 55% × 2회 피해",
        "cooldown": 2,
        "kind": "damage",
        "multiplier": 0.55,
        "hits": 2
      }
    ],
    "aiRules": [
      {
        "id": "rat_double_bite",
        "priority": 20,
        "actionId": "rat_double_bite",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "rat_double_bite"
          }
        ]
      }
    ]
  },
  {
    "id": "mine_bat",
    "name": "광산 박쥐",
    "skills": [
      {
        "id": "bat_dive",
        "name": "급강하",
        "description": "1턴 준비 후 공격력의 170% 피해",
        "cooldown": 3,
        "kind": "charge",
        "multiplier": 1.7
      },
      {
        "id": "bat_screech",
        "name": "날카로운 울음",
        "description": "플레이어에게 공격력 -20% · 2턴",
        "cooldown": 4,
        "kind": "effect",
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_attack_down_20"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "bat_dive",
        "priority": 30,
        "actionId": "bat_dive",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "bat_dive"
          }
        ]
      },
      {
        "id": "bat_screech",
        "priority": 20,
        "actionId": "bat_screech",
        "conditions": [
          {
            "kind": "TARGET_MISSING_EFFECT",
            "effectId": "iron_attack_down_20"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "bat_screech"
          }
        ]
      }
    ]
  },
  {
    "id": "goblin_carrier",
    "name": "고블린 운반꾼",
    "skills": [
      {
        "id": "carrier_shield",
        "name": "광석 자루 방패",
        "description": "자신에게 최대 HP 15% 보호막",
        "cooldown": 4,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_carrier_shield"
          }
        ]
      },
      {
        "id": "carrier_swing",
        "name": "자루 휘두르기",
        "description": "공격력의 120% 피해",
        "cooldown": 2,
        "kind": "damage",
        "multiplier": 1.2,
        "hits": 1
      }
    ],
    "aiRules": [
      {
        "id": "carrier_shield",
        "priority": 30,
        "actionId": "carrier_shield",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_carrier_shield"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "carrier_shield"
          }
        ]
      },
      {
        "id": "carrier_swing",
        "priority": 20,
        "actionId": "carrier_swing",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "carrier_swing"
          }
        ]
      }
    ]
  },
  {
    "id": "goblin_overseer",
    "name": "고블린 감독관",
    "skills": [
      {
        "id": "overseer_haste",
        "name": "작업 독촉",
        "description": "자신에게 공격력 +20% · 2턴",
        "cooldown": 4,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_attack_20"
          }
        ]
      },
      {
        "id": "overseer_whip",
        "name": "채찍 후려치기",
        "description": "공격력의 130% 피해, 플레이어에게 방어력 -15% · 2턴",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 1.3,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_defense_down_15"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "overseer_haste",
        "priority": 30,
        "actionId": "overseer_haste",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_attack_20"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "overseer_haste"
          }
        ]
      },
      {
        "id": "overseer_whip",
        "priority": 20,
        "actionId": "overseer_whip",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "overseer_whip"
          }
        ]
      }
    ]
  }
];

export const IRON_BOSS_DEFINITIONS:MonsterDefinition[]=
[
  {
    "id": "iron_maw_burrower",
    "name": "쇄철턱 굴혈수",
    "skills": [
      {
        "id": "iron_maw_bite",
        "name": "쇄철 물기",
        "description": "공격력의 120% 피해, 플레이어에게 방어력 -15% · 2턴",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 1.2,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_defense_down_15"
          }
        ]
      },
      {
        "id": "burrow_charge",
        "name": "굴진 돌격",
        "description": "1턴 준비 후 공격력의 205% 피해",
        "cooldown": 3,
        "kind": "charge",
        "multiplier": 2.05
      },
      {
        "id": "iron_maw_guard",
        "name": "철턱 움츠리기",
        "description": "자신에게 받는 피해 -25% · 2턴",
        "cooldown": 4,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_guard_25"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "burrow_charge",
        "priority": 40,
        "actionId": "burrow_charge",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "burrow_charge"
          }
        ]
      },
      {
        "id": "iron_maw_bite",
        "priority": 20,
        "actionId": "iron_maw_bite",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "iron_maw_bite"
          }
        ]
      },
      {
        "id": "iron_maw_guard",
        "priority": 10,
        "actionId": "iron_maw_guard",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_guard_25"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "iron_maw_guard"
          }
        ]
      }
    ]
  },
  {
    "id": "black_vein_armor_breaker",
    "name": "흑맥갑주 파쇄충",
    "skills": [
      {
        "id": "armor_up",
        "name": "흑맥 갑주",
        "description": "자신에게 방어력 +50% · 3턴, 실제 HP 피해를 주는 직접 타격 3회 시 갑주 파괴 및 방어력 -35% · 2턴",
        "cooldown": 5,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_armor"
          }
        ]
      },
      {
        "id": "breaker_slam",
        "name": "파쇄 강타",
        "description": "공격력의 155% 피해",
        "cooldown": 2,
        "kind": "damage",
        "multiplier": 1.55,
        "hits": 1
      },
      {
        "id": "armor_fragments",
        "name": "갑주 파편",
        "description": "공격력의 70% × 2회 피해",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 0.7,
        "hits": 2
      }
    ],
    "aiRules": [
      {
        "id": "armor_up",
        "priority": 30,
        "actionId": "armor_up",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_armor"
          },
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "exposed_core"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "armor_up"
          }
        ]
      },
      {
        "id": "breaker_slam",
        "priority": 20,
        "actionId": "breaker_slam",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "breaker_slam"
          }
        ]
      },
      {
        "id": "armor_fragments",
        "priority": 10,
        "actionId": "armor_fragments",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "armor_fragments"
          }
        ]
      }
    ]
  },
  {
    "id": "echo_devourer",
    "name": "울림포식자",
    "skills": [
      {
        "id": "echo_mark",
        "name": "울림 각인",
        "description": "공격력의 90% 피해, 플레이어에게 울림 · 3턴, 공명 돌진 대상 지정",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 0.9,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "resonance"
          }
        ]
      },
      {
        "id": "resonant_charge",
        "name": "공명 돌진",
        "description": "1턴 준비 후 공격력의 215% 피해",
        "cooldown": 3,
        "kind": "charge",
        "multiplier": 2.15
      },
      {
        "id": "echo_shield",
        "name": "공명 차폐",
        "description": "자신에게 최대 HP 12% 보호막",
        "cooldown": 4,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_echo_shield"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "resonant_charge",
        "priority": 50,
        "actionId": "resonant_charge",
        "conditions": [
          {
            "kind": "TARGET_HAS_EFFECT",
            "effectId": "resonance"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "resonant_charge"
          }
        ]
      },
      {
        "id": "echo_mark",
        "priority": 40,
        "actionId": "echo_mark",
        "conditions": [
          {
            "kind": "TARGET_MISSING_EFFECT",
            "effectId": "resonance"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "echo_mark"
          }
        ]
      },
      {
        "id": "echo_shield",
        "priority": 30,
        "actionId": "echo_shield",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_echo_shield"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "echo_shield"
          }
        ]
      }
    ]
  },
  {
    "id": "deep_hoist_overseer",
    "name": "심층 권양감독체",
    "skills": [
      {
        "id": "counter_prepare",
        "name": "권양 반격 준비",
        "description": "다음 직접 공격에 1회 반격",
        "cooldown": 4,
        "kind": "reactive_prepare",
        "reactiveTrigger": "DIRECT_HIT_RECEIVED",
        "reactionSkillId": "counter_strike"
      },
      {
        "id": "counter_strike",
        "name": "권양 반격",
        "description": "공격력의 90% 피해",
        "cooldown": 0,
        "kind": "damage",
        "multiplier": 0.9,
        "hits": 1
      },
      {
        "id": "hoist_charge",
        "name": "권양 추락",
        "description": "1턴 준비 후 공격력의 225% 피해",
        "cooldown": 3,
        "kind": "charge",
        "multiplier": 2.25
      },
      {
        "id": "chain_pressure",
        "name": "쇠사슬 압박",
        "description": "공격력의 110% 피해, 플레이어에게 방어력 -20% · 2턴",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 1.1,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_pressure"
          }
        ]
      }
    ],
    "aiRules": [
      {
        "id": "counter_prepare",
        "priority": 30,
        "actionId": "counter_prepare",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "counter_prepare"
          }
        ]
      },
      {
        "id": "hoist_charge",
        "priority": 20,
        "actionId": "hoist_charge",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "hoist_charge"
          }
        ]
      },
      {
        "id": "chain_pressure",
        "priority": 10,
        "actionId": "chain_pressure",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "chain_pressure"
          }
        ]
      }
    ]
  },
  {
    "id": "iron_core_pulsator",
    "name": "철심 맥동체",
    "skills": [
      {
        "id": "core_shield",
        "name": "철심 보호막",
        "description": "자신에게 최대 HP 15% 보호막",
        "cooldown": 5,
        "kind": "effect",
        "effects": [
          {
            "target": "SELF",
            "effectId": "iron_core_shield"
          }
        ]
      },
      {
        "id": "pulse_debuff",
        "name": "압착 맥동",
        "description": "공격력의 120% 피해, 플레이어에게 방어력 -20% · 2턴",
        "cooldown": 3,
        "kind": "damage",
        "multiplier": 1.2,
        "hits": 1,
        "effects": [
          {
            "target": "TARGET",
            "effectId": "iron_pressure"
          }
        ]
      },
      {
        "id": "terminal_charge",
        "name": "종말 맥동",
        "description": "1턴 준비 후 공격력의 250% 피해",
        "cooldown": 4,
        "kind": "charge",
        "multiplier": 2.5
      }
    ],
    "aiRules": [
      {
        "id": "terminal_charge",
        "priority": 50,
        "actionId": "terminal_charge",
        "conditions": [
          {
            "kind": "SELF_HP_BELOW",
            "value": 0.5
          },
          {
            "kind": "SKILL_READY",
            "skillId": "terminal_charge"
          }
        ]
      },
      {
        "id": "core_shield",
        "priority": 40,
        "actionId": "core_shield",
        "conditions": [
          {
            "kind": "SELF_MISSING_EFFECT",
            "effectId": "iron_core_shield"
          },
          {
            "kind": "SKILL_READY",
            "skillId": "core_shield"
          }
        ]
      },
      {
        "id": "pulse_debuff",
        "priority": 30,
        "actionId": "pulse_debuff",
        "conditions": [
          {
            "kind": "SKILL_READY",
            "skillId": "pulse_debuff"
          }
        ]
      }
    ]
  }
];
