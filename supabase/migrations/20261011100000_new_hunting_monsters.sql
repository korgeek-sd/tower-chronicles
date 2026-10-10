-- 50 brand new hunt monsters, three deterministic skills each, individual base stats.
-- Keep server-authenticated loot, wallet, skill selection, and session lock order unchanged.
create or replace function private.hunting_monster_catalog() returns jsonb language sql immutable set search_path='' as $$
 select $monsters${
  "plains": [
    {
      "id": "grave_digger_hound",
      "name": "무덤파는 들개",
      "description": "무덤 흙이 붙은 거대한 앞발",
      "skills": [
        {
          "name": "흙송곳",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "뼈 물어뜯기",
          "power": 0.8,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "매장 습격",
          "power": 1.45,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 90,
      "attack": 12,
      "defense": 4,
      "image": "assets/monsters/new/plains/grave_digger_hound.svg",
      "role": "bruiser"
    },
    {
      "id": "folded_hide_stag",
      "name": "피부접힌 사슴",
      "description": "피부가 여러 겹 아래로 접힌 사슴",
      "skills": [
        {
          "name": "갈라진 뿔",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "허물 방패",
          "power": 0,
          "effect": "shield",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "반쪽 질주",
          "power": 0.75,
          "effect": "none",
          "value": 0,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 99,
      "attack": 11,
      "defense": 5,
      "image": "assets/monsters/new/plains/folded_hide_stag.svg",
      "role": "guardian"
    },
    {
      "id": "sawbeak_crow",
      "name": "톱니부리 까마귀",
      "description": "쇠톱처럼 갈라진 부리",
      "skills": [
        {
          "name": "주워 찢기",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "눈 쪼기",
          "power": 0.9,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "철편 쏟기",
          "power": 1.3,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.15,
          "turns": [
            4
          ]
        }
      ],
      "hp": 71,
      "attack": 13,
      "defense": 4,
      "image": "assets/monsters/new/plains/sawbeak_crow.svg",
      "role": "assassin"
    },
    {
      "id": "drain_toad",
      "name": "배수로 두꺼비",
      "description": "배에 봉합 자국이 있는 거대 두꺼비",
      "skills": [
        {
          "name": "진흙 핥기",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "썩은 침",
          "power": 0.8,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "수로 삼키기",
          "power": 1.35,
          "effect": "leech",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 105,
      "attack": 11,
      "defense": 6,
      "image": "assets/monsters/new/plains/drain_toad.svg",
      "role": "bruiser"
    },
    {
      "id": "needle_hands_scarecrow",
      "name": "빈손 허수아비",
      "description": "손가락 대신 바늘이 달린 허수아비",
      "skills": [
        {
          "name": "바늘손",
          "power": 0.95,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "겁주기",
          "power": 0,
          "effect": "attack_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "볏짚 폭산",
          "power": 1.35,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 81,
      "attack": 12,
      "defense": 4,
      "image": "assets/monsters/new/plains/needle_hands_scarecrow.svg",
      "role": "guardian"
    },
    {
      "id": "plowback_beast",
      "name": "쟁기등 짐승",
      "description": "척추에 녹슨 쟁기가 박힌 짐승",
      "skills": [
        {
          "name": "쟁기 찍기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "흙 보호",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "밭고랑 갈기",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 106,
      "attack": 13,
      "defense": 6,
      "image": "assets/monsters/new/plains/plowback_beast.svg",
      "role": "assassin"
    },
    {
      "id": "chain_tail_rat",
      "name": "사슬꼬리 들쥐",
      "description": "꼬리가 쇠사슬로 변한 거대 쥐",
      "skills": [
        {
          "name": "꼬리 채찍",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "쇠사슬 회전",
          "power": 0.75,
          "effect": "none",
          "value": 0,
          "hits": 2,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "사슬 질식",
          "power": 1.25,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 72,
      "attack": 14,
      "defense": 4,
      "image": "assets/monsters/new/plains/chain_tail_rat.svg",
      "role": "bruiser"
    },
    {
      "id": "reed_neck_giant",
      "name": "갈대목 거인",
      "description": "목이 긴 갈대 줄기로 이루어진 거인",
      "skills": [
        {
          "name": "갈대 찌르기",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "갈대 숨기",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "목 내리누르기",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 108,
      "attack": 13,
      "defense": 6,
      "image": "assets/monsters/new/plains/reed_neck_giant.svg",
      "role": "guardian"
    },
    {
      "id": "bone_shell_snail",
      "name": "뼈껍질 달팽이",
      "description": "사람의 뼈가 얽힌 거대한 껍질",
      "skills": [
        {
          "name": "뼈 긁기",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "껍질 말기",
          "power": 0,
          "effect": "shield",
          "value": 0.35,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "껍질 분쇄",
          "power": 1.4,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 119,
      "attack": 9,
      "defense": 7,
      "image": "assets/monsters/new/plains/bone_shell_snail.svg",
      "role": "assassin"
    },
    {
      "id": "backhoof_calf",
      "name": "역발굽 송아지",
      "description": "발굽이 뒤를 향하고 등에 얼굴이 있는 송아지",
      "skills": [
        {
          "name": "역발차기",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "미친 발구르기",
          "power": 0.8,
          "effect": "attack_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "검은 돌진",
          "power": 1.5,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 86,
      "attack": 14,
      "defense": 4,
      "image": "assets/monsters/new/plains/backhoof_calf.svg",
      "role": "bruiser"
    }
  ],
  "forest": [
    {
      "id": "inverted_blossom_stag",
      "name": "거꾸로 핀 꽃사슴",
      "description": "머리에서 아래로 자라는 거대한 꽃",
      "skills": [
        {
          "name": "꽃뿔 찌르기",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "꽃가루 가림",
          "power": 0.8,
          "effect": "attack_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "역개화",
          "power": 1.4,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 138,
      "attack": 18,
      "defense": 8,
      "image": "assets/monsters/new/forest/inverted_blossom_stag.svg",
      "role": "bruiser"
    },
    {
      "id": "root_ambusher",
      "name": "뿌리잠복자",
      "description": "팔과 다리가 나무뿌리인 인간형",
      "skills": [
        {
          "name": "뿌리 후려치기",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "발밑 침식",
          "power": 0,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "뿌리맥 압살",
          "power": 1.35,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 140,
      "attack": 19,
      "defense": 9,
      "image": "assets/monsters/new/forest/root_ambusher.svg",
      "role": "guardian"
    },
    {
      "id": "black_sap_widow",
      "name": "검은수액 과부",
      "description": "거미처럼 꺾인 팔 여섯 개와 검은 수액",
      "skills": [
        {
          "name": "수액 바늘",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "끈끈한 실",
          "power": 0.9,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "검은 번데기",
          "power": 1.45,
          "effect": "leech",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 125,
      "attack": 21,
      "defense": 7,
      "image": "assets/monsters/new/forest/black_sap_widow.svg",
      "role": "assassin"
    },
    {
      "id": "moss_midwife",
      "name": "이끼산파",
      "description": "몸에 살아 있는 이끼 주머니를 품은 형체",
      "skills": [
        {
          "name": "손톱 물기",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "이끼 포대",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "기생 포옹",
          "power": 1.35,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 156,
      "attack": 16,
      "defense": 9,
      "image": "assets/monsters/new/forest/moss_midwife.svg",
      "role": "bruiser"
    },
    {
      "id": "mycelium_spasm_wolf",
      "name": "균사경련 늑대",
      "description": "몸 안팎으로 버섯이 솟은 짐승",
      "skills": [
        {
          "name": "포자 이빨",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "몸통 터뜨리기",
          "power": 0.85,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "경련 연타",
          "power": 0.8,
          "effect": "none",
          "value": 0,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 129,
      "attack": 21,
      "defense": 7,
      "image": "assets/monsters/new/forest/mycelium_spasm_wolf.svg",
      "role": "guardian"
    },
    {
      "id": "night_knot_owl",
      "name": "밤매듭 올빼미",
      "description": "몸이 나뭇가지로 매듭지어진 거대한 새",
      "skills": [
        {
          "name": "그림자 깃",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "소리 없는 비행",
          "power": 0,
          "effect": "shield",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "목덜미 습격",
          "power": 1.35,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.3,
          "turns": [
            4
          ]
        }
      ],
      "hp": 109,
      "attack": 21,
      "defense": 8,
      "image": "assets/monsters/new/forest/night_knot_owl.svg",
      "role": "assassin"
    },
    {
      "id": "acorn_mortician",
      "name": "도토리 화장꾼",
      "description": "도토리 가면을 쓴 작은 곤충형 괴물",
      "skills": [
        {
          "name": "씨앗 망치",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "묘목 심기",
          "power": 0,
          "effect": "heal",
          "value": 0.05,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "도토리 폭탄",
          "power": 1.4,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 121,
      "attack": 18,
      "defense": 8,
      "image": "assets/monsters/new/forest/acorn_mortician.svg",
      "role": "bruiser"
    },
    {
      "id": "flaying_woodward",
      "name": "껍질벗는 수목수",
      "description": "나무껍질 아래 인간 피부가 드러나는 거인",
      "skills": [
        {
          "name": "가지 휘두르기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "수피 탈피",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "생살 뿌리",
          "power": 1.5,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 177,
      "attack": 18,
      "defense": 11,
      "image": "assets/monsters/new/forest/flaying_woodward.svg",
      "role": "guardian"
    },
    {
      "id": "dividing_mushroom_colony",
      "name": "분열버섯 군락",
      "description": "작은 균사 생물 여러 마리가 뭉친 몸체",
      "skills": [
        {
          "name": "주름날",
          "power": 0.95,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "포자비",
          "power": 0.7,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "균사 합창",
          "power": 0.75,
          "effect": "heal",
          "value": 0.05,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 152,
      "attack": 16,
      "defense": 9,
      "image": "assets/monsters/new/forest/dividing_mushroom_colony.svg",
      "role": "assassin"
    },
    {
      "id": "voice_thief_moss",
      "name": "목소리 훔친 이끼",
      "description": "나무에서 늘어진 사람 얼굴 모양의 이끼",
      "skills": [
        {
          "name": "혀싹 찌르기",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "남의 목소리",
          "power": 0.8,
          "effect": "attack_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "침묵의 장막",
          "power": 1.2,
          "effect": "silence",
          "value": 1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 133,
      "attack": 19,
      "defense": 8,
      "image": "assets/monsters/new/forest/voice_thief_moss.svg",
      "role": "bruiser"
    }
  ],
  "mine": [
    {
      "id": "glass_lung_miner",
      "name": "유리폐 광부",
      "description": "가슴이 투명한 유리 폐로 이루어진 노동자",
      "skills": [
        {
          "name": "균열 곡괭이",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "유리 분진",
          "power": 0.8,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "폐폭발",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.15,
          "turns": [
            4
          ]
        }
      ],
      "hp": 166,
      "attack": 27,
      "defense": 13,
      "image": "assets/monsters/new/mine/glass_lung_miner.svg",
      "role": "bruiser"
    },
    {
      "id": "iron_dust_glutton",
      "name": "쇳가루 포식충",
      "description": "자기장으로 쇳가루를 모으는 거대 지렁이",
      "skills": [
        {
          "name": "쇳니 씹기",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "자력 입자막",
          "power": 0,
          "effect": "shield",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "철폭식",
          "power": 0.8,
          "effect": "none",
          "value": 0,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 218,
      "attack": 24,
      "defense": 17,
      "image": "assets/monsters/new/mine/iron_dust_glutton.svg",
      "role": "guardian"
    },
    {
      "id": "magnetic_ghost",
      "name": "자력 망령",
      "description": "장갑과 광석 조각들이 공중에 떠 있는 형체",
      "skills": [
        {
          "name": "자기장 기습",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "반발극",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "극성 붕괴",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.25,
          "turns": [
            4
          ]
        }
      ],
      "hp": 157,
      "attack": 28,
      "defense": 12,
      "image": "assets/monsters/new/mine/magnetic_ghost.svg",
      "role": "assassin"
    },
    {
      "id": "shatterjaw_excavator",
      "name": "파쇄턱 굴착수",
      "description": "입 전체가 거대한 굴착 드릴인 짐승",
      "skills": [
        {
          "name": "회전턱",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "갱벽 파편",
          "power": 0.85,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "굴착 돌파",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 220,
      "attack": 26,
      "defense": 16,
      "image": "assets/monsters/new/mine/shatterjaw_excavator.svg",
      "role": "bruiser"
    },
    {
      "id": "coin_eye_burialman",
      "name": "주화눈 매장인",
      "description": "눈구멍에 오래된 동전이 박힌 시체",
      "skills": [
        {
          "name": "금속 긁기",
          "power": 1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "주화 현혹",
          "power": 0,
          "effect": "attack_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "불순물 동전비",
          "power": 0.8,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 180,
      "attack": 25,
      "defense": 13,
      "image": "assets/monsters/new/mine/coin_eye_burialman.svg",
      "role": "guardian"
    },
    {
      "id": "coaldust_respirator",
      "name": "탄진 호흡기",
      "description": "버려진 호흡 장비가 스스로 움직이는 괴물",
      "skills": [
        {
          "name": "탄분 기침",
          "power": 0.9,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "압력 차폐",
          "power": 0,
          "effect": "shield",
          "value": 0.35,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "검은 발파",
          "power": 1.55,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 178,
      "attack": 23,
      "defense": 16,
      "image": "assets/monsters/new/mine/coaldust_respirator.svg",
      "role": "assassin"
    },
    {
      "id": "wickstone_statue",
      "name": "심지석상",
      "description": "머리 대신 타오르는 광산 등불이 달린 석상",
      "skills": [
        {
          "name": "손마디 쇄도",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "등잔 연기",
          "power": 0.85,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "점화 폭발",
          "power": 1.45,
          "effect": "burn",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 218,
      "attack": 22,
      "defense": 19,
      "image": "assets/monsters/new/mine/wickstone_statue.svg",
      "role": "bruiser"
    },
    {
      "id": "hollow_drill",
      "name": "텅 빈 드릴",
      "description": "속이 비어 있는 자율 굴착 기계",
      "skills": [
        {
          "name": "쐐기 회전",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "과열 예비",
          "power": 0,
          "effect": "attack_buff",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "관통 고속",
          "power": 1.7,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 194,
      "attack": 28,
      "defense": 15,
      "image": "assets/monsters/new/mine/hollow_drill.svg",
      "role": "guardian"
    },
    {
      "id": "parasitic_ore_vein",
      "name": "기생 광맥",
      "description": "광맥을 따라 기어 다니는 수정 기생생물",
      "skills": [
        {
          "name": "결정 채찍",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "광석 재생",
          "power": 0,
          "effect": "heal",
          "value": 0.07,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "수정 가시비",
          "power": 0.7,
          "effect": "none",
          "value": 0,
          "hits": 3,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 205,
      "attack": 24,
      "defense": 18,
      "image": "assets/monsters/new/mine/parasitic_ore_vein.svg",
      "role": "assassin"
    },
    {
      "id": "headless_tunnel_guard",
      "name": "목 잘린 갱도지기",
      "description": "목 위로 광산 등불이 솟은 거대한 인부",
      "skills": [
        {
          "name": "탄광 도끼",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "종점 방패",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "폐광 붕락",
          "power": 1.5,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 234,
      "attack": 25,
      "defense": 18,
      "image": "assets/monsters/new/mine/headless_tunnel_guard.svg",
      "role": "bruiser"
    }
  ],
  "fortress": [
    {
      "id": "kneeling_sentinel",
      "name": "무릎 꿇은 파수상",
      "description": "무릎 꿇은 자세로 움직이는 거대한 기사 석상",
      "skills": [
        {
          "name": "석검 치기",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "성문 자세",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "재판 철퇴",
          "power": 1.6,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 313,
      "attack": 30,
      "defense": 27,
      "image": "assets/monsters/new/fortress/kneeling_sentinel.svg",
      "role": "bruiser"
    },
    {
      "id": "folded_banner_knight",
      "name": "접힌 깃발 기사",
      "description": "몸 전체가 검은 군기에 감긴 기사",
      "skills": [
        {
          "name": "깃대 찌르기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "휘장 보호",
          "power": 0,
          "effect": "shield",
          "value": 0.35,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "패잔군 돌격",
          "power": 1.55,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 265,
      "attack": 35,
      "defense": 22,
      "image": "assets/monsters/new/fortress/folded_banner_knight.svg",
      "role": "guardian"
    },
    {
      "id": "cage_rib_hound",
      "name": "철창내장 군견",
      "description": "갈비뼈가 새장처럼 벌어진 군견",
      "skills": [
        {
          "name": "쇳발톱",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "굶주린 철창",
          "power": 0.9,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "자물쇠 물기",
          "power": 1.4,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.25,
          "turns": [
            4
          ]
        }
      ],
      "hp": 233,
      "attack": 38,
      "defense": 19,
      "image": "assets/monsters/new/fortress/cage_rib_hound.svg",
      "role": "assassin"
    },
    {
      "id": "rustwater_bellkeeper",
      "name": "녹물 종지기",
      "description": "종을 몸에 매달고 녹물을 흘리는 거인",
      "skills": [
        {
          "name": "종추 강타",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "녹물 흡입",
          "power": 0,
          "effect": "heal",
          "value": 0.05,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "파열 종소리",
          "power": 1.3,
          "effect": "attack_down",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 338,
      "attack": 30,
      "defense": 25,
      "image": "assets/monsters/new/fortress/rustwater_bellkeeper.svg",
      "role": "bruiser"
    },
    {
      "id": "breastplate_crows",
      "name": "흉갑 속 까마귀떼",
      "description": "빈 갑옷 내부를 채운 검은 새 무리",
      "skills": [
        {
          "name": "부리 난사",
          "power": 0.8,
          "effect": "none",
          "value": 0,
          "hits": 2,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "검은 깃 흩뿌리기",
          "power": 0.85,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "흉갑 파열",
          "power": 0.7,
          "effect": "none",
          "value": 0,
          "hits": 3,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 208,
      "attack": 38,
      "defense": 18,
      "image": "assets/monsters/new/fortress/breastplate_crows.svg",
      "role": "guardian"
    },
    {
      "id": "crossbow_bone_archer",
      "name": "석궁뼈 궁수",
      "description": "척추와 팔뼈가 석궁으로 변한 병사",
      "skills": [
        {
          "name": "골화살",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.1,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "목표 각인",
          "power": 0,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "성벽 연사",
          "power": 0.75,
          "effect": "none",
          "value": 0,
          "hits": 3,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 213,
      "attack": 38,
      "defense": 18,
      "image": "assets/monsters/new/fortress/crossbow_bone_archer.svg",
      "role": "assassin"
    },
    {
      "id": "helmet_collecting_squire",
      "name": "투구 줍는 종자",
      "description": "남의 투구를 여러 개 쌓아 쓴 작은 기사",
      "skills": [
        {
          "name": "잔검 후리기",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "투구 도금",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "왕관 투척",
          "power": 1.6,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 240,
      "attack": 33,
      "defense": 24,
      "image": "assets/monsters/new/fortress/helmet_collecting_squire.svg",
      "role": "bruiser"
    },
    {
      "id": "arrow_seamstress",
      "name": "화살비 재봉사",
      "description": "몸에 박힌 화살을 실로 엮어 사용하는 인형",
      "skills": [
        {
          "name": "바늘 화살",
          "power": 1.05,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "봉합 실",
          "power": 0,
          "effect": "shield_heal",
          "value": 0.25,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "명령 사격",
          "power": 1.35,
          "effect": "defense_down",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 265,
      "attack": 33,
      "defense": 21,
      "image": "assets/monsters/new/fortress/arrow_seamstress.svg",
      "role": "guardian"
    },
    {
      "id": "siege_hammer_wraith",
      "name": "공성망치의 혼",
      "description": "거대한 공성망치에 영혼이 들러붙은 형체",
      "skills": [
        {
          "name": "흔들리는 쇳머리",
          "power": 1.25,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "장전 보호",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "철문 분쇄",
          "power": 1.75,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 320,
      "attack": 38,
      "defense": 22,
      "image": "assets/monsters/new/fortress/siege_hammer_wraith.svg",
      "role": "assassin"
    },
    {
      "id": "royal_decree_reader",
      "name": "왕명 낭독자",
      "description": "얼굴 대신 두루마리를 펼쳐 든 궁정인",
      "skills": [
        {
          "name": "죄목 낭독",
          "power": 0.95,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "불가침 칙령",
          "power": 0,
          "effect": "shield",
          "value": 0.3,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "처형 선고",
          "power": 1.6,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.3,
          "turns": [
            4
          ]
        }
      ],
      "hp": 238,
      "attack": 37,
      "defense": 21,
      "image": "assets/monsters/new/fortress/royal_decree_reader.svg",
      "role": "bruiser"
    }
  ],
  "ruins": [
    {
      "id": "erased_name_keeper",
      "name": "지워진 이름꾼",
      "description": "얼굴이 긁혀 지워진 인간형",
      "skills": [
        {
          "name": "망각의 손길",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "기록 분실",
          "power": 0,
          "effect": "attack_down",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "존재 삭제",
          "power": 1.55,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.25,
          "turns": [
            4
          ]
        }
      ],
      "hp": 364,
      "attack": 45,
      "defense": 29,
      "image": "assets/monsters/new/ruins/erased_name_keeper.svg",
      "role": "bruiser"
    },
    {
      "id": "third_shadow",
      "name": "세 번째 그림자",
      "description": "물체가 없어도 세 갈래로 드리워지는 그림자",
      "skills": [
        {
          "name": "그림자 긁기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "몸 없는 분신",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "세 갈래 밤",
          "power": 0.65,
          "effect": "none",
          "value": 0,
          "hits": 3,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 303,
      "attack": 50,
      "defense": 25,
      "image": "assets/monsters/new/ruins/third_shadow.svg",
      "role": "guardian"
    },
    {
      "id": "mirrorbone_observer",
      "name": "거울뼈 관측자",
      "description": "척추가 거울로 이루어진 외눈박이",
      "skills": [
        {
          "name": "유리눈 찌르기",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "반사 거울",
          "power": 0,
          "effect": "reflect",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "반사 기억",
          "power": 1.5,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 357,
      "attack": 47,
      "defense": 34,
      "image": "assets/monsters/new/ruins/mirrorbone_observer.svg",
      "role": "assassin"
    },
    {
      "id": "death_scribe",
      "name": "죽음 필사 서기",
      "description": "손가락이 깃펜으로 변한 시체",
      "skills": [
        {
          "name": "잉크 긋기",
          "power": 1.05,
          "effect": "bleed",
          "value": 0.12,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "판결 기록",
          "power": 0,
          "effect": "defense_down",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "마지막 문장",
          "power": 1.7,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 326,
      "attack": 50,
      "defense": 28,
      "image": "assets/monsters/new/ruins/death_scribe.svg",
      "role": "bruiser"
    },
    {
      "id": "extinguished_star_larva",
      "name": "꺼진 별의 유충",
      "description": "몸속에서 검은 별빛이 새어 나오는 유충",
      "skills": [
        {
          "name": "중력 잠식",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "별가루 중독",
          "power": 0.85,
          "effect": "poison",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "소멸 파동",
          "power": 1.75,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.2,
          "turns": [
            4
          ]
        }
      ],
      "hp": 418,
      "attack": 45,
      "defense": 31,
      "image": "assets/monsters/new/ruins/extinguished_star_larva.svg",
      "role": "guardian"
    },
    {
      "id": "reverse_pilgrim_machine",
      "name": "역방향 순례기",
      "description": "모든 관절이 반대로 움직이는 기계 인간",
      "skills": [
        {
          "name": "거꾸로 베기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "과거 회수",
          "power": 0,
          "effect": "heal",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "역행 섬광",
          "power": 1.55,
          "effect": "silence",
          "value": 1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 391,
      "attack": 48,
      "defense": 32,
      "image": "assets/monsters/new/ruins/reverse_pilgrim_machine.svg",
      "role": "assassin"
    },
    {
      "id": "blank_constellation",
      "name": "백지 성좌",
      "description": "백지 조각이 사람 형상을 이루며 떠다니는 존재",
      "skills": [
        {
          "name": "공백침",
          "power": 1.1,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.15,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "문장 보호",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "미완성 신화",
          "power": 1.7,
          "effect": "defense_down",
          "value": 0.15,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 398,
      "attack": 45,
      "defense": 34,
      "image": "assets/monsters/new/ruins/blank_constellation.svg",
      "role": "bruiser"
    },
    {
      "id": "time_chewing_beast",
      "name": "시간 씹는 괴수",
      "description": "모래시계처럼 열린 턱을 가진 네발 괴물",
      "skills": [
        {
          "name": "시계 갈기",
          "power": 1.15,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "초침 물기",
          "power": 0.95,
          "effect": "delay",
          "value": 1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "지나간 초식",
          "power": 0.8,
          "effect": "heal",
          "value": 0.05,
          "hits": 2,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 442,
      "attack": 48,
      "defense": 31,
      "image": "assets/monsters/new/ruins/time_chewing_beast.svg",
      "role": "guardian"
    },
    {
      "id": "red_enumerator",
      "name": "붉은 번호매김자",
      "description": "붉은 숫자가 새겨진 손가락 수십 개",
      "skills": [
        {
          "name": "숫자 낙인",
          "power": 1,
          "effect": "vulnerable",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "오류 기록",
          "power": 0,
          "effect": "attack_down",
          "value": 0.2,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "영점화",
          "power": 1.7,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0.35,
          "turns": [
            4
          ]
        }
      ],
      "hp": 320,
      "attack": 50,
      "defense": 27,
      "image": "assets/monsters/new/ruins/red_enumerator.svg",
      "role": "assassin"
    },
    {
      "id": "thresholdless_gatekeeper",
      "name": "문턱 없는 문지기",
      "description": "문틀이 몸통을 관통하고 다리가 없는 거인",
      "skills": [
        {
          "name": "문짝 찍기",
          "power": 1.25,
          "effect": "none",
          "value": 0,
          "hits": 1,
          "penetration": 0,
          "turns": [
            1,
            3
          ]
        },
        {
          "name": "경계막",
          "power": 0,
          "effect": "shield",
          "value": 0.4,
          "hits": 1,
          "penetration": 0,
          "turns": [
            2
          ]
        },
        {
          "name": "닫히지 않는 문",
          "power": 1.6,
          "effect": "heal",
          "value": 0.1,
          "hits": 1,
          "penetration": 0,
          "turns": [
            4
          ]
        }
      ],
      "hp": 469,
      "attack": 47,
      "defense": 39,
      "image": "assets/monsters/new/ruins/thresholdless_gatekeeper.svg",
      "role": "bruiser"
    }
  ]
}$monsters$::jsonb;
$$;
revoke all on function private.hunting_monster_catalog() from public,anon,authenticated;

create or replace function private.choose_hunting_monster(p_map text,p_previous text,p_draw double precision)
returns jsonb language plpgsql set search_path='' as $$
declare pool jsonb:=private.hunting_monster_catalog()->p_map; candidates jsonb;
begin
 if pool is null or p_draw is null or p_draw<0 or p_draw>=1 then raise exception 'HUNT_MONSTER_INVALID';end if;
 if p_previous is null then return pool->floor(p_draw*jsonb_array_length(pool))::integer;end if;
 select jsonb_agg(value order by ordinal) into candidates
 from jsonb_array_elements(pool) with ordinality as choices(value,ordinal)
 where value->>'id'<>p_previous;
 if candidates is null then raise exception 'HUNT_MONSTER_POOL_EMPTY';end if;
 return candidates->floor(p_draw*jsonb_array_length(candidates))::integer;
end $$;
revoke all on function private.choose_hunting_monster(text,text,double precision) from public,anon,authenticated;

create or replace function private.hunting_monster_skill_info(p_monster_id text)
returns jsonb language sql stable set search_path='' as $$
 select entry.monster->'skills' from jsonb_each(private.hunting_monster_catalog()) as maps(map_id,monsters), lateral jsonb_array_elements(maps.monsters) as entry(monster) where entry.monster->>'id'=p_monster_id limit 1;
$$;
revoke all on function private.hunting_monster_skill_info(text) from public,anon,authenticated;

create or replace function private.hunting_monster_action(
 p_monster jsonb,p_turn integer,p_player_defense numeric,p_guard boolean,p_monster_hp numeric,p_effects jsonb
) returns jsonb language plpgsql set search_path='' as $$
declare
 skill jsonb:=p_monster->'skills'->(case ((p_turn-1)%4) when 0 then 0 when 1 then 1 when 2 then 0 else 2 end);
 kind text:=skill->>'effect';amount numeric:=coalesce((skill->>'value')::numeric,0);
 power numeric:=coalesce((skill->>'power')::numeric,0);
 hits integer:=coalesce((skill->>'hits')::integer,1);pen numeric:=coalesce((skill->>'penetration')::numeric,0);
 total numeric:=0;heal numeric:=0;perhit numeric;buff numeric:=coalesce((p_effects->>'attack_buff')::numeric,0);
 vulnerable numeric:=coalesce((p_effects->>'vulnerable')::numeric,0);
 next_effects jsonb:=p_effects||jsonb_build_object('attack_buff',0,'vulnerable',0);
 line text;
begin
 if power>0 then
  perhit:=private.hunting_damage((p_monster->>'attack')::numeric,p_player_defense,power*(1+buff)*(1+vulnerable)*(case when p_guard then .5 else 1 end),pen);
  total:=perhit*hits;
 end if;
 if kind in ('bleed','poison','burn','attack_down','defense_down') then
  next_effects:=next_effects||jsonb_build_object(kind,amount,kind||'Until',p_turn+2);
 elsif kind='shield' then next_effects:=next_effects||jsonb_build_object('shield',amount);
 elsif kind='shield_heal' then
  next_effects:=next_effects||jsonb_build_object('shield',amount);
  heal:=floor((p_monster->>'hp')::numeric*.03);
 elsif kind='reflect' then next_effects:=next_effects||jsonb_build_object('reflect',amount);
 elsif kind='attack_buff' then next_effects:=next_effects||jsonb_build_object('attack_buff',amount);
 elsif kind='vulnerable' then next_effects:=next_effects||jsonb_build_object('vulnerable',amount);
 elsif kind='silence' then next_effects:=next_effects||jsonb_build_object('silenceUntil',p_turn+1);
 elsif kind='delay' then next_effects:=next_effects||jsonb_build_object('delayUntil',p_turn+1);
 elsif kind='heal' then heal:=floor((p_monster->>'hp')::numeric*amount);
 elsif kind='leech' then heal:=floor(total*amount);
 end if;
 heal:=least(greatest(0,(p_monster->>'hp')::numeric-p_monster_hp),heal);
 line:=p_monster->>'name'||'의 '||skill->>'name'||'! '||
  case when power>0 then total::text||' 피해' else '효과 발동' end||
  case when hits>1 then ' · '||hits::text||'연타' else '' end||
  case when heal>0 then ' · HP +'||heal::text else '' end||
  case kind when 'bleed' then ' · 출혈' when 'poison' then ' · 중독' when 'burn' then ' · 화상'
   when 'attack_down' then ' · 공격력 감소' when 'defense_down' then ' · 방어력 감소'
   when 'vulnerable' then ' · 취약' when 'shield' then ' · 피해 감소'
   when 'reflect' then ' · 피해 반사' when 'silence' then ' · 스킬 봉인'
   when 'delay' then ' · 스킬 지연' when 'attack_buff' then ' · 위력 강화'
   when 'shield_heal' then ' · 보호막·재생' else '' end;
 return jsonb_build_object('damage',total,'heal',heal,'skillName',skill->>'name','hits',hits,'line',line,'effects',next_effects);
end $$;
revoke all on function private.hunting_monster_action(jsonb,integer,numeric,boolean,numeric,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.hunt_once(p_lease_id uuid, p_generation bigint, p_client_instance_id text, p_device_id text, p_request_id uuid, p_map_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u uuid;l private.village_life_players%rowtype;potions_used bigint;potions_before bigint;next_hp numeric;start_hp numeric;food text;remaining bigint;s public.game_saves%rowtype;h private.hunting_states%rowtype;r private.hunting_receipts%rowtype;
 monster jsonb;monster_action jsonb;effects jsonb:='{}';dot_kind text;dot_hit numeric;reflect_hit numeric;previous_monster text;drop_item jsonb;p jsonb;player jsonb;result jsonb;turns jsonb:='[]';lines jsonb;cd jsonb:='{}';skill text;candidate text;
 mh numeric;mhp numeric;hp numeric;attack numeric;defense numeric;ma numeric;md numeric;hit numeric;mult numeric;guard boolean;critical boolean;win boolean;turn_no integer;
 reward_silver bigint;xp bigint;material text;monster_name text;stamp bigint:=floor(extract(epoch from now())*1000);
begin
 u:=private.village_life_user(p_lease_id,p_generation,p_client_instance_id,p_device_id);
 if p_request_id is null then raise exception 'HUNT_REQUEST_REQUIRED';end if;
 if p_map_id is null or p_map_id not in ('plains','forest','mine','fortress','ruins') then raise exception 'HUNT_MAP_INVALID';end if;
 -- Match economy lock order: save -> wallet -> hunting. Account save serializes concurrent requests.
 select * into s from public.game_saves where user_id=u for update;
 if not found then raise exception 'CLOUD_SAVE_REQUIRED';end if;
 perform private.sync_market_economy_from_latest_save(u);
 perform 1 from private.player_wallets where user_id=u for update;
 if not found then raise exception 'SERVER_WALLET_REQUIRED';end if;
 perform private.refresh_hunting_state(u);
 select * into h from private.hunting_states where user_id=u for update;
 select * into r from private.hunting_receipts where user_id=u and request_id=p_request_id;
 if found then
  if r.map_id<>p_map_id then raise exception 'HUNT_REQUEST_CONFLICT';end if;
  return jsonb_build_object('state',private.refresh_hunting_state(u),'result',r.result,'record',private.cloud_record_json(u),'replayed',true,'serverNow',stamp);
 end if;
 perform private.refresh_village_life(u);select * into strict l from private.village_life_players where user_id=u;
 if exists(select 1 from private.online_expeditions where user_id=u and status='ACTIVE') or jsonb_typeof(s.payload->'expedition') is distinct from 'null' then raise exception 'HUNT_EXPEDITION_ACTIVE';end if;
 if h.vitality<1 then raise exception 'VITALITY_EMPTY';end if;
 if p_map_id='plains' then mh:=90;ma:=12;md:=5;reward_silver:=1000+floor(random()*201)::bigint;xp:=100;material:='material:leather:1';monster_name:='가죽 갉는 하이에나';
 elsif p_map_id='forest' then mh:=130;ma:=18;md:=8;reward_silver:=1600+floor(random()*401)::bigint;xp:=250;material:='material:leather:1';monster_name:='가시 자칼';
 elsif p_map_id='mine' then mh:=180;ma:=24;md:=14;reward_silver:=2500+floor(random()*601)::bigint;xp:=600;material:='material:ore:1';monster_name:='고블린 광부';
 elsif p_map_id='fortress' then mh:=250;ma:=32;md:=20;reward_silver:=3800+floor(random()*801)::bigint;xp:=1400;material:='material:leather:1';monster_name:='무리 선봉';
 else mh:=340;ma:=42;md:=28;reward_silver:=5500+floor(random()*1001)::bigint;xp:=3000;material:='material:leather:1';monster_name:='송곳니 둥지';end if;
 previous_monster:=h.last_result->'monster'->>'id';
 monster:=private.choose_hunting_monster(p_map_id,previous_monster,random());
 mh:=(monster->>'hp')::numeric;ma:=(monster->>'attack')::numeric;md:=(monster->>'defense')::numeric;
 monster_name:=monster->>'name';

 -- Resolve equipment using the canonical inventory and no job multipliers.
 p:=jsonb_set(s.payload,'{expedition}',jsonb_build_object('equipment',s.payload->'equipped'),true);
 player:=private.combat_equipment_stats(u,p);
 player:=jsonb_build_object('hp',greatest(1,(player->>'hp')::numeric),'attack',greatest(0,(player->>'attack')::numeric),'defense',greatest(0,(player->>'defense')::numeric),'critChance',greatest(0,least(1,coalesce((player->>'critChance')::numeric,.05))),'critDamage',greatest(1,coalesce((player->>'critDamage')::numeric,1.5)),'armorPenetration',greatest(0,least(1,coalesce((player->>'armorPenetration')::numeric,0))));
 hp:=greatest(1,least((player->>'hp')::numeric,coalesce(h.current_hp,(player->>'hp')::numeric)));
 potions_before:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 hp:=least((player->>'hp')::numeric,hp+potions_before);start_hp:=hp;
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_before),true);
 attack:=(player->>'attack')::numeric*case when coalesce((l.food_turns->>'attack_food')::bigint,0)>0 then 1.1 else 1 end;
 defense:=(player->>'defense')::numeric*case when coalesce((l.food_turns->>'defense_food')::bigint,0)>0 then 1.1 else 1 end;
 player:=player||jsonb_build_object('attack',attack,'defense',defense);
 if coalesce((l.food_turns->>'experience_food')::bigint,0)>0 then xp:=floor(xp*1.1);end if;
 mhp:=mh;
 for turn_no in 1..100 loop
  exit when hp<=0 or mhp<=0;
  lines:='[]';skill:=null;guard:=false;
  foreach dot_kind in array array['bleed','poison','burn'] loop
   if coalesce((effects->>(dot_kind||'Until'))::integer,0)>=turn_no then
    dot_hit:=greatest(1,floor(ma*coalesce((effects->>dot_kind)::numeric,0)));
    hp:=greatest(0,hp-dot_hit);
    lines:=lines||jsonb_build_array('탐사자가 '||case dot_kind when 'bleed' then '출혈' when 'burn' then '화상' else '중독' end||'로 '||dot_hit::text||' 피해');
   end if;
  end loop;
  if hp<=0 then turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp));exit;end if;
  foreach candidate in array h.skills loop
   if coalesce((effects->>'silenceUntil')::integer,0)<turn_no and coalesce((effects->>'delayUntil')::integer,0)<turn_no and candidate in ('heavy','guard','quick') and coalesce((cd->>candidate)::integer,0)<=turn_no and (candidate<>'guard' or hp/(player->>'hp')::numeric<=.5) then skill:=candidate;exit;end if;
  end loop;
  if skill='guard' then
   guard:=true;cd:=cd||jsonb_build_object('guard',turn_no+4);lines:=lines||jsonb_build_array('탐사자의 방어! 이번 턴 피해 50% 감소');
  elsif skill is not null then
   mult:=case skill when 'heavy' then 1.8 when 'quick' then 1.2 else 1 end;
   critical:=random()<coalesce((player->>'critChance')::numeric,.05);
   hit:=private.hunting_damage(attack*(case when coalesce((effects->>'attack_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'attack_down')::numeric,0) else 1 end),md,mult*(case when critical then (player->>'critDamage')::numeric else 1 end),(player->>'armorPenetration')::numeric);
   if coalesce((effects->>'shield')::numeric,0)>0 then hit:=greatest(1,floor(hit*(1-(effects->>'shield')::numeric)));end if;
   reflect_hit:=floor(hit*coalesce((effects->>'reflect')::numeric,0));
   hp:=greatest(0,hp-reflect_hit);
   effects:=effects||jsonb_build_object('shield',0,'reflect',0);
   mhp:=greatest(0,mhp-hit);
   if skill is not null then cd:=cd||jsonb_build_object(skill,turn_no+case when skill='heavy' then 3 else 2 end);end if;
   lines:=lines||jsonb_build_array('탐사자의 '||case skill when 'heavy' then '강타' when 'quick' then '속공' else '공격' end||'! '||hit::text||' 피해'||case when critical then ' · 치명타' else '' end);
  else lines:=lines||jsonb_build_array(case when coalesce((effects->>'silenceUntil')::integer,0)>=turn_no or coalesce((effects->>'delayUntil')::integer,0)>=turn_no then '탐사자의 스킬이 봉인·지연되어 행동할 수 없음' else '탐사자의 대기 · 사용 가능한 스킬 없음' end);
  end if;
  if mhp>0 and hp>0 then
   monster_action:=private.hunting_monster_action(monster,turn_no,defense*(case when coalesce((effects->>'defense_downUntil')::integer,0)>=turn_no then 1-coalesce((effects->>'defense_down')::numeric,0) else 1 end),guard,mhp,effects);
   hp:=greatest(0,hp-(monster_action->>'damage')::numeric);
   mhp:=least(mh,mhp+coalesce((monster_action->>'heal')::numeric,0));
   effects:=monster_action->'effects';
   lines:=lines||jsonb_build_array(monster_action->>'line');
  end if;
  turns:=turns||jsonb_build_array(jsonb_build_object('turn',turn_no,'lines',lines,'playerHp',hp,'monsterHp',mhp));
 end loop;
 win:=mhp=0 and hp>0;
 potions_used:=least(coalesce((l.products->>'potion')::bigint,0),ceil(greatest(0,(player->>'hp')::numeric-hp))::bigint);
 next_hp:=greatest(1,least((player->>'hp')::numeric,hp+potions_used));
 l.products:=jsonb_set(l.products,'{potion}',to_jsonb(coalesce((l.products->>'potion')::bigint,0)-potions_used),true);
 potions_used:=potions_used+potions_before;
 foreach food in array array['attack_food','defense_food','experience_food'] loop
  remaining:=coalesce((l.food_turns->>food)::bigint,0);l.food_turns:=jsonb_set(l.food_turns,array[food],to_jsonb(greatest(0,remaining-1)),true);
 end loop;
 update private.village_life_players set products=l.products,food_turns=l.food_turns where user_id=u;
 if win then drop_item:=private.hunting_equipment_drop(p_map_id,floor(random()*1000000)::integer,floor(random()*9)::integer);end if;
 result:=jsonb_build_object('monster',monster,'equipment',drop_item,'requestId',p_request_id,'mapId',p_map_id,'outcome',case when win then 'victory' else 'defeat' end,'player',player,'playerHp',hp,'startHp',start_hp,'recoveredHp',next_hp,'potionsUsed',potions_used,'monsterHp',mhp,'turns',turns,'silver',case when win then reward_silver else 0 end,'exp',case when win then xp else 0 end,'mastery',case when win then 1 else 0 end,'materialCount',case when win then 1 else 0 end,'createdAt',stamp);
 if win then
  if drop_item is not null then insert into private.market_assets(user_id,item_id,quantity,gear) values(u,'equipment_v2:'||(drop_item->>'id'),1,drop_item);end if;
  update private.player_wallets set silver=private.player_wallets.silver+reward_silver,updated_at=now() where user_id=u;
  insert into private.market_assets(user_id,item_id,quantity) values(u,material,1) on conflict(user_id,item_id) do update set quantity=private.market_assets.quantity+1,updated_at=now();
 end if;
 update private.hunting_states set current_hp=next_hp,max_hp=(player->>'hp')::numeric,vitality=vitality-1,experience=experience+case when win then xp else 0 end,mastery=mastery+case when win then 1 else 0 end,last_result=result where user_id=u;
 insert into private.hunting_receipts(user_id,request_id,map_id,result) values(u,p_request_id,p_map_id,result);
 perform private.persist_client_payload_with_server_economy(u,s.payload,'0.1.93');
 return jsonb_build_object('state',private.refresh_hunting_state(u),'result',result,'record',private.cloud_record_json(u),'replayed',false,'serverNow',stamp);
end $function$;
revoke all on function public.hunt_once(uuid,bigint,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.hunt_once(uuid,bigint,text,text,uuid,text) to authenticated;
